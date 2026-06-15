import * as THREE from 'three';
import { AIR, REACH_DISTANCE } from './constants.js';

// 法術定義
const SPELLS = {
    FIREBALL: {
        name: '火球術', manaCost: 25, damage: 6,
        description: '發射火球，爆炸半徑2格',
    },
    HEAL: {
        name: '治療術', manaCost: 30, heal: 8,
        description: '恢復4顆心',
    },
    LIGHT: {
        name: '照明術', manaCost: 15,
        description: '創造持續光源',
    },
    TELEPORT: {
        name: '傳送術', manaCost: 40,
        description: '瞬間移動8格',
    },
};

const SPELL_LIST = Object.values(SPELLS);

export class MagicSystem {
    constructor(world, player, camera, scene, inventory) {
        this.world = world;
        this.player = player;
        this.camera = camera;
        this.scene = scene;
        this.inventory = inventory;
        this.mana = 100;
        this.maxMana = 100;
        this.manaRegenDelay = 0;
        this.selectedSpell = 0;
        this.active = false;
        this.lights = [];
        this.projectiles = [];
    }

    getSpell() { return SPELL_LIST[this.selectedSpell] || SPELL_LIST[0]; }

    cycleSpell(direction = 1) {
        this.selectedSpell = (this.selectedSpell + direction + SPELL_LIST.length) % SPELL_LIST.length;
        this.updateSpellHUD();
    }

    updateSpellHUD() {
        const el = document.getElementById('spell-hud');
        if (!el) return;
        const spell = this.getSpell();
        el.textContent = `✦ ${spell.name} (${spell.manaCost} MP)`;
    }

    toggle(force = null) {
        this.active = force !== null ? force : !this.active;
        document.getElementById('spell-hud').style.display = this.active ? 'block' : 'none';
        if (this.active) this.updateSpellHUD();
    }

    update(deltaTime) {
        // 魔力恢復（每2秒恢復5點）
        if (this.manaRegenDelay > 0) {
            this.manaRegenDelay -= deltaTime;
        } else if (this.mana < this.maxMana) {
            this.mana = Math.min(this.maxMana, this.mana + 5 * deltaTime);
            if (this.mana >= this.maxMana) this.mana = this.maxMana;
        }

        // 更新投射物
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const p = this.projectiles[i];
            if (this.updateProjectile(p, deltaTime)) {
                this.projectiles.splice(i, 1);
            }
        }

        this.updateManaHUD();
    }

    updateManaHUD() {
        const fill = document.getElementById('mana-fill');
        const text = document.getElementById('mana-text');
        if (fill) fill.style.width = `${(this.mana / this.maxMana) * 100}%`;
        if (text) text.textContent = `${Math.floor(this.mana)}/${this.maxMana}`;
    }

    cast() {
        if (!this.active) return;
        const spell = this.getSpell();
        if (this.mana < spell.manaCost) {
            this.showMessage('魔力不足！');
            return;
        }
        if (!this.player.alive) return;

        this.mana -= spell.manaCost;
        this.manaRegenDelay = 1.0;

        switch (spell) {
            case SPELLS.FIREBALL: this.castFireball(); break;
            case SPELLS.HEAL: this.castHeal(); break;
            case SPELLS.LIGHT: this.castLight(); break;
            case SPELLS.TELEPORT: this.castTeleport(); break;
        }
    }

    showMessage(msg) {
        const el = document.getElementById('block-indicator');
        if (!el) return;
        el.textContent = msg;
        el.style.opacity = '1';
        clearTimeout(el._timeout);
        el._timeout = setTimeout(() => { el.style.opacity = '0'; }, 1500);
    }

    // === 法術實作 ===

    castFireball() {
        const origin = this.camera.position.clone();
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);

        // 創建火球投射物
        const geo = new THREE.SphereGeometry(0.3, 8, 8);
        const mat = new THREE.MeshBasicMaterial({ color: 0xff4400 });
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.copy(origin).add(direction.clone().multiplyScalar(1.5));
        this.scene.add(mesh);

        // 粒子效果
        const glowGeo = new THREE.SphereGeometry(0.5, 6, 6);
        const glowMat = new THREE.MeshBasicMaterial({ color: 0xff8800, transparent: true, opacity: 0.4 });
        const glow = new THREE.Mesh(glowGeo, glowMat);
        glow.position.copy(mesh.position);
        this.scene.add(glow);

        this.projectiles.push({
            mesh, glow,
            velocity: direction.clone().multiplyScalar(25),
            life: 2.0,
            type: 'fireball',
            originBlock: {
                x: Math.floor(origin.x), y: Math.floor(origin.y), z: Math.floor(origin.z),
            },
        });
    }

    updateProjectile(p, dt) {
        p.life -= dt;
        if (p.life <= 0) {
            this.explode(p.mesh.position);
            p.mesh.geometry.dispose(); p.mesh.material.dispose();
            p.glow.geometry.dispose(); p.glow.material.dispose();
            this.scene.remove(p.mesh);
            this.scene.remove(p.glow);
            return true;
        }

        const newPos = p.mesh.position.clone().add(p.velocity.clone().multiplyScalar(dt));
        const blockX = Math.floor(newPos.x);
        const blockY = Math.floor(newPos.y);
        const blockZ = Math.floor(newPos.z);

        // 檢查是否撞到方塊（跳過發射者所在方塊）
        if (blockX !== p.originBlock.x || blockY !== p.originBlock.y || blockZ !== p.originBlock.z) {
            if (this.world.getBlock(blockX, blockY, blockZ) !== AIR) {
                this.explode(newPos);
                p.mesh.geometry.dispose(); p.mesh.material.dispose();
                p.glow.geometry.dispose(); p.glow.material.dispose();
                this.scene.remove(p.mesh);
                this.scene.remove(p.glow);
                return true;
            }
        }

        p.mesh.position.copy(newPos);
        p.glow.position.copy(newPos);
        p.glow.material.opacity = 0.3 + Math.sin(p.life * 10) * 0.15;
        p.mesh.scale.setScalar(1 + Math.sin(p.life * 15) * 0.1);
        return false;
    }

    explode(position) {
        const radius = 2;
        const cx = Math.floor(position.x);
        const cy = Math.floor(position.y);
        const cz = Math.floor(position.z);

        for (let dx = -radius; dx <= radius; dx++) {
            for (let dy = -radius; dy <= radius; dy++) {
                for (let dz = -radius; dz <= radius; dz++) {
                    const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
                    if (dist > radius + 0.5) continue;
                    const bx = cx + dx;
                    const by = cy + dy;
                    const bz = cz + dz;
                    const block = this.world.getBlock(bx, by, bz);
                    if (block !== AIR) {
                        this.world.setBlock(bx, by, bz, AIR);
                        this.inventory.addBlock(block);
                    }
                }
            }
        }
        this.world.updateDirtyChunks();

        // 爆炸閃光
        const flash = new THREE.Mesh(
            new THREE.SphereGeometry(radius, 12, 12),
            new THREE.MeshBasicMaterial({ color: 0xff6600, transparent: true, opacity: 0.6 })
        );
        flash.position.set(cx + 0.5, cy + 0.5, cz + 0.5);
        this.scene.add(flash);
        setTimeout(() => {
            flash.geometry.dispose();
            flash.material.dispose();
            this.scene.remove(flash);
        }, 300);

        this.showMessage('💥 火球爆炸！');
    }

    castHeal() {
        const spell = SPELLS.HEAL;
        if (this.player.health >= this.player.maxHealth) {
            this.showMessage('生命已滿');
            this.mana += spell.manaCost;
            return;
        }
        this.player.heal(spell.heal);
        this.showMessage(`✨ 恢復 ${spell.heal} 點生命`);
    }

    castLight() {
        const origin = this.camera.position.clone();
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        const result = this.world.raycastBlock(origin, direction, REACH_DISTANCE);
        if (!result || !result.placePos) {
            this.showMessage('⛔ 沒有可放置的目標');
            this.mana += SPELLS.LIGHT.manaCost;
            return;
        }
        const pp = result.placePos;
        const block = this.world.getBlock(pp.x, pp.y, pp.z);
        if (block !== AIR) {
            this.showMessage('⛔ 該位置已被佔用');
            this.mana += SPELLS.LIGHT.manaCost;
            return;
        }

        // 創建光源（發光方塊 + 點光源）
        const light = new THREE.PointLight(0xffdd88, 1.5, 12);
        light.position.set(pp.x + 0.5, pp.y + 0.5, pp.z + 0.5);
        this.scene.add(light);

        const glowMesh = new THREE.Mesh(
            new THREE.SphereGeometry(0.15, 6, 6),
            new THREE.MeshBasicMaterial({ color: 0xffee88 })
        );
        glowMesh.position.copy(light.position);
        this.scene.add(glowMesh);

        this.lights.push({
            x: pp.x, y: pp.y, z: pp.z,
            light, glowMesh, timer: 120, // 120秒後消失
        });

        this.showMessage('💡 創造光源');
    }

    castTeleport() {
        const direction = new THREE.Vector3();
        this.camera.getWorldDirection(direction);
        direction.y = Math.max(0, direction.y * 0.3);
        direction.normalize();

        const dist = 8;
        const target = this.player.position.clone().add(direction.clone().multiplyScalar(dist));
        target.x = Math.floor(target.x) + 0.5;
        target.z = Math.floor(target.z) + 0.5;

        // 檢查目標位置是否可通行
        const aabb = this.player.getAABB(target);
        const minBX = Math.floor(aabb.minX);
        const maxBX = Math.floor(aabb.maxX - 0.001);
        const minBY = Math.floor(aabb.minY);
        const maxBY = Math.floor(aabb.maxY - 0.001);
        const minBZ = Math.floor(aabb.minZ);
        const maxBZ = Math.floor(aabb.maxZ - 0.001);

        for (let bx = minBX; bx <= maxBX; bx++) {
            for (let by = minBY; by <= maxBY; by++) {
                for (let bz = minBZ; bz <= maxBZ; bz++) {
                    if (this.world.getBlock(bx, by, bz) !== AIR) {
                        this.showMessage('⛔ 目標位置被阻擋');
                        this.mana += SPELLS.TELEPORT.manaCost;
                        return;
                    }
                }
            }
        }

        this.player.position.copy(target);
        this.player.velocity.set(0, 0, 0);
        this.player.camera.position.set(target.x, target.y + 1.6, target.z);

        this.showMessage('⚡ 瞬間移動');
    }

    updateLights() {
        for (let i = this.lights.length - 1; i >= 0; i--) {
            const l = this.lights[i];
            l.timer--;
            if (l.timer <= 0) {
                this.scene.remove(l.light);
                l.glowMesh.geometry.dispose();
                l.glowMesh.material.dispose();
                this.scene.remove(l.glowMesh);
                this.lights.splice(i, 1);
            }
        }
    }
}
