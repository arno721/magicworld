import * as THREE from 'three';
import { GRAVITY, JUMP_VELOCITY, MOVE_SPEED, PLAYER_WIDTH, PLAYER_HEIGHT, PLAYER_EYE_HEIGHT, PLAYER_HALF_W, AIR, LEAVES, WORLD_SIZE_X, WORLD_SIZE_Z, WORLD_HEIGHT } from './constants.js';

export class Player {
    constructor(camera, world) {
        this.camera = camera;
        this.world = world;
        this.position = new THREE.Vector3(WORLD_SIZE_X / 2, 40, WORLD_SIZE_Z / 2);
        this.velocity = new THREE.Vector3(0, 0, 0);
        this.onGround = false;
        this.wasOnGround = false;
        this.fallStartY = this.position.y;
        this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);

        // 生存屬性
        this.health = 20;
        this.maxHealth = 20;
        this.food = 20;
        this.maxFood = 20;
        this.alive = true;
        this.foodTimer = 0;
        this.damageTimer = 0;
        this.respawnPos = new THREE.Vector3(WORLD_SIZE_X / 2, 40, WORLD_SIZE_Z / 2);
    }

    getAABB(pos) {
        return {
            minX: pos.x - PLAYER_HALF_W, maxX: pos.x + PLAYER_HALF_W,
            minY: pos.y, maxY: pos.y + PLAYER_HEIGHT,
            minZ: pos.z - PLAYER_HALF_W, maxZ: pos.z + PLAYER_HALF_W,
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

    damage(amount) {
        if (!this.alive || this.damageTimer > 0) return;
        this.health = Math.max(0, this.health - amount);
        this.damageTimer = 0.5;
        if (this.health <= 0) {
            this.health = 0;
            this.alive = false;
            document.getElementById('death-screen').style.display = 'flex';
            document.exitPointerLock();
        }
    }

    heal(amount) {
        if (!this.alive) return;
        this.health = Math.min(this.maxHealth, this.health + amount);
    }

    eat(amount) {
        this.food = Math.min(this.maxFood, this.food + amount);
    }

    respawn() {
        this.alive = true;
        this.health = 20;
        this.food = 20;
        this.velocity.set(0, 0, 0);
        this.onGround = false;
        this.position.copy(this.respawnPos);
        this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
        document.getElementById('death-screen').style.display = 'none';
    }

    update(deltaTime, input) {
        if (!this.alive) return;

        const dt = Math.min(deltaTime, 0.2);

        if (this.damageTimer > 0) this.damageTimer -= dt;

        // 飢餓消耗與恢復
        this.foodTimer += dt;
        const isSprinting = input.sprint && this.food > 6;
        if (isSprinting) {
            this.foodTimer += dt * 0.5;
        }
        if (this.foodTimer > 10) {
            this.foodTimer = 0;
            if (this.food > 0) {
                this.food = Math.max(0, this.food - 1);
            }
        }
        // 飢餓傷害
        if (this.food <= 0) {
            this.damage(1);
        }
        // 食物恢復生命
        if (this.food > 18 && this.health < this.maxHealth && this.health > 0) {
            if (!this.healTimer) this.healTimer = 0;
            this.healTimer += dt;
            if (this.healTimer > 2.0) { // 每2秒恢復1血（半心）
                this.heal(1);
                this.healTimer = 0;
            }
        }

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

        const speed = isSprinting ? MOVE_SPEED * 1.5 : MOVE_SPEED;
        this.velocity.x = moveDir.x * speed;
        this.velocity.z = moveDir.z * speed;

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

        // Y 軸
        newPos.y += this.velocity.y * dt;
        let aabb = this.getAABB(newPos);
        if (this.checkCollision(aabb)) {
            if (this.velocity.y < 0) {
                // 掉落傷害
                const fallDist = this.fallStartY - newPos.y;
                if (fallDist > 3.5 && !this.wasOnGround) {
                    this.damage(Math.floor((fallDist - 3)));
                }
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

        // 記錄開始掉落的 Y 位置
        if (this.wasOnGround && !this.onGround && this.velocity.y < 0) {
            this.fallStartY = this.position.y;
        }

        const savedY = newPos.y;
        // X 軸
        newPos.x += this.velocity.x * dt;
        aabb = this.getAABB(new THREE.Vector3(newPos.x, savedY, newPos.z));
        if (this.checkCollision(aabb)) {
            newPos.x = this.position.x;
            this.velocity.x = 0;
        }

        // Z 軸
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
        this.wasOnGround = this.onGround;
        this.onGround = this.checkCollision(groundCheck);

        newPos.x = Math.max(PLAYER_HALF_W + 0.1, Math.min(WORLD_SIZE_X - PLAYER_HALF_W - 0.1, newPos.x));
        newPos.z = Math.max(PLAYER_HALF_W + 0.1, Math.min(WORLD_SIZE_Z - PLAYER_HALF_W - 0.1, newPos.z));
        newPos.y = Math.max(0, Math.min(WORLD_HEIGHT + 10, newPos.y));

        if (newPos.y < -10) {
            this.damage(20);
            if (this.alive) {
                newPos.set(WORLD_SIZE_X / 2, 40, WORLD_SIZE_Z / 2);
                this.velocity.set(0, 0, 0);
                this.onGround = false;
            }
        }

        this.position.copy(newPos);
        this.camera.position.set(this.position.x, this.position.y + PLAYER_EYE_HEIGHT, this.position.z);
    }
}
