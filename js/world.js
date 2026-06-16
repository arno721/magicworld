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
        // 标记相邻区块
        if (lx === 0) { const nc = this.getChunk(cx - 1, cz); if (nc) nc.dirty = true; }
        if (lx === CHUNK_SIZE - 1) { const nc = this.getChunk(cx + 1, cz); if (nc) nc.dirty = true; }
        if (lz === 0) { const nc = this.getChunk(cx, cz - 1); if (nc) nc.dirty = true; }
        if (lz === CHUNK_SIZE - 1) { const nc = this.getChunk(cx, cz + 1); if (nc) nc.dirty = true; }
    }

    async generateAll(onProgress) {
        const totalChunks = CHUNKS_X * CHUNKS_Z;
        let done = 0;

        // 第一阶段：生成数据（分批處理，每批後讓出主線程）
        const BATCH = 4;
        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cz = 0; cz < CHUNKS_Z; cz++) {
                const chunk = new Chunk(cx, cz, this);
                this.chunks.set(this.chunkKey(cx, cz), chunk);
                this.generateChunkData(chunk);
                done++;
                if (onProgress) onProgress(done / totalChunks * 0.6, '生成地形...');
                if (done % BATCH === 0) {
                    await new Promise(r => setTimeout(r, 0));
                }
            }
        }

        // 第二阶段：种树
        await this.generateTrees();
        if (onProgress) onProgress(0.7, '种植树木...');
        await new Promise(r => setTimeout(r, 0));

        // 第三阶段：构建网格
        let meshDone = 0;
        for (const chunk of this.chunks.values()) {
            chunk.buildMesh();
            meshDone++;
            if (onProgress) onProgress(0.7 + (meshDone / totalChunks) * 0.3, '构建区块...');
            if (meshDone % BATCH === 0) {
                await new Promise(r => setTimeout(r, 0));
            }
        }
    }

    generateChunkData(chunk) {
        const ox = chunk.originX;
        const oz = chunk.originZ;
        const oreNoise = new PerlinNoise(777);
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx;
                const wz = oz + lz;

                // 更平滑的地形：使用6個八度，更低的頻率，更連續的過渡
                const heightNoise = this.perlin.octave2D(wx * 0.025, wz * 0.025, 6, 0.55, 2.0);
                const detailNoise = this.perlin.octave2D(wx * 0.06, wz * 0.06, 3, 0.3, 2.5) * 3;
                const ridgeNoise = Math.abs(this.perlin.octave2D(wx * 0.04, wz * 0.04, 3, 0.5, 2.0) - 0.5) * 2;

                // 地形高度計算：基礎 + 噪聲 * 幅度 + 細節 + 偶爾的山脊
                let surfaceY = Math.floor(24 + heightNoise * 20 + detailNoise + ridgeNoise * 6);
                surfaceY = Math.max(4, Math.min(WORLD_HEIGHT - 8, surfaceY));
                const isSandy = surfaceY < 16 && heightNoise < -0.2;

                // 決定生物群落：草/雪地/沙漠
                const biomeTemp = this.perlin.octave2D(wx * 0.008, wz * 0.008, 3, 0.5, 2.0);
                const isCold = biomeTemp < 0.3;

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let block = AIR;
                    if (y <= 3) {
                        // 基岩層：y=0~3 逐步過渡
                        if (y === 0) { block = BEDROCK; }
                        else if (y === 1) { block = Math.random() < 0.7 ? BEDROCK : STONE; }
                        else if (y === 2) { block = Math.random() < 0.3 ? BEDROCK : STONE; }
                        else { block = STONE; }
                    } else if (y < surfaceY - 4) {
                        // 洞穴生成
                        const caveVal = this.cavePerlin.octave3D(wx * 0.05, y * 0.05, wz * 0.05, 4, 0.5, 2.0);
                        const caveVal2 = this.cavePerlin.octave3D(wx * 0.08, y * 0.08, wz * 0.08, 3, 0.4, 2.3);
                        const isCave = (Math.abs(caveVal) < 0.20) || (Math.abs(caveVal2) < 0.16 && y > 6 && y < surfaceY - 8);
                        if (isCave && y > 2) {
                            block = AIR;
                        } else {
                            block = STONE;
                            // 礦物生成（只在石頭中）
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
            }
        }
    }

    findSurfaceY(wx, wz) {
        for (let y = WORLD_HEIGHT - 1; y >= 0; y--) {
            if (this.getBlock(wx, y, wz) !== AIR) return y;
        }
        return 0;
    }

    async generateTrees() {
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
                        if (treeRand > 0.35 && treeRand < 0.55) {
                            const trunkHeight = 4 + Math.floor(Math.abs(this.treePerlin.noise2D(wx * 5.3, wz * 5.3)) * 3);
                            this.placeTree(wx, surfaceY + 1, wz, trunkHeight);
                        }
                        count++;
                        if (count % 500 === 0) {
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
        const crownBase = baseY + trunkHeight - 2;
        for (let dy = 0; dy < 5; dy++) {
            const cy = crownBase + dy;
            const radius = dy < 2 ? 2 : (dy < 4 ? 1 : 0);
            for (let dx = -radius; dx <= radius; dx++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    if (dx === 0 && dz === 0 && dy < 3) continue;
                    if (Math.abs(dx) === radius && Math.abs(dz) === radius && Math.random() > 0.6) continue;
                    const bx = wx + dx;
                    const bz = wz + dz;
                    if (this.getBlock(bx, cy, bz) === AIR) {
                        this.setBlockRaw(bx, cy, bz, LEAVES);
                    }
                }
            }
        }
        const topY = crownBase + 5;
        for (let dx = -1; dx <= 1; dx++) {
            for (let dz = -1; dz <= 1; dz++) {
                if (Math.abs(dx) === 1 && Math.abs(dz) === 1) continue;
                const bx = wx + dx;
                const bz = wz + dz;
                if (this.getBlock(bx, topY, bz) === AIR) {
                    this.setBlockRaw(bx, topY, bz, LEAVES);
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
            if (chunk.dirty) chunk.buildMesh();
        }
    }

    raycastBlock(origin, direction, maxDistance = REACH_DISTANCE) {
        // DDA 體素射線追蹤（Minecraft 標準演算法）
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