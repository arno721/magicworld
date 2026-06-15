import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, AIR, LEAVES, TRANSPARENT_BLOCKS } from './constants.js';

export class Chunk {
    constructor(cx, cz, world) {
        this.cx = cx;
        this.cz = cz;
        this.world = world;
        this.originX = cx * CHUNK_SIZE;
        this.originZ = cz * CHUNK_SIZE;
        this.data = new Uint8Array(CHUNK_SIZE * CHUNK_SIZE * WORLD_HEIGHT);
        this.mesh = null;
        this.dirty = true;
    }

    getIndex(lx, ly, lz) {
        return ly * CHUNK_SIZE * CHUNK_SIZE + lz * CHUNK_SIZE + lx;
    }

    getBlock(lx, ly, lz) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return AIR;
        return this.data[this.getIndex(lx, ly, lz)];
    }

    setBlock(lx, ly, lz, blockType) {
        if (lx < 0 || lx >= CHUNK_SIZE || ly < 0 || ly >= WORLD_HEIGHT || lz < 0 || lz >= CHUNK_SIZE) return;
        this.data[this.getIndex(lx, ly, lz)] = blockType;
        this.dirty = true;
    }

    getBlockWorld(wx, wy, wz) {
        const lx = wx - this.originX;
        const lz = wz - this.originZ;
        if (lx >= 0 && lx < CHUNK_SIZE && lz >= 0 && lz < CHUNK_SIZE && wy >= 0 && wy < WORLD_HEIGHT) {
            return this.getBlock(lx, wy, lz);
        }
        return this.world.getBlock(wx, wy, wz);
    }

    buildMesh() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.world.scene.remove(this.mesh);
            this.mesh = null;
        }

        const positions = [];
        const normals = [];
        const uvs = [];

        const addFace = (fx, fy, fz, nx, ny, nz, uv) => {
            const { u, v, u2, v2 } = uv;
            // Order: bottom-left, bottom-right, top-right, top-left
            let v1, v2c, v3, v4;
            if (ny !== 0) {
                const y = fy + (ny > 0 ? 1 : 0);
                v1 = [fx, y, fz]; v2c = [fx + 1, y, fz]; v3 = [fx + 1, y, fz + 1]; v4 = [fx, y, fz + 1];
            } else if (nz !== 0) {
                const z = fz + (nz > 0 ? 1 : 0);
                v1 = [fx, fy, z]; v2c = [fx + 1, fy, z]; v3 = [fx + 1, fy + 1, z]; v4 = [fx, fy + 1, z];
            } else {
                const x = fx + (nx > 0 ? 1 : 0);
                v1 = [x, fy, fz]; v2c = [x, fy, fz + 1]; v3 = [x, fy + 1, fz + 1]; v4 = [x, fy + 1, fz];
            }

            const verts = [v1, v2c, v3, v1, v3, v4];
            const uvVerts = [
                [u, v], [u2, v], [u2, v2],
                [u, v], [u2, v2], [u, v2],
            ];

            for (let i = 0; i < 6; i++) {
                const p = verts[i];
                positions.push(p[0], p[1], p[2]);
                normals.push(nx, ny, nz);
                uvs.push(uvVerts[i][0], uvVerts[i][1]);
            }
        };

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
                    const block = this.getBlock(lx, ly, lz);
                    if (block === AIR) continue;
                    const wx = this.originX + lx;
                    const wz = this.originZ + lz;

                    const neighbors = [
                        { dx: 0, dy: 1, dz: 0, nx: 0, ny: 1, nz: 0, faceKey: 'top' },
                        { dx: 0, dy: -1, dz: 0, nx: 0, ny: -1, nz: 0, faceKey: 'bottom' },
                        { dx: 1, dy: 0, dz: 0, nx: 1, ny: 0, nz: 0, faceKey: 'side' },
                        { dx: -1, dy: 0, dz: 0, nx: -1, ny: 0, nz: 0, faceKey: 'side' },
                        { dx: 0, dy: 0, dz: 1, nx: 0, ny: 0, nz: 1, faceKey: 'side' },
                        { dx: 0, dy: 0, dz: -1, nx: 0, ny: 0, nz: -1, faceKey: 'side' },
                    ];

                    for (const n of neighbors) {
                        const nwx = wx + n.dx;
                        const nwy = ly + n.dy;
                        const nwz = wz + n.dz;
                        const neighborBlock = this.getBlockWorld(nwx, nwy, nwz);

                        if (neighborBlock !== undefined && !TRANSPARENT_BLOCKS.has(neighborBlock)) continue;
                        if (block === neighborBlock && TRANSPARENT_BLOCKS.has(block)) continue;

                        const uv = this.world.getBlockUVs(block, n.faceKey);
                        addFace(wx, ly, wz, n.nx, n.ny, n.nz, uv);
                    }
                }
            }
        }

        if (positions.length === 0) {
            this.dirty = false;
            return;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
        geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
        geometry.computeBoundingSphere();

        const material = new THREE.MeshLambertMaterial({
            map: this.world.textureAtlas,
            side: THREE.DoubleSide,
        });
        this.mesh = new THREE.Mesh(geometry, material);
        this.mesh.position.set(0, 0, 0);
        this.mesh.castShadow = true;
        this.mesh.receiveShadow = true;
        this.world.scene.add(this.mesh);
        this.dirty = false;
    }

    dispose() {
        if (this.mesh) {
            this.mesh.geometry.dispose();
            this.mesh.material.dispose();
            this.world.scene.remove(this.mesh);
            this.mesh = null;
        }
        this.data = null;
    }
}
