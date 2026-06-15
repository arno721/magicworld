import * as THREE from 'three';
import { CHUNK_SIZE, WORLD_HEIGHT, AIR, LEAVES, BLOCK_COLORS } from './constants.js';

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

    // 获取世界坐标下的方块，自动处理边界
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
        const colors = [];

        const addFace = (fx, fy, fz, nx, ny, nz, c1, c2, c3, c4) => {
            const addVert = (vx, vy, vz, cx, cy, cz) => {
                positions.push(vx, vy, vz);
                normals.push(nx, ny, nz);
                colors.push(cx, cy, cz);
            };
            if (ny !== 0) {
                const y = fy + (ny > 0 ? 1 : 0);
                addVert(fx, y, fz, ...c1);
                addVert(fx + 1, y, fz, ...c2);
                addVert(fx + 1, y, fz + 1, ...c3);
                addVert(fx, y, fz, ...c1);
                addVert(fx + 1, y, fz + 1, ...c3);
                addVert(fx, y, fz + 1, ...c4);
            } else if (nz !== 0) {
                const z = fz + (nz > 0 ? 1 : 0);
                addVert(fx, fy, z, ...c1);
                addVert(fx + 1, fy, z, ...c2);
                addVert(fx + 1, fy + 1, z, ...c3);
                addVert(fx, fy, z, ...c1);
                addVert(fx + 1, fy + 1, z, ...c3);
                addVert(fx, fy + 1, z, ...c4);
            } else {
                const x = fx + (nx > 0 ? 1 : 0);
                addVert(x, fy, fz, ...c1);
                addVert(x, fy, fz + 1, ...c2);
                addVert(x, fy + 1, fz + 1, ...c3);
                addVert(x, fy, fz, ...c1);
                addVert(x, fy + 1, fz + 1, ...c3);
                addVert(x, fy + 1, fz, ...c4);
            }
        };

        const getBlockColorInfo = (blockType) => {
            const info = BLOCK_COLORS[blockType] || BLOCK_COLORS[3];
            if (info.all) return { uniform: true, color: info.all };
            return {
                uniform: false,
                top: info.top || [0.5,0.5,0.5],
                sideTop: info.sideTop || [0.5,0.5,0.5],
                sideBottom: info.sideBottom || [0.5,0.5,0.5],
                bottom: info.bottom || [0.5,0.5,0.5],
            };
        };

        for (let lx = 0; lx < CHUNK_SIZE; lx++) {
            for (let lz = 0; lz < CHUNK_SIZE; lz++) {
                for (let ly = 0; ly < WORLD_HEIGHT; ly++) {
                    const block = this.getBlock(lx, ly, lz);
                    if (block === AIR) continue;
                    const wx = this.originX + lx;
                    const wz = this.originZ + lz;
                    const colorInfo = getBlockColorInfo(block);

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
                        if (neighborBlock !== AIR && neighborBlock !== undefined &&
                            !(neighborBlock === LEAVES && block !== LEAVES) &&
                            !(neighborBlock === LEAVES && block === LEAVES)) {
                            if (neighborBlock !== LEAVES || block !== LEAVES) continue;
                        }
                        if (neighborBlock === LEAVES && block !== LEAVES) continue;
                        if (neighborBlock === AIR || neighborBlock === undefined || neighborBlock === LEAVES) {
                            let c1, c2, c3, c4;
                            if (colorInfo.uniform) {
                                c1 = c2 = c3 = c4 = colorInfo.color;
                            } else {
                                if (n.faceKey === 'top') c1 = c2 = c3 = c4 = colorInfo.top;
                                else if (n.faceKey === 'bottom') c1 = c2 = c3 = c4 = colorInfo.bottom;
                                else {
                                    c1 = colorInfo.sideTop;
                                    c2 = colorInfo.sideTop;
                                    c3 = colorInfo.sideBottom;
                                    c4 = colorInfo.sideBottom;
                                }
                            }
                            addFace(wx, ly, wz, n.nx, n.ny, n.nz, c1, c2, c3, c4);
                        }
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
        geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
        geometry.computeBoundingSphere();

        const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.FrontSide });
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