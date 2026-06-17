import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { PerlinNoise } from './perlin.js';
import {
    CHUNK_SIZE, WORLD_HEIGHT,
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, REACH_DISTANCE,
    BEDROCK, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, SNOW, PLANKS, COBBLESTONE, GRAVEL, WATER, GLASS
} from './constants.js';
import { createTextureAtlasAsync } from './textures.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.perlin = new PerlinNoise(137);
        this.cavePerlin = new PerlinNoise(259);
        this.treePerlin = new PerlinNoise(381);
        
        this.renderDistance = 7; // Huge world view
        this._lastChunkCx = null;
        this._lastChunkCz = null;
        
        this.dataQueue = [];
        this.decoQueue = [];
        this.meshQueue = [];
        this.isProcessing = false;
        
        this._surfaceCache = new Map();
        this.textureAtlas = null;
    }

    async init(onProgress) {
        const atlas = await createTextureAtlasAsync(onProgress);
        this.textureAtlas = atlas.texture;
        this.getBlockUVs = atlas.getBlockUVs;
        this.createBlockPreview = atlas.createBlockPreview;
        this._atlasCanvas = atlas.canvas;
    }

    chunkKey(cx, cz) { return `${cx},${cz}`; }
    getChunk(cx, cz) { return this.chunks.get(this.chunkKey(cx, cz)) || null; }

    getBlock(wx, wy, wz) {
        if (wy < 0 || wy >= WORLD_HEIGHT) return AIR;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return AIR;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        return chunk.getBlock(lx, wy, lz);
    }

    setBlock(wx, wy, wz, blockType) {
        if (wy < 0 || wy >= WORLD_HEIGHT) return;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.setBlock(lx, wy, lz, blockType);
        chunk.dirty = true;
        if (lx === 0) { const nc = this.getChunk(cx - 1, cz); if (nc) nc.dirty = true; }
        if (lx === CHUNK_SIZE - 1) { const nc = this.getChunk(cx + 1, cz); if (nc) nc.dirty = true; }
        if (lz === 0) { const nc = this.getChunk(cx, cz - 1); if (nc) nc.dirty = true; }
        if (lz === CHUNK_SIZE - 1) { const nc = this.getChunk(cx, cz + 1); if (nc) nc.dirty = true; }
    }
    
    setBlockRaw(wx, wy, wz, blockType) {
        if (wy < 0 || wy >= WORLD_HEIGHT) return;
        const cx = Math.floor(wx / CHUNK_SIZE);
        const cz = Math.floor(wz / CHUNK_SIZE);
        const chunk = this.getChunk(cx, cz);
        if (!chunk) return;
        const lx = ((wx % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        const lz = ((wz % CHUNK_SIZE) + CHUNK_SIZE) % CHUNK_SIZE;
        chunk.setBlock(lx, wy, lz, blockType);
    }

    async initSpawn(onProgress) {
        const radius = this.renderDistance;
        const total = (radius * 2 + 1) ** 2;
        let done = 0;

        // 1. Data
        for (let dx = -radius - 2; dx <= radius + 2; dx++) {
            for (let dz = -radius - 2; dz <= radius + 2; dz++) {
                const chunk = new Chunk(dx, dz, this);
                chunk.stage = 0;
                this.chunks.set(this.chunkKey(dx, dz), chunk);
                this.generateChunkData(chunk);
                chunk.stage = 1;
                
                done++;
                if (onProgress && done % 10 === 0) onProgress(0.3 * (done / ((radius+2)*2+1)**2), '生成無盡地形...');
                if (done % 5 === 0) await new Promise(r => setTimeout(r, 0));
            }
        }

        // 2. Deco
        done = 0;
        for (let dx = -radius - 1; dx <= radius + 1; dx++) {
            for (let dz = -radius - 1; dz <= radius + 1; dz++) {
                const chunk = this.getChunk(dx, dz);
                if (chunk && chunk.stage === 1) {
                    this.generateChunkDecorations(chunk);
                    chunk.stage = 2;
                }
                done++;
                if (onProgress && done % 10 === 0) onProgress(0.3 + 0.3 * (done / ((radius+1)*2+1)**2), '生成自然結構...');
                if (done % 5 === 0) await new Promise(r => setTimeout(r, 0));
            }
        }

        // 3. Mesh
        done = 0;
        for (let dx = -radius; dx <= radius; dx++) {
            for (let dz = -radius; dz <= radius; dz++) {
                const chunk = this.getChunk(dx, dz);
                if (chunk && chunk.stage === 2) {
                    chunk.buildMesh();
                }
                done++;
                if (onProgress && done % 5 === 0) onProgress(0.6 + 0.4 * (done / total), '建立世界網格...');
                if (done % 2 === 0) await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    generateChunkData(chunk) {
        const ox = chunk.originX;
        const oz = chunk.originZ;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx;
                const wz = oz + lz;
                const key = `${wx},${wz}`;
                
                let surfaceY;
                if (this._surfaceCache.has(key)) {
                    surfaceY = this._surfaceCache.get(key);
                } else {
                    const heightNoise = this.perlin.octave2D(wx * 0.025, wz * 0.025, 6, 0.55, 2.0);
                    const detailNoise = this.perlin.octave2D(wx * 0.06, wz * 0.06, 3, 0.3, 2.5) * 3;
                    const ridgeNoise = Math.abs(this.perlin.octave2D(wx * 0.04, wz * 0.04, 3, 0.5, 2.0) - 0.5) * 2;
                    surfaceY = Math.floor(24 + heightNoise * 20 + detailNoise + ridgeNoise * 6);
                    surfaceY = Math.max(4, Math.min(WORLD_HEIGHT - 8, surfaceY));
                    this._surfaceCache.set(key, surfaceY);
                }

                const isSandy = surfaceY < 16;
                const biomeTemp = this.perlin.octave2D(wx * 0.008, wz * 0.008, 3, 0.5, 2.0);
                const isCold = biomeTemp < 0.3;

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let block = AIR;
                    if (y <= 3) {
                        if (y === 0) { block = BEDROCK; }
                        else if (y === 1) { block = Math.random() < 0.7 ? BEDROCK : STONE; }
                        else if (y === 2) { block = Math.random() < 0.3 ? BEDROCK : STONE; }
                        else { block = STONE; }
                    } else if (y < surfaceY - 4) {
                        // Minecraft-style Caves
                        const ridge1 = Math.abs(this.cavePerlin.octave3D(wx * 0.04, y * 0.04, wz * 0.04, 3, 0.5, 2.0));
                        const ridge2 = Math.abs(this.cavePerlin.octave3D(wx * 0.04 + 100, y * 0.04 + 100, wz * 0.04 + 100, 3, 0.5, 2.0));
                        const isSpaghetti = ridge1 < 0.04 && ridge2 < 0.04;
                        const cheese = this.cavePerlin.octave3D(wx * 0.02, y * 0.02, wz * 0.02, 2, 0.5, 2.0);
                        const isCheese = cheese > 0.6 && y > 6 && y < surfaceY - 10;

                        if ((isSpaghetti || isCheese) && y > 2) {
                            block = AIR;
                        } else {
                            block = STONE;
                            if (y > 4 && !(isSpaghetti || isCheese)) {
                                const oreSeed = wx * 317 + y * 997 + wz * 571;
                                const oreRand = ((oreSeed * 16807) % 2147483647) / 2147483647;
                                if (oreRand < 0.003 && y < 60) {
                                    block = COAL_ORE;
                                } else if (oreRand < 0.005 && oreRand >= 0.003 && y < 50) {
                                    block = IRON_ORE;
                                } else if (oreRand < 0.006 && oreRand >= 0.005 && y < 36) {
                                    block = GOLD_ORE;
                                } else if (oreRand < 0.0065 && oreRand >= 0.006 && y < 16) {
                                    block = DIAMOND_ORE;
                                }
                            }
                        }
                    } else if (y === surfaceY) {
                        if (isCold) block = SNOW;
                        else if (isSandy) block = SAND;
                        else block = GRASS;
                    } else if (y > surfaceY - 4 && y < surfaceY) {
                        if (isSandy) block = SAND;
                        else block = DIRT;
                    } else if (y > surfaceY) {
                        block = AIR;
                    } else {
                        block = STONE;
                    }
                    chunk.setBlock(lx, y, lz, block);
                }
            }
        }
    }

    findSurfaceY(wx, wz) {
        const key = `${wx},${wz}`;
        if (this._surfaceCache.has(key)) return this._surfaceCache.get(key);
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.getBlock(wx, y, wz) !== AIR) return y;
        }
        return 0;
    }

    generateChunkDecorations(chunk) {
        // 樹木
        for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
            for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
                const wx = chunk.originX + lx;
                const wz = chunk.originZ + lz;
                const surfaceY = this.findSurfaceY(wx, wz);
                if (surfaceY < 16 || surfaceY > WORLD_HEIGHT - 8) continue;
                const block = this.getBlock(wx, surfaceY, wz);
                if (block !== GRASS && block !== DIRT) continue;
                if (this.getBlock(wx, surfaceY + 1, wz) !== AIR) continue;
                
                const treeRand = this.treePerlin.noise2D(wx * 1.7, wz * 1.7);
                if (treeRand > 0.43 && treeRand < 0.51) {
                    const trunkHeight = 4 + Math.floor(Math.abs(this.treePerlin.noise2D(wx * 5.3, wz * 5.3)) * 3); // 4-6
                    this.placeTree(wx, surfaceY + 1, wz, trunkHeight);
                }
            }
        }

        // 村莊 (降低生成機率)
        if (this.treePerlin.noise2D(chunk.cx * 13.7, chunk.cz * 13.7) > 0.95) {
            const wx = chunk.originX + 8;
            const wz = chunk.originZ + 8;
            const sy = this.findSurfaceY(wx, wz);
            if (sy > 16 && sy < WORLD_HEIGHT - 20) {
                this.buildVillage(wx, sy, wz);
            }
        }
    }

    placeTree(wx, baseY, wz, trunkHeight) {
        // 樹幹
        for (let dy = 0; dy < trunkHeight; dy++) {
            this.setBlockRaw(wx, baseY + dy, wz, WOOD);
        }

        // 樹葉層 (從頂部往下 4 層)
        const topY = baseY + trunkHeight - 1;
        const lea = this.treePerlin;

        for (let dy = -3; dy <= 0; dy++) {
            const cy = topY + dy + 1;
            const radius = (dy === 0 || dy === -1) ? 1 : 2;

            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius) {
                        if (radius === 1 || lea.noise2D(wx + dx, wz + dz) > 0) continue;
                    }
                    if (dx === 0 && dz === 0 && dy < 0) continue;

                    const bx = wx + dx;
                    const bz = wz + dz;
                    if (this.getBlock(bx, cy, bz) === AIR) {
                        this.setBlockRaw(bx, cy, bz, LEAVES);
                    }
                }
            }
        }
    }

    buildVillage(centerX, baseY, centerZ) {
        // 1. 水井 (中心)
        for (let x = -2; x <= 2; x++) {
            for (let z = -2; z <= 2; z++) {
                const wx = centerX + x, wz = centerZ + z;
                const dist = Math.max(Math.abs(x), Math.abs(z));
                const sy = this.findSurfaceY(wx, wz);
                
                for (let y = sy; y > baseY - 1; y--) this.setBlockRaw(wx, y, wz, AIR);
                for (let y = sy; y <= baseY; y++) this.setBlockRaw(wx, y, wz, DIRT);
                
                if (dist === 2) {
                    this.setBlockRaw(wx, baseY, wz, COBBLESTONE);
                } else if (dist === 1) {
                    this.setBlockRaw(wx, baseY, wz, COBBLESTONE);
                    this.setBlockRaw(wx, baseY + 1, wz, COBBLESTONE);
                    this.setBlockRaw(wx, baseY + 3, wz, PLANKS);
                } else if (dist === 0) {
                    for (let y = baseY - 10; y <= baseY; y++) this.setBlockRaw(wx, y, wz, AIR);
                    this.setBlockRaw(wx, baseY - 10, wz, WATER);
                    this.setBlockRaw(wx, baseY + 3, wz, PLANKS);
                }
            }
        }

        // 2. 十字道路
        const dirs = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        for (let [dx, dz] of dirs) {
            let cx = centerX + dx * 3, cz = centerZ + dz * 3;
            for (let i = 0; i < 20; i++) {
                const w = Math.floor(i / 10) + 1;
                for (let hw = -w; hw <= w; hw++) {
                    let rx = cx + (dx === 0 ? hw : 0);
                    let rz = cz + (dz === 0 ? hw : 0);
                    let ry = this.findSurfaceY(rx, rz);
                    if (this.getBlock(rx, ry, rz) === GRASS) {
                        this.setBlockRaw(rx, ry, rz, Math.random() > 0.5 ? GRAVEL : DIRT);
                    }
                }
                cx += dx; cz += dz;
            }
        }

        // 3. 房屋生成
        let houseCount = 0;
        for (let i = 0; i < 20 && houseCount < 3; i++) {
            const hx = centerX + (Math.random() - 0.5) * 30;
            const hz = centerZ + (Math.random() - 0.5) * 30;
            if (Math.abs(hx - centerX) < 8 && Math.abs(hz - centerZ) < 8) continue;
            
            const hy = this.findSurfaceY(Math.floor(hx), Math.floor(hz));
            if (hy > baseY - 3 && hy < baseY + 3) {
                this.buildHouse(Math.floor(hx), hy, Math.floor(hz));
                houseCount++;
            }
        }
    }

    buildHouse(ox, oy, oz) {
        const w = 5, d = 5, h = 4;
        for (let x = 0; x < w; x++) {
            for (let z = 0; z < d; z++) {
                const wx = ox + x, wz = oz + z;
                let sy = this.findSurfaceY(wx, wz);
                for (let y = sy; y >= oy; y--) this.setBlockRaw(wx, y, wz, AIR);
                this.setBlockRaw(wx, oy, wz, COBBLESTONE);
            }
        }
        
        for (let y = 1; y <= h; y++) {
            for (let x = 0; x < w; x++) {
                for (let z = 0; z < d; z++) {
                    const wx = ox + x, wz = oz + z;
                    const isCorner = (x === 0 || x === w - 1) && (z === 0 || z === d - 1);
                    const isWall = x === 0 || x === w - 1 || z === 0 || z === d - 1;
                    
                    if (isCorner) {
                        this.setBlockRaw(wx, oy + y, wz, WOOD);
                    } else if (isWall) {
                        if (y === 2 && x === 2) {
                            this.setBlockRaw(wx, oy + y, wz, GLASS);
                        } else if (y <= 2 && x === 0 && z === 2) {
                            this.setBlockRaw(wx, oy + y, wz, AIR);
                        } else {
                            this.setBlockRaw(wx, oy + y, wz, PLANKS);
                        }
                    }
                }
            }
        }
        
        for (let y = 0; y < 3; y++) {
            for (let x = y; x < w - y; x++) {
                for (let z = y; z < d - y; z++) {
                    const isEdge = x === y || x === w - 1 - y || z === y || z === d - 1 - y;
                    if (isEdge || y === 2) {
                        this.setBlockRaw(ox + x, oy + h + y, oz + z, PLANKS);
                    }
                }
            }
        }
    }

    updateChunkLoading(playerX, playerZ) {
        const pcx = Math.floor(playerX / CHUNK_SIZE);
        const pcz = Math.floor(playerZ / CHUNK_SIZE);

        if (pcx === this._lastChunkCx && pcz === this._lastChunkCz) return;
        this._lastChunkCx = pcx;
        this._lastChunkCz = pcz;

        const loadRadius = this.renderDistance + 2;
        const decoRadius = this.renderDistance + 1;
        const meshRadius = this.renderDistance;
        const unloadRadius = this.renderDistance + 4;

        // Unload far chunks
        for (const [key, chunk] of this.chunks) {
            if (Math.abs(chunk.cx - pcx) > unloadRadius || Math.abs(chunk.cz - pcz) > unloadRadius) {
                chunk.dispose();
                this.chunks.delete(key);
            }
        }

        // 1. Data queue
        for (let dx = -loadRadius; dx <= loadRadius; dx++) {
            for (let dz = -loadRadius; dz <= loadRadius; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const key = this.chunkKey(cx, cz);
                if (!this.chunks.has(key)) {
                    const chunk = new Chunk(cx, cz, this);
                    chunk.stage = 0;
                    this.chunks.set(key, chunk);
                    this.dataQueue.push(chunk);
                }
            }
        }

        // 2. Deco queue
        for (let dx = -decoRadius; dx <= decoRadius; dx++) {
            for (let dz = -decoRadius; dz <= decoRadius; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const chunk = this.getChunk(cx, cz);
                if (chunk && chunk.stage === 1 && this.checkNeighborsStage(cx, cz, 1)) {
                    chunk.stage = 1.5;
                    this.decoQueue.push(chunk);
                }
            }
        }

        // 3. Mesh queue
        for (let dx = -meshRadius; dx <= meshRadius; dx++) {
            for (let dz = -meshRadius; dz <= meshRadius; dz++) {
                const cx = pcx + dx;
                const cz = pcz + dz;
                const chunk = this.getChunk(cx, cz);
                if (chunk && chunk.stage === 2 && !chunk.mesh && !chunk.inMeshQueue) {
                    chunk.inMeshQueue = true;
                    this.meshQueue.push(chunk);
                }
            }
        }

        if (!this.isProcessing) {
            this.processQueues();
        }
    }

    checkNeighborsStage(cx, cz, minStage) {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue;
                const n = this.getChunk(cx + dx, cz + dz);
                if (!n || n.stage < minStage) return false;
            }
        }
        return true;
    }

    async processQueues() {
        this.isProcessing = true;
        
        while (this.dataQueue.length > 0 || this.decoQueue.length > 0 || this.meshQueue.length > 0) {
            const start = performance.now();
            
            // Limit processing time per frame to maintain 60fps (~16ms)
            while (this.dataQueue.length > 0 && performance.now() - start < 6) {
                const chunk = this.dataQueue.shift();
                if (chunk.stage === 0) {
                    this.generateChunkData(chunk);
                    chunk.stage = 1;
                }
            }
            
            while (this.decoQueue.length > 0 && performance.now() - start < 10) {
                const chunk = this.decoQueue.shift();
                if (chunk.stage === 1.5) {
                    this.generateChunkDecorations(chunk);
                    chunk.stage = 2;
                }
            }
            
            while (this.meshQueue.length > 0 && performance.now() - start < 15) {
                const chunk = this.meshQueue.shift();
                chunk.inMeshQueue = false;
                if (chunk.stage === 2 && !chunk.mesh) {
                    chunk.buildMesh();
                }
            }
            
            await new Promise(r => requestAnimationFrame(r));
        }
        
        this.isProcessing = false;
    }

    updateDirtyChunks() {
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                if (chunk.mesh) chunk.buildMesh();
                chunk.dirty = false;
            }
        }
    }

    raycastBlock(origin, direction, maxDistance = REACH_DISTANCE) {
        const dir = direction.clone().normalize();
        let x = Math.floor(origin.x);
        let y = Math.floor(origin.y);
        let z = Math.floor(origin.z);

        const stepX = dir.x > 0 ? 1 : -1;
        const stepY = dir.y > 0 ? 1 : -1;
        const stepZ = dir.z > 0 ? 1 : -1;

        const tDeltaX = Math.abs(1 / dir.x);
        const tDeltaY = Math.abs(1 / dir.y);
        const tDeltaZ = Math.abs(1 / dir.z);

        let tMaxX = dir.x !== 0 ? ((dir.x > 0 ? (x + 1 - origin.x) : (origin.x - x)) / Math.abs(dir.x)) : Infinity;
        let tMaxY = dir.y !== 0 ? ((dir.y > 0 ? (y + 1 - origin.y) : (origin.y - y)) / Math.abs(dir.y)) : Infinity;
        let tMaxZ = dir.z !== 0 ? ((dir.z > 0 ? (z + 1 - origin.z) : (origin.z - z)) / Math.abs(dir.z)) : Infinity;

        let lastNormal = new THREE.Vector3(0, 0, 0);

        for (let i = 0; i < maxDistance * 3; i++) {
            const block = this.getBlock(x, y, z);
            if (block !== AIR) {
                return {
                    point: new THREE.Vector3(
                        origin.x + Math.min(tMaxX, tMaxY, tMaxZ) * dir.x,
                        origin.y + Math.min(tMaxX, tMaxY, tMaxZ) * dir.y,
                        origin.z + Math.min(tMaxX, tMaxY, tMaxZ) * dir.z,
                    ),
                    normal: lastNormal,
                    blockPos: new THREE.Vector3(x, y, z),
                    placePos: new THREE.Vector3(x + lastNormal.x, y + lastNormal.y, z + lastNormal.z),
                    distance: Math.min(tMaxX, tMaxY, tMaxZ),
                };
            }

            if (tMaxX < tMaxY) {
                if (tMaxX < tMaxZ) {
                    x += stepX;
                    tMaxX += tDeltaX;
                    lastNormal.set(-stepX, 0, 0);
                } else {
                    z += stepZ;
                    tMaxZ += tDeltaZ;
                    lastNormal.set(0, 0, -stepZ);
                }
            } else {
                if (tMaxY < tMaxZ) {
                    y += stepY;
                    tMaxY += tDeltaY;
                    lastNormal.set(0, -stepY, 0);
                } else {
                    z += stepZ;
                    tMaxZ += tDeltaZ;
                    lastNormal.set(0, 0, -stepZ);
                }
            }

            if (Math.min(tMaxX, tMaxY, tMaxZ) > maxDistance) break;
        }
        return null;
    }

    dispose() {
        for (const chunk of this.chunks.values()) chunk.dispose();
        this.chunks.clear();
    }
}
