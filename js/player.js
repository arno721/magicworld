import * as THREE from 'three';
import { GRAVITY, JUMP_VELOCITY, MOVE_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, PLAYER_HALF_W, AIR, LEAVES, WORLD_SIZE_X, WORLD_SIZE_Z, WORLD_HEIGHT } from './constants.js';

export class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        this.position = new THREE.Vector3(WORLD_SIZE_X / 2, 40, WORLD_SIZE_Z / 2);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
    }

    getAABB(pos) {
        return {
            minX: pos.x - PLAYER_HALF_W,
            maxX: pos.x + PLAYER_HALF_W,
            minY: pos.y,
            maxY: pos.y + PLAYER_HEIGHT,
            minZ: pos.z - PLAYER_HALF_W,
            maxZ: pos.z + PLAYER_HALF_W,
        };
    }

    checkCollision(aabb) {
        const minBX = Math.floor(aabb.minX);
        const maxBX = Math.floor(aabb.maxX - 0.001);
        const minBY = Math.floor(aabb.minY);
        const maxBY = Math.floor(aabb.maxY - 0.001);
        const minBZ = Math.floor(aabb.minZ);
        const maxBZ = Math.floor(aabb.maxZ - 0.001);

        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                for (let bz = minBZ; bz <= maxBZ; bz++) {
                    const block = this.world.getBlock(bx, by, bz);
                    if (block === AIR || block === LEAVES) continue;
                    if (aabb.maxX > bx && aabb.minX < bx + 1 &&
                        aabb.maxY > by && aabb.minY < by + 1 &&
                        aabb.maxZ > bz && aabb.minZ < bz + 1) {
                        return true;
                    }
                }
            }
        }
        return false;
    }

    update(deltaTime, input) {
        const dt = Math.min(deltaTime, 0.2);

        const forward = new THREE.Vector3();
        this.camera.getWorldDirection(forward);
        forward.y = 0;
        if (forward.length() < 0.001) forward.set(0, 0, -1);
        forward.normalize();
        const right = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0)).normalize();

        const moveDir = new THREE.Vector3();
        if (input.forward) moveDir.add(forward);
        if (input.backward) moveDir.sub(forward);
        if (input.left) moveDir.sub(right);
        if (input.right) moveDir.add(right);
        if (moveDir.length() > 1) moveDir.normalize();

        this.velocity.x = moveDir.x * MOVE_SPEED;
        this.velocity.z = moveDir.z * MOVE_SPEED;

        if (!this.onGround) {
            this.velocity.y -= GRAVITY * dt;
        } else {
            this.velocity.y = Math.min(this.velocity.y, 0);
        }

        if (input.jump && this.onGround) {
            this.velocity.y = JUMP_VELOCITY;
            this.onGround = false;
            input.jump = false;
        }

        const newPos = this.position.clone();

        // Y 轴
        newPos.y += this.velocity.y * dt;
        let aabb = this.getAABB(newPos);
        if (this.checkCollision(aabb)) {
            if (this.velocity.y < 0) {
                newPos.y = Math.floor(this.position.y);
                aabb = this.getAABB(new THREE.Vector3(newPos.x, newPos.y, newPos.z));
                if (this.checkCollision(aabb)) newPos.y = this.position.y;
                this.velocity.y = 0;
                this.onGround = true;
            } else {
                newPos.y = this.position.y;
                this.velocity.y = 0;
            }
        } else {
            this.onGround = false;
        }

        const savedY = newPos.y;
        // X 轴
        newPos.x += this.velocity.x * dt;
        aabb = this.getAABB(new THREE.Vector3(newPos.x, savedY, newPos.z));
        if (this.checkCollision(aabb)) {
            newPos.x = this.position.x;
            this.velocity.x = 0;
        }

        // Z 轴
        newPos.z += this.velocity.z * dt;
        aabb = this.getAABB(new THREE.Vector3(newPos.x, savedY, newPos.z));
        if (this.checkCollision(aabb)) {
            newPos.z = this.position.z;
            this.velocity.z = 0;
        }
        newPos.y = savedY;

        aabb = this.getAABB(newPos);
        if (this.checkCollision(aabb)) {
            newPos.y = this.position.y;
            this.velocity.y = 0;
        }

        const groundCheck = this.getAABB(new THREE.Vector3(newPos.x, newPos.y - 0.05, newPos.z));
        this.onGround = this.checkCollision(groundCheck);

        newPos.x = Math.max(PLAYER_HALF_W + 0.1, Math.min(WORLD_SIZE_X - PLAYER_HALF_W - 0.1, newPos.x));
        newPos.z = Math.max(PLAYER_HALF_W + 0.1, Math.min(WORLD_SIZE_Z - PLAYER_HALF_W - 0.1, newPos.z));
        newPos.y = Math.max(0, Math.min(WORLD_HEIGHT + 10, newPos.y));

        if (newPos.y < -10) {
            newPos.set(WORLD_SIZE_X / 2, 40, WORLD_SIZE_Z / 2);
            this.velocity.set(0, 0, 0);
            this.onGround = false;
        }

        this.position.copy(newPos);
        this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
    }
}