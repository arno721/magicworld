import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { PerlinNoise } from './perlin.js';
import {
    CHUNK_SIZE, WORLD_HEIGHT, CHUNKS_X, CHUNKS_Z,
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, REACH_DISTANCE,
    BEDROCK, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, SNOW
} from './constants.js';
import { createTextureAtlas } from './textures.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.perlin = new PerlinNoise(137);
        this.cavePerlin = new PerlinNoise(259);
        this.treePerlin = new PerlinNoise(381);
        this.renderDistance = 6;
        this._lastChunkCx = null;
        this._lastChunkCz = null;
        this._loadingQueue = [];
        this._isLoading = false;
        this._surfaceCache = new Map();
        const atlas = createTextureAtlas();
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

    async generateAll(onProgress) {
        const totalChunks = CHUNKS_X * CHUNKS_Z;
        let done = 0;

        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cz = 0; cz < CHUNKS_Z; cz++) {
                const chunk = new Chunk(cx, cz, this);
                this.chunks.set(this.chunkKey(cx, cz), chunk);
                await this.generateChunkData(chunk);
                done++;
                if (onProgress) onProgress(done / totalChunks * 0.5, '生成地形...');
            }
        }

        await this.generateTrees(onProgress);
        await new Promise(r => setTimeout(r, 1));

        const centerCx = Math.floor(CHUNKS_X / 2);
        const centerCz = Math.floor(CHUNKS_Z / 2);
        let meshDone = 0;
        const toBuild = [];
        for (const chunk of this.chunks.values()) {
            const dist = Math.max(Math.abs(chunk.cx - centerCx), Math.abs(chunk.cz - centerCz));
            if (dist <= this.renderDistance) {
                toBuild.push(chunk);
            }
        }
        const totalMesh = toBuild.length;
        for (const chunk of toBuild) {
            chunk.buildMesh();
            meshDone++;
            if (onProgress) onProgress(0.5 + (meshDone / totalMesh) * 0.5, '構建區塊...');
            if (meshDone % 2 === 0) {
                await new Promise(r => setTimeout(r, 1));
            }
        }
    }

    async generateChunkData(chunk) {
        const ox = chunk.originX;
        const oz = chunk.originZ;
        let colCount = 0;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx;
                const wz = oz + lz;
                const key = `${wx},${wz}`;
                if (this._surfaceCache.has(key)) continue;

                const heightNoise = this.perlin.octave2D(wx * 0.025, wz * 0.025, 6, 0.55, 2.0);
                const detailNoise = this.perlin.octave2D(wx * 0.06, wz * 0.06, 3, 0.3, 2.5) * 3;
                const ridgeNoise = Math.abs(this.perlin.octave2D(wx * 0.04, wz * 0.04, 3, 0.5, 2.0) - 0.5) * 2;

                let surfaceY = Math.floor(24 + heightNoise * 20 + detailNoise + ridgeNoise * 6);
                surfaceY = Math.max(4, Math.min(WORLD_HEIGHT - 8, surfaceY));
                this._surfaceCache.set(key, surfaceY);
                const isSandy = surfaceY < 16 && heightNoise < -0.2;

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
                        const caveVal = this.cavePerlin.octave3D(wx * 0.05, y * 0.05, wz * 0.05, 3, 0.5, 2.0);
                        const caveVal2 = this.cavePerlin.octave3D(wx * 0.08, y * 0.08, wz * 0.08, 2, 0.4, 2.3);
                        const isCave = (Math.abs(caveVal) < 0.20) || (Math.abs(caveVal2) < 0.16 && y > 6 && y < surfaceY - 8);
                        if (isCave && y > 2) {
                            block = AIR;
                        } else {
                            block = STONE;
                            if (y > 4 && !isCave) {
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

                colCount++;
                // 每 16 列讓出主線程（避免凍結超過 4ms）
                if (colCount % 16 === 0) {
                    await new Promise(r => setTimeout(r, 0));
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

    async generateTrees(onProgress) {
        let count = 0;
        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cz = 0; cz < CHUNKS_Z; cz++) {
                const chunk = this.getChunk(cx, cz);
                if (!chunk) continue;
                const ox = chunk.originX;
                const oz = chunk.originZ;
                for (let lx = 2; lx < CHUNK_SIZE - 2; lx++) {
                    for (let lz = 2; lz < CHUNK_SIZE - 2; lz++) {
                        const wx = ox + lx;
                        const wz = oz + lz;
                        const surfaceY = this.findSurfaceY(wx, wz);
                        if (surfaceY < 16 || surfaceY > WORLD_HEIGHT - 8) continue;
                        const block = this.getBlock(wx, surfaceY, wz);
                        if (block !== GRASS && block !== DIRT) continue;
                        if (this.getBlock(wx, surfaceY + 1, wz) !== AIR) continue;
                        const treeRand = this.treePerlin.noise2D(wx * 1.7, wz * 1.7);
                        if (treeRand > 0.43 && treeRand < 0.51) {
                            const trunkHeight = 5 + Math.floor(Math.abs(this.treePerlin.noise2D(wx * 5.3, wz * 5.3)) * 2);
                            this.placeTree(wx, surfaceY + 1, wz, trunkHeight);
                        }
                        count++;
                        if (count % 100 === 0) {
                            if (onProgress) onProgress(0.5, '種植樹木...');
                            await new Promise(r => setTimeout(r, 0));
                        }
                    }
                }
            }
        }
    }

    placeTree(wx, baseY, wz, trunkHeight) {
        for (let dy = 0; dy < trunkHeight; dy++) {
            this.setBlockRaw(wx, baseY + dy, wz, WOOD);
        }
        const crownBase = baseY + trunkHeight - 3;
        const lea = this.treePerlin;
        for (let layer = 0; layer < 4; layer++) {
            const cy = crownBase + layer;
            let radius;
            if (layer === 0) radius = 2.3;
            else if (layer === 1) radius = 2.5;
            else if (layer === 2) radius = 1.8;
            else radius = 1.0;
            for (let dx = -Math.ceil(radius); dx <= Math.ceil(radius); dx++) {
                for (let dz = -Math.ceil(radius); dz <= Math.ceil(radius); dz++) {
                    const dist = Math.sqrt(dx * dx + dz * dz);
                    if (dist > radius + 0.01) continue;
                    if (dx === 0 && dz === 0 && layer < 3) continue;
                    const r = lea.noise2D((wx + dx) * 7.3 + layer * 3.7, (wz + dz) * 7.3 + layer * 3.7);
                    const threshold = -0.2 + (dist / radius) * 0.6;
                    if (r < threshold) continue;
                    const bx = wx + dx;
                    const bz = wz + dz;
                    if (this.getBlock(bx, cy, bz) === AIR) {
                        this.setBlockRaw(bx, cy, bz, LEAVES);
                    }
                }
            }
        }
        const topY = crownBase + 4;
        if (this.getBlock(wx, topY, wz) === AIR) {
            this.setBlockRaw(wx, topY, wz, LEAVES);
        }
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (dx === 0 && dz === 0) continue;
                if (Math.abs(dx) + Math.abs(dz) > 1) continue;
                const r = lea.noise2D((wx + dx) * 5.1, (wz + dz) * 5.1);
                if (r > 0.3) {
                    if (this.getBlock(wx + dx, topY, wz + dz) === AIR) {
                        this.setBlockRaw(wx + dx, topY, wz + dz, LEAVES);
                    }
                }
            }
        }
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

    updateDirtyChunks() {
        for (const chunk of this.chunks.values()) {
            if (chunk.dirty) {
                if (chunk.mesh) chunk.buildMesh();
                chunk.dirty = false;
            }
        }
    }

    updateChunkLoading(playerX, playerZ) {
        const cx = Math.floor(playerX / CHUNK_SIZE);
        const cz = Math.floor(playerZ / CHUNK_SIZE);
        if (cx === this._lastChunkCx && cz === this._lastChunkCz) return;
        this._lastChunkCx = cx;
        this._lastChunkCz = cz;

        const radius = this.renderDistance;
        const toLoad = [];

        for (const chunk of this.chunks.values()) {
            const dist = Math.max(Math.abs(chunk.cx - cx), Math.abs(chunk.cz - cz));
            if (dist <= radius) {
                if (!chunk.mesh) toLoad.push(chunk);
            } else {
                if (chunk.mesh) chunk.removeMesh();
            }
        }

        if (toLoad.length > 0 && !this._isLoading) {
            this._isLoading = true;
            this._loadingQueue = toLoad;
            this._loadNextBatch();
        }
    }

    _loadNextBatch() {
        if (this._loadingQueue.length === 0) {
            this._isLoading = false;
            return;
        }
        const batch = this._loadingQueue.splice(0, 2);
        for (const chunk of batch) {
            if (!chunk.mesh) chunk.buildMesh();
        }
        requestAnimationFrame(() => this._loadNextBatch());
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
