import * as THREE from 'three';
import { Chunk } from './chunk.js';
import { PerlinNoise } from './perlin.js';
import {
    CHUNK_SIZE, WORLD_HEIGHT, CHUNKS_X, CHUNKS_Z,
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, REACH_DISTANCE
} from './constants.js';

export class World {
    constructor(scene) {
        this.scene = scene;
        this.chunks = new Map();
        this.perlin = new PerlinNoise(137);
        this.cavePerlin = new PerlinNoise(259);
        this.treePerlin = new PerlinNoise(381);
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

    generateAll(onProgress) {
        const totalChunks = CHUNKS_X * CHUNKS_Z;
        let done = 0;

        // 第一阶段：生成数据
        for (let cx = 0; cx < CHUNKS_X; cx++) {
            for (let cz = 0; cz < CHUNKS_Z; cz++) {
                const chunk = new Chunk(cx, cz, this);
                this.chunks.set(this.chunkKey(cx, cz), chunk);
                this.generateChunkData(chunk);
                done++;
                if (onProgress) onProgress(done / totalChunks * 0.6, '生成地形...');
            }
        }

        // 第二阶段：种树
        this.generateTrees();
        if (onProgress) onProgress(0.7, '种植树木...');

        // 第三阶段：构建网格
        let meshDone = 0;
        for (const chunk of this.chunks.values()) {
            chunk.buildMesh();
            meshDone++;
            if (onProgress) onProgress(0.7 + (meshDone / totalChunks) * 0.3, '构建区块...');
        }
    }

    generateChunkData(chunk) {
        const ox = chunk.originX;
        const oz = chunk.originZ;
        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                const wx = ox + lx;
                const wz = oz + lz;
                const heightNoise = this.perlin.octave2D(wx * 0.03, wz * 0.03, 5, 0.5, 2.2);
                const detailNoise = this.perlin.octave2D(wx * 0.08, wz * 0.08, 3, 0.35, 2.5) * 4;
                let surfaceY = Math.floor(20 + heightNoise * 18 + detailNoise);
                surfaceY = Math.max(3, Math.min(WORLD_HEIGHT - 6, surfaceY));
                const isSandy = surfaceY < 14 && heightNoise < -0.25;

                for (let y = 0; y < WORLD_HEIGHT; y++) {
                    let block = AIR;
                    if (y === 0) {
                        block = STONE;
                    } else if (y < surfaceY - 4) {
                        const caveVal = this.cavePerlin.octave3D(wx * 0.06, y * 0.06, wz * 0.06, 3, 0.5, 2.0);
                        const caveVal2 = this.cavePerlin.octave3D(wx * 0.09, y * 0.09, wz * 0.09, 2, 0.4, 2.3);
                        const isCave = (Math.abs(caveVal) < 0.22) || (Math.abs(caveVal2) < 0.18 && y > 4 && y < surfaceY - 6);
                        block = (isCave && y > 1) ? AIR : STONE;
                    } else if (y === surfaceY) {
                        block = isSandy ? SAND : GRASS;
                    } else if (y > surfaceY - 4 && y < surfaceY) {
                        block = isSandy ? SAND : DIRT;
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

    generateTrees() {
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
        const meshes = [];
        for (const chunk of this.chunks.values()) {
            if (chunk.mesh) meshes.push(chunk.mesh);
        }
        if (meshes.length === 0) return null;

        const raycaster = new THREE.Raycaster();
        raycaster.set(origin, direction.normalize());
        raycaster.far = maxDistance;
        const intersects = raycaster.intersectObjects(meshes, false);
        if (intersects.length === 0) return null;

        const hit = intersects[0];
        const point = hit.point.clone();
        const normal = hit.face.normal.clone();
        normal.transformDirection(hit.object.matrixWorld);

        const blockPos = new THREE.Vector3(
            Math.floor(point.x - normal.x * 0.5),
            Math.floor(point.y - normal.y * 0.5),
            Math.floor(point.z - normal.z * 0.5)
        );
        const placePos = new THREE.Vector3(
            Math.floor(point.x + normal.x * 0.5),
            Math.floor(point.y + normal.y * 0.5),
            Math.floor(point.z + normal.z * 0.5)
        );

        return { point, normal, blockPos, placePos, distance: hit.distance };
    }

    dispose() {
        for (const chunk of this.chunks.values()) chunk.dispose();
        this.chunks.clear();
    }
}