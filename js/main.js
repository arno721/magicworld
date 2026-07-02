import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { MagicSystem } from './magic.js';
import {
    HOTBAR_SIZE,
    BLOCK_NAMES,
    AIR,
    REACH_DISTANCE,
    CRAFTING_TABLE,
    BLOCK_HARDNESS,
    PICKUP_RADIUS,
    DROPPED_ITEM_LIFETIME,
    DROPPED_ITEM_GRAVITY,
} from './constants.js';
import { findRecipe, getRecipeOutput } from './crafting.js';

const container = document.getElementById('canvas-container');
const loadingEl = document.getElementById('loading');
const loadBar = document.getElementById('load-bar');
const loadText = document.getElementById('load-text');
const hotbarEl = document.getElementById('hotbar');
const blockIndicator = document.getElementById('block-indicator');

let selectedSlot = 0;
let isLocked = false;
let inventoryOpen = false;
let escOpen = false;
let craftingOpen = false;
let targetBlockPos = null;
let pendingMoveSlot = null;

let isDestroying = false;
let destroyTargetKey = '';
let destroyBlockType = AIR;
let destroyProgress = 0;

const droppedItems = [];
const droppedItemGeometry = new THREE.BoxGeometry(0.3, 0.3, 0.3);
const droppedItemMaterialCache = new Map();

const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, duration, type = 'square', volume = 0.15) {
    try {
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(volume, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch {
        // ignore audio errors on unsupported contexts
    }
}

function playDestroySound() {
    playTone(200, 0.08, 'square', 0.1);
    setTimeout(() => playTone(150, 0.06, 'square', 0.08), 50);
}

function playPlaceSound() {
    playTone(300, 0.06, 'triangle', 0.1);
    setTimeout(() => playTone(350, 0.04, 'triangle', 0.08), 30);
}

function playHitSound() {
    playTone(120, 0.04, 'sawtooth', 0.06);
}

const overlayGeo = new THREE.EdgesGeometry(new THREE.BoxGeometry(1.001, 1.001, 1.001));
const overlayMat = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 });
const overlayMesh = new THREE.LineSegments(overlayGeo, overlayMat);
overlayMesh.visible = false;

const skyUniforms = {
    topColor: { value: new THREE.Color(0x0066cc) },
    horizonColor: { value: new THREE.Color(0x87ceeb) },
    bottomColor: { value: new THREE.Color(0xccddee) },
    cloudColor1: { value: new THREE.Color(0xffffff) },
    cloudColor2: { value: new THREE.Color(0xc8d0d8) },
    sunColor: { value: new THREE.Color(0xffdd44) },
    sunDir: { value: new THREE.Vector3(0.3, 0.7, 0.5).normalize() },
    time: { value: 0 },
};

function createSky() {
    const skyGeo = new THREE.SphereGeometry(400, 64, 40);
    const skyMat = new THREE.ShaderMaterial({
        side: THREE.BackSide,
        uniforms: skyUniforms,
        vertexShader: `
            varying vec3 vPos;
            varying vec3 vNorm;
            void main() {
                vec4 wp = modelMatrix * vec4(position, 1.0);
                vPos = wp.xyz;
                vNorm = normalize(normalMatrix * normal);
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: `
            uniform vec3 topColor;
            uniform vec3 horizonColor;
            uniform vec3 bottomColor;
            uniform vec3 cloudColor1;
            uniform vec3 cloudColor2;
            uniform vec3 sunColor;
            uniform vec3 sunDir;
            uniform float time;
            varying vec3 vPos;
            varying vec3 vNorm;

            float hash(vec2 p) {
                return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453123);
            }
            float noise(vec2 p) {
                vec2 i = floor(p);
                vec2 f = fract(p);
                f = f * f * (3.0 - 2.0 * f);
                return mix(mix(hash(i), hash(i + vec2(1.0,0.0)), f.x),
                           mix(hash(i + vec2(0.0,1.0)), hash(i + vec2(1.0,1.0)), f.x), f.y);
            }
            float fbm(vec2 p) {
                float v = 0.0, a = 0.5;
                for (int i = 0; i < 4; i++) {
                    v += a * noise(p);
                    p *= 2.0;
                    a *= 0.5;
                }
                return v;
            }

            void main() {
                vec3 dir = normalize(vPos);
                float h = dir.y;
                float skyMix = smoothstep(-0.05, 0.5, h);
                vec3 skyCol = mix(horizonColor, topColor, skyMix);

                vec2 uv = dir.xz / (abs(dir.y) + 0.05) * 0.04;
                uv += time * 0.002;
                float c = fbm(uv);
                float cm = smoothstep(0.45, 0.65, c);
                float hMask = smoothstep(0.1, 0.3, h);
                cm *= hMask;
                vec3 cloudCol = mix(cloudColor2, cloudColor1, smoothstep(0.45, 0.7, c));
                skyCol = mix(skyCol, cloudCol, cm * 0.9);

                float sa = max(dot(dir, sunDir), 0.0);
                float disk = smoothstep(0.9995, 1.0, sa);
                float glow = smoothstep(0.98, 1.0, sa) * 0.6;
                skyCol = mix(skyCol, sunColor, clamp(disk + glow, 0.0, 1.0));

                gl_FragColor = vec4(skyCol, 1.0);
            }
        `,
    });
    return new THREE.Mesh(skyGeo, skyMat);
}

function selectSlot(index) {
    selectedSlot = index;
    inventory.selectSlot(index);
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('selected', i === index));
}

function showBlockIndicator(msg, ttl = 1200) {
    blockIndicator.textContent = msg;
    blockIndicator.style.opacity = '1';
    clearTimeout(blockIndicator._timeout);
    if (ttl > 0) {
        blockIndicator._timeout = setTimeout(() => {
            blockIndicator.style.opacity = '0';
        }, ttl);
    }
}

function showDestroyIndicator(msg) {
    clearTimeout(blockIndicator._timeout);
    blockIndicator.textContent = msg;
    blockIndicator.style.opacity = '1';
}

function hideBlockIndicator() {
    clearTimeout(blockIndicator._timeout);
    blockIndicator.style.opacity = '0';
}

function setMoveSource(slotIndex) {
    pendingMoveSlot = slotIndex;
    const slot = inventory.getSlot(slotIndex);
    const label = slot && slot.count > 0 ? `${BLOCK_NAMES[slot.blockType] || '未知'}x${slot.count}` : '空槽';
    showBlockIndicator(`已選擇欄位 ${slotIndex + 1} (${label})，再點一次其他欄位移動`);
    buildHotbar(world?.createBlockPreview);
    buildInventoryScreen(world?.createBlockPreview);
}

function clearMoveSource() {
    pendingMoveSlot = null;
    buildHotbar(world?.createBlockPreview);
    buildInventoryScreen(world?.createBlockPreview);
}

function onInventorySlotClick(slotIndex, isHotbar = false) {
    const fromSlot = inventory.getSlot(slotIndex);
    if (!fromSlot) return;

    if (pendingMoveSlot === null) {
        if (isHotbar) selectSlot(slotIndex);
        setMoveSource(slotIndex);
        return;
    }

    if (pendingMoveSlot === slotIndex) {
        clearMoveSource();
        return;
    }

    const moved = inventory.moveStack(pendingMoveSlot, slotIndex);
    if (!moved) {
        showBlockIndicator('此欄位無法接收該堆疊');
    } else {
        buildHotbar(world.createBlockPreview);
        buildInventoryScreen(world.createBlockPreview);
        if (isHotbar) selectSlot(slotIndex);
        showBlockIndicator('已移動 / 交換欄位');
    }
    clearMoveSource();
}

function setDestroyTarget(target) {
    if (!target) {
        isDestroying = false;
        destroyTargetKey = '';
        destroyProgress = 0;
        destroyBlockType = AIR;
        hideBlockIndicator();
        return;
    }
    destroyBlockType = target;
}

function stopDestroying() {
    isDestroying = false;
    destroyProgress = 0;
    destroyTargetKey = '';
    destroyBlockType = AIR;
    hideBlockIndicator();
}

function getTargetKey(vec) {
    return `${vec.x},${vec.y},${vec.z}`;
}

function buildHotbar(previewFn) {
    hotbarEl.innerHTML = '';
    const hotbarSlots = inventory.getHotbarSlots();

    for (let i = 0; i < HOTBAR_SIZE; i++) {
        const slotData = hotbarSlots[i] || { blockType: AIR, count: 0 };
        const slot = document.createElement('div');
        slot.className = 'slot';
        slot.dataset.index = i;
        if (i === selectedSlot) slot.classList.add('selected');
        if (pendingMoveSlot === i) slot.classList.add('move-source');

        if (slotData.blockType !== AIR && slotData.count > 0 && previewFn) {
            const preview = previewFn(slotData.blockType, 40);
            if (preview) {
                preview.className = 'block-preview';
                preview.style.width = '100%';
                preview.style.height = '100%';
                slot.appendChild(preview);
            }
        }

        const count = document.createElement('span');
        count.className = 'slot-number';
        count.textContent = slotData.count > 0 ? slotData.count : '';
        slot.appendChild(count);

        slot.addEventListener('click', () => onInventorySlotClick(i, true));
        hotbarEl.appendChild(slot);
    }
}

let invCraftGrid = Array(2).fill(null).map(() => Array(2).fill(AIR));

function buildInventoryScreen(previewFn) {
    const grid = document.getElementById('inv-grid');
    grid.innerHTML = '';

    for (let i = 0; i < inventory.size; i++) {
        const slot = inventory.slots[i];
        const div = document.createElement('div');
        div.className = 'inv-slot';
        if (pendingMoveSlot === i) div.classList.add('move-source');

        if (slot.count > 0 && previewFn) {
            const canvas = previewFn(slot.blockType, 28);
            if (canvas) {
                canvas.className = 'block-preview';
                canvas.style.width = '28px';
                canvas.style.height = '28px';
                div.appendChild(canvas);
            }
            const cnt = document.createElement('span');
            cnt.className = 'count';
            cnt.textContent = slot.count;
            div.appendChild(cnt);
        }

        div.addEventListener('click', () => onInventorySlotClick(i, false));
        grid.appendChild(div);
    }

    const craftGrid = document.getElementById('inv-craft-grid');
    craftGrid.innerHTML = '';
    for (let y = 0; y < 2; y++) {
        for (let x = 0; x < 2; x++) {
            const div = document.createElement('div');
            div.className = 'craft-slot';
            const block = invCraftGrid[y][x];
            if (block !== AIR && previewFn) {
                const canvas = previewFn(block, 24);
                if (canvas) {
                    canvas.style.width = '24px';
                    canvas.style.height = '24px';
                    div.appendChild(canvas);
                }
            }
            div.addEventListener('click', () => {
                if (invCraftGrid[y][x] !== AIR) {
                    inventory.addBlock(invCraftGrid[y][x], 1);
                    invCraftGrid[y][x] = AIR;
                } else {
                    const bt = inventory.getSelectedBlock();
                    if (bt !== AIR && inventory.hasBlock(bt, 1)) {
                        inventory.removeBlock(bt, 1);
                        invCraftGrid[y][x] = bt;
                    }
                }
                buildInventoryScreen(previewFn);
                buildHotbar(previewFn);
            });
            craftGrid.appendChild(div);
        }
    }

    const resultEl = document.getElementById('inv-craft-result');
    const recipe = findRecipe(invCraftGrid, 2, 2);
    resultEl.innerHTML = '';
    if (recipe) {
        const output = getRecipeOutput(recipe, invCraftGrid, 2, 2);
        if (output && previewFn) {
            const canvas = previewFn(output.blockType, 28);
            if (canvas) {
                canvas.style.width = '28px';
                canvas.style.height = '28px';
                resultEl.appendChild(canvas);
            }
            const cnt = document.createElement('span');
            cnt.className = 'count';
            cnt.textContent = 'x' + output.count;
            resultEl.appendChild(cnt);
        }
        resultEl.onclick = () => {
            invCraftGrid = Array(2).fill(null).map(() => Array(2).fill(AIR));
            for (let i = 0; i < output.count; i++) {
                inventory.addBlock(output.blockType, 1);
            }
            buildInventoryScreen(previewFn);
            buildHotbar(previewFn);
        };
    } else {
        resultEl.onclick = null;
    }
}

function toggleInventory() {
    if (isDestroying) stopDestroying();
    inventoryOpen = !inventoryOpen;
    clearMoveSource();
    document.getElementById('inventory-screen').style.display = inventoryOpen ? 'flex' : 'none';
    if (inventoryOpen) {
        buildInventoryScreen(world.createBlockPreview);
        document.exitPointerLock();
    } else if (!escOpen) {
        document.body.requestPointerLock();
    }
}

function toggleEsc() {
    escOpen = !escOpen;
    document.getElementById('esc-menu').style.display = escOpen ? 'flex' : 'none';

    if (escOpen) {
        document.exitPointerLock();
    } else if (!inventoryOpen) {
        document.body.requestPointerLock();
    }
}

let craftingGrid = Array(3).fill(null).map(() => Array(3).fill(AIR));
let craftingWidth = 2;
let craftingHeight = 2;

function openCrafting(isTable) {
    if (isDestroying) stopDestroying();
    craftingOpen = true;
    craftingWidth = isTable ? 3 : 2;
    craftingHeight = isTable ? 3 : 2;
    craftingGrid = Array(craftingHeight).fill(null).map(() => Array(craftingWidth).fill(AIR));
    document.getElementById('crafting-screen').style.display = 'flex';
    updateCraftingUI();
    document.exitPointerLock();
}

function closeCrafting() {
    for (let y = 0; y < craftingHeight; y++) {
        for (let x = 0; x < craftingWidth; x++) {
            const block = craftingGrid[y][x];
            if (block !== AIR) inventory.addBlock(block, 1);
        }
    }
    craftingOpen = false;
    craftingGrid = Array(3).fill(null).map(() => Array(3).fill(AIR));
    document.getElementById('crafting-screen').style.display = 'none';
}

function placeInCraftingSlot(slotY, slotX) {
    const blockType = inventory.getSelectedBlock();
    if (blockType === AIR || !inventory.hasBlock(blockType, 1)) return;
    if (craftingGrid[slotY][slotX] !== AIR) return;
    craftingGrid[slotY][slotX] = blockType;
    inventory.removeBlock(blockType, 1);
    updateCraftingUI();
}

function takeFromCraftingSlot(slotY, slotX) {
    const block = craftingGrid[slotY][slotX];
    if (block === AIR) return;
    inventory.addBlock(block, 1);
    craftingGrid[slotY][slotX] = AIR;
    updateCraftingUI();
}

function craftItem() {
    const recipe = findRecipe(craftingGrid, craftingWidth, craftingHeight);
    if (!recipe) return;
    const output = getRecipeOutput(recipe, craftingGrid, craftingWidth, craftingHeight);
    if (!output) return;

    const ing = recipe.ingredients;
    const pat = recipe.pattern;
    for (let y = 0; y < pat.length; y++) {
        for (let x = 0; x < pat[0].length; x++) {
            const char = pat[y][x];
            if (char !== ' ') {
                const found = ing[char];
                if (craftingGrid[y][x] !== found) return;
            }
        }
    }

    for (let y = 0; y < pat.length; y++) {
        for (let x = 0; x < pat[0].length; x++) {
            if (pat[y][x] !== ' ') {
                craftingGrid[y][x] = AIR;
            }
        }
    }

    for (let i = 0; i < output.count; i++) {
        inventory.addBlock(output.blockType, 1);
    }

    updateCraftingUI();
    buildHotbar(world.createBlockPreview);
    showBlockIndicator(`合成 ${BLOCK_NAMES[output.blockType] || '物品'} x${output.count}`);
}

function updateCraftingUI() {
    const grid = document.getElementById('craft-grid');
    grid.className = 'craft-grid ' + (craftingWidth === 3 ? 'craft-3x3' : 'craft-2x2');
    grid.innerHTML = '';

    for (let y = 0; y < craftingHeight; y++) {
        for (let x = 0; x < craftingWidth; x++) {
            const div = document.createElement('div');
            div.className = 'craft-slot';
            const block = craftingGrid[y][x];
            if (block !== AIR && world.createBlockPreview) {
                const canvas = world.createBlockPreview(block, 24);
                if (canvas) {
                    canvas.style.width = '24px';
                    canvas.style.height = '24px';
                    div.appendChild(canvas);
                }
            }
            div.addEventListener('click', (e) => {
                const sy = parseInt(e.currentTarget.dataset?.y || y, 10);
                const sx = parseInt(e.currentTarget.dataset?.x || x, 10);
                if (craftingGrid[sy][sx] !== AIR) {
                    takeFromCraftingSlot(sy, sx);
                } else {
                    placeInCraftingSlot(sy, sx);
                }
            });
            div.dataset.y = y;
            div.dataset.x = x;
            grid.appendChild(div);
        }
    }

    if (craftingWidth === 2) {
        for (let y = 0; y < 2; y++) {
            for (let x = 2; x < 3; x++) {
                const div = document.createElement('div');
                div.className = 'craft-slot';
                div.style.opacity = '0.3';
                grid.appendChild(div);
            }
        }
        const row3 = document.createElement('div');
        row3.className = 'craft-slot';
        row3.style.opacity = '0.3';
        row3.style.gridColumn = '1 / -1';
        grid.appendChild(row3);
    }

    const resultEl = document.getElementById('craft-result');
    const recipe = findRecipe(craftingGrid, craftingWidth, craftingHeight);
    resultEl.innerHTML = '';
    if (recipe) {
        const output = getRecipeOutput(recipe, craftingGrid, craftingWidth, craftingHeight);
        if (output && world.createBlockPreview) {
            const canvas = world.createBlockPreview(output.blockType, 28);
            if (canvas) {
                canvas.style.width = '28px';
                canvas.style.height = '28px';
                resultEl.appendChild(canvas);
            }
            const cnt = document.createElement('span');
            cnt.className = 'count';
            cnt.textContent = 'x' + output.count;
            resultEl.appendChild(cnt);
        }
        resultEl.style.cursor = 'pointer';
        resultEl.onclick = craftItem;
    } else {
        resultEl.style.cursor = 'default';
        resultEl.onclick = null;
    }
}

document.getElementById('craft-close-btn')?.addEventListener('click', () => {
    closeCrafting();
    if (!inventoryOpen && !escOpen) document.body.requestPointerLock();
});

const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code >= 'Digit1' && e.code <= 'Digit9') {
        selectSlot(parseInt(e.code.replace('Digit', ''), 10) - 1);
        clearMoveSource();
    }
    if (e.code === 'Digit0') selectSlot(8);
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyM') { magic.toggle(); e.preventDefault(); }
    if (e.code === 'KeyC') { if (magic.active) magic.cycleSpell(e.shiftKey ? -1 : 1); e.preventDefault(); }
    if (e.code === 'KeyF') { magic.cast(); e.preventDefault(); }
    if (e.code === 'KeyE') {
        e.preventDefault();
        if (craftingOpen) { closeCrafting(); if (!escOpen) document.body.requestPointerLock(); }
        else if (!escOpen) toggleInventory();
    }
    if (e.code === 'Escape') {
        e.preventDefault();
        if (craftingOpen) { closeCrafting(); document.body.requestPointerLock(); }
        else if (inventoryOpen) { toggleInventory(); }
        else { toggleEsc(); }
    }
});

window.addEventListener('keyup', (e) => {
    keys[e.code] = false;
});

window.addEventListener('wheel', (e) => {
    if (!isLocked) return;
    if (e.deltaY > 0) selectSlot((selectedSlot + 1) % HOTBAR_SIZE);
    else selectSlot((selectedSlot - 1 + HOTBAR_SIZE) % HOTBAR_SIZE);
    clearMoveSource();
});

function getInput() {
    return {
        forward: !!keys['KeyW'] || !!keys['ArrowUp'],
        backward: !!keys['KeyS'] || !!keys['ArrowDown'],
        left: !!keys['KeyA'] || !!keys['ArrowLeft'],
        right: !!keys['KeyD'] || !!keys['ArrowRight'],
        jump: !!keys['Space'],
        sprint: !!keys['ShiftLeft'] || !!keys['ShiftRight'],
    };
}

function getDroppedMaterial(blockType) {
    if (!world || !world.createBlockPreview) {
        return new THREE.MeshStandardMaterial({ color: 0x888888 });
    }
    if (droppedItemMaterialCache.has(blockType)) {
        return droppedItemMaterialCache.get(blockType);
    }

    const preview = world.createBlockPreview(blockType, 64);
    if (!preview) {
        const mat = new THREE.MeshStandardMaterial({ color: 0x888888 });
        droppedItemMaterialCache.set(blockType, mat);
        return mat;
    }

    const texture = new THREE.CanvasTexture(preview);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipMapLinearFilter;
    texture.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshStandardMaterial({ map: texture, transparent: true, side: THREE.DoubleSide });
    droppedItemMaterialCache.set(blockType, mat);
    return mat;
}

function spawnDroppedItem(blockType, count, position) {
    if (count <= 0 || blockType === AIR) return;
    const material = getDroppedMaterial(blockType);
    const mesh = new THREE.Mesh(droppedItemGeometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.position.copy(position.clone());
    mesh.position.y += 0.1;
    mesh.userData.spinOffset = Math.random() * Math.PI * 2;
    scene.add(mesh);

    const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 2.4,
        2 + Math.random() * 1.1,
        (Math.random() - 0.5) * 2.4
    );

    droppedItems.push({
        blockType,
        count,
        age: 0,
        position,
        velocity,
        mesh,
    });
}

function removeDroppedItem(index) {
    const item = droppedItems[index];
    if (!item) return;
    if (item.mesh) {
        scene.remove(item.mesh);
    }
    droppedItems.splice(index, 1);
}

function tryCollectDroppedItem(item) {
    const remaining = inventory.addBlock(item.blockType, item.count);
    const taken = item.count - remaining;
    if (taken <= 0) return false;

    playHitSound();
    const label = BLOCK_NAMES[item.blockType] || '物品';
    showBlockIndicator(`撿起 ${label} x${taken}`);
    item.count = remaining;
    buildHotbar(world.createBlockPreview);
    buildInventoryScreen(world.createBlockPreview);
    return remaining <= 0;
}

function updateDroppedItems(delta) {
    if (droppedItems.length === 0) return;

    for (let i = droppedItems.length - 1; i >= 0; i--) {
        const item = droppedItems[i];
        item.age += delta;
        if (item.age >= DROPPED_ITEM_LIFETIME) {
            removeDroppedItem(i);
            continue;
        }

        item.velocity.y -= DROPPED_ITEM_GRAVITY * delta;
        item.velocity.x *= 0.98;
        item.velocity.z *= 0.98;
        item.position.addScaledVector(item.velocity, delta);

        const floorX = Math.floor(item.position.x);
        const floorY = Math.floor(item.position.y - 0.08);
        const floorZ = Math.floor(item.position.z);
        const below = world.getBlock(floorX, floorY, floorZ);

        if (below !== AIR && below !== 255) {
            item.position.y = Math.floor(item.position.y) + 0.95;
            if (item.velocity.y < 0) item.velocity.y = Math.max(0, item.velocity.y * -0.2);
        }

        if (item.position.y < 0) {
            item.position.y = 0.1;
            item.velocity.y = 0;
        }

        item.mesh.position.copy(item.position);
        item.mesh.rotation.x += delta * 1.2 + item.mesh.userData.spinOffset * 0.001;
        item.mesh.rotation.y += delta * 1.1 + item.mesh.userData.spinOffset * 0.001;

        if (player.position.distanceTo(item.position) <= PICKUP_RADIUS) {
            if (tryCollectDroppedItem(item)) {
                removeDroppedItem(i);
            }
        }
    }
}

function updateTargetBlock() {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const result = world.raycastBlock(origin, direction, REACH_DISTANCE);
    if (result) {
        targetBlockPos = result.blockPos;
        overlayMesh.position.set(
            targetBlockPos.x + 0.5,
            targetBlockPos.y + 0.5,
            targetBlockPos.z + 0.5
        );
        overlayMesh.visible = true;
    } else {
        overlayMesh.visible = false;
        targetBlockPos = null;
    }
}

function breakBlockAt(blockPos) {
    if (!blockPos) return;
    const block = world.getBlock(blockPos.x, blockPos.y, blockPos.z);
    if (block === AIR) return;

    world.setBlock(blockPos.x, blockPos.y, blockPos.z, AIR);
    world.updateDirtyChunks();
    const name = BLOCK_NAMES[block] || '方塊';
    spawnDroppedItem(block, 1, new THREE.Vector3(blockPos.x + 0.5, blockPos.y + 0.5, blockPos.z + 0.5));
    playDestroySound();
    showBlockIndicator(`破壞 ${name}`);
}

function updateDestroyProgress(delta) {
    if (!isDestroying) return;
    if (!targetBlockPos) {
        setDestroyTarget(null);
        return;
    }

    const key = getTargetKey(targetBlockPos);
    const blockType = world.getBlock(targetBlockPos.x, targetBlockPos.y, targetBlockPos.z);
    if (blockType === AIR || blockType === 255) {
        setDestroyTarget(null);
        return;
    }

    const hardness = BLOCK_HARDNESS[blockType];
    const isInvalidHardness = !Number.isFinite(hardness) || hardness <= 0;

    if (key !== destroyTargetKey || destroyBlockType !== blockType) {
        destroyTargetKey = key;
        destroyBlockType = blockType;
        destroyProgress = 0;
    }

    if (isInvalidHardness || !Number.isFinite(hardness)) {
        showDestroyIndicator(`無法破壞：${BLOCK_NAMES[blockType] || '此方塊'}`);
        return;
    }
    if (!Number.isFinite(hardness) || hardness === Number.POSITIVE_INFINITY) {
        showDestroyIndicator(`無法破壞：${BLOCK_NAMES[blockType] || '此方塊'}`);
        return;
    }

    if (hardness === Number.NEGATIVE_INFINITY) {
        destroyProgress = 1;
    } else {
        destroyProgress += delta / hardness;
    }

    const percent = Math.min(100, Math.floor(destroyProgress * 100));
    showDestroyIndicator(`${BLOCK_NAMES[blockType] || '方塊'} ${percent}%`);

    if (destroyProgress >= 1) {
        breakBlockAt(targetBlockPos);
        stopDestroying();
    }
}

function startDestroy() {
    if (!targetBlockPos) {
        updateTargetBlock();
        if (!targetBlockPos) return;
    }
    isDestroying = true;
    destroyTargetKey = '';
    destroyBlockType = AIR;
    destroyProgress = 0;
}

function placeBlock() {
    updateTargetBlock();
    if (!targetBlockPos) return;

    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const result = world.raycastBlock(origin, direction, REACH_DISTANCE);
    if (!result || !result.placePos) return;

    const selected = inventory.getSlot(selectedSlot);
    const blockType = selected ? selected.blockType : AIR;
    if (!selected || selected.count <= 0 || selected.blockType === AIR) {
        showBlockIndicator('目前快捷欄沒有可放置的方塊');
        return;
    }

    const pp = result.placePos;
    const playerAABB = player.getAABB(player.position);
    const placeAABB = { minX: pp.x, maxX: pp.x + 1, minY: pp.y, maxY: pp.y + 1, minZ: pp.z, maxZ: pp.z + 1 };
    const overlaps = !(
        playerAABB.maxX <= placeAABB.minX ||
        playerAABB.minX >= placeAABB.maxX ||
        playerAABB.maxY <= placeAABB.minY ||
        playerAABB.minY >= placeAABB.maxY ||
        playerAABB.maxZ <= placeAABB.minZ ||
        playerAABB.minZ >= placeAABB.maxZ
    );
    if (overlaps) {
        showBlockIndicator('放置位置與玩家重疊');
        return;
    }
    if (world.getBlock(pp.x, pp.y, pp.z) === AIR) {
        world.setBlock(pp.x, pp.y, pp.z, blockType);
        world.updateDirtyChunks();
        inventory.removeBlock(blockType, 1);
        playPlaceSound();
        buildHotbar(world.createBlockPreview);
        buildInventoryScreen(world.createBlockPreview);
        showBlockIndicator(`放置 ${BLOCK_NAMES[blockType] || '方塊'}`);
    }
}

function updateHUD() {
    const healthEl = document.getElementById('health-bar');
    const foodEl = document.getElementById('food-bar');
    if (!healthEl || !foodEl) return;

    const hearts = Math.ceil(player.health / 2);
    const maxHearts = player.maxHealth / 2;
    const foodIcons = Math.ceil(player.food / 2);
    const maxFood = player.maxFood / 2;

    healthEl.innerHTML = '';
    for (let i = 0; i < maxHearts; i++) {
        const span = document.createElement('span');
        span.className = 'icon' + (i >= hearts ? ' lost' : '');
        span.textContent = '♥';
        healthEl.appendChild(span);
    }
    foodEl.innerHTML = '';
    for (let i = 0; i < maxFood; i++) {
        const span = document.createElement('span');
        span.className = 'icon' + (i >= foodIcons ? ' lost' : '');
        span.textContent = '🍖';
        foodEl.appendChild(span);
    }
}

window.addEventListener('mousedown', (e) => {
    if (!isLocked) return;
    if (e.button === 0) {
        startDestroy();
        return;
    }
    if (e.button === 2) {
        if (magic.active) {
            magic.cast();
        } else {
            const origin = camera.position.clone();
            const dir = new THREE.Vector3();
            camera.getWorldDirection(dir);
            const result = world.raycastBlock(origin, dir, REACH_DISTANCE);
            if (result && result.blockPos) {
                const bp = result.blockPos;
                const block = world.getBlock(bp.x, bp.y, bp.z);
                if (block === CRAFTING_TABLE) {
                    openCrafting(true);
                    e.preventDefault();
                    return;
                }
            }
            placeBlock();
        }
        e.preventDefault();
    }
});

window.addEventListener('mouseup', (e) => {
    if (e.button === 0) {
        stopDestroying();
    }
});

window.addEventListener('contextmenu', (e) => {
    if (isLocked) e.preventDefault();
});

document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === document.body;
    if (!isLocked) {
        if (!inventoryOpen && !craftingOpen && !escOpen) {
            toggleEsc();
        }
        stopDestroying();
    }
});

document.getElementById('canvas-container').addEventListener('click', () => {
    if (!isLocked && !inventoryOpen && !craftingOpen && !escOpen) {
        document.body.requestPointerLock();
    }
});

window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

document.getElementById('esc-resume')?.addEventListener('click', toggleEsc);
document.getElementById('esc-save')?.addEventListener('click', () => {
    showBlockIndicator('儲存功能保留中');
    toggleEsc();
});
document.getElementById('esc-back')?.addEventListener('click', () => {
    if (confirm('回到首頁會重新載入遊戲。')) {
        location.reload();
    }
});
document.getElementById('respawn-btn')?.addEventListener('click', () => {
    player.respawn();
    document.body.requestPointerLock();
});

const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87ceeb);
scene.fog = new THREE.Fog(0x87ceeb, 60, 120);

const sky = createSky();
scene.add(sky);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 400);

const hemi = new THREE.HemisphereLight(0x87ceeb, 0x3a2a1a, 0.6);
scene.add(hemi);
const ambient = new THREE.AmbientLight(0x445566, 0.3);
scene.add(ambient);

let dayTime = Math.PI / 4;
const sunLightPos = new THREE.Vector3();
const sun = new THREE.DirectionalLight(0xfff0d0, 2.5);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -120;
sun.shadow.camera.right = 120;
sun.shadow.camera.top = 120;
sun.shadow.camera.bottom = -120;
sun.shadow.normalBias = 0.02;
sun.shadow.bias = -0.001;
sun.shadow.radius = 4;
scene.add(sun);

const sunSphere = new THREE.Mesh(
    new THREE.SphereGeometry(8, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffffee })
);
scene.add(sunSphere);
const sunGlow = new THREE.Mesh(
    new THREE.SphereGeometry(15, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xffdd44, transparent: true, opacity: 0.2 })
);
scene.add(sunGlow);

const fill = new THREE.DirectionalLight(0x8899cc, 0.6);
fill.position.set(-60, 40, -80);
scene.add(fill);
const rim = new THREE.DirectionalLight(0xffeedd, 0.3);
rim.position.set(0, -20, 100);
scene.add(rim);

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.5;
scene.add(controls.getObject());
scene.add(overlayMesh);

const world = new World(scene);
const player = new Player(camera, world);
const inventory = new Inventory(36, HOTBAR_SIZE);
const magic = new MagicSystem(world, player, camera, scene, inventory);

window.onerror = function (msg, url, line, col, error) {
    if (loadText) {
        loadText.style.color = '#ff5555';
        loadText.textContent = `錯誤: ${msg} (${line})`;
    }
    console.error(error);
    return false;
};

async function start() {
    try {
        loadText.textContent = '載入紋理中...';
        await world.init((p, txt) => {
            loadBar.style.width = Math.round(p * 10) + '%';
            loadText.textContent = txt;
        });

        loadText.textContent = '生成世界中...';
        await new Promise(r => setTimeout(r, 50));
        await new Promise(r => requestAnimationFrame(r));

        await world.initSpawn((progress, text) => {
            loadBar.style.width = Math.round(10 + progress * 90) + '%';
            loadText.textContent = text + ` (${Math.round(progress * 100)}%)`;
        });

        buildHotbar(world.createBlockPreview);

        const sx = 8;
        const sz = 8;
        let sy = world.findSurfaceY(sx, sz) + 2;
        sy = Math.max(sy, 20);
        player.respawnPos.set(sx, sy, sz);
        player.position.set(sx, sy, sz);
        player.velocity.set(0, 0, 0);
        player.camera.position.set(sx, sy + 1.6, sz);

        await new Promise(r => setTimeout(r, 400));
        loadingEl.classList.add('hidden');
        setTimeout(() => {
            loadingEl.style.display = 'none';
            toggleEsc();
        }, 600);

        const clock = new THREE.Clock();
        let frameCount = 0;
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();

            if (isLocked) {
                player.update(delta, getInput());
                magic.update(delta);
                magic.updateLights();
                updateTargetBlock();
                if (isDestroying) {
                    updateDestroyProgress(delta);
                }
            } else {
                stopDestroying();
            }

            frameCount++;
            if (frameCount % 15 === 0 && isLocked) {
                world.updateChunkLoading(player.position.x, player.position.z);
            }

            updateDroppedItems(delta);

            skyUniforms.time.value += delta * 0.3;
            dayTime += delta * 0.02;

            const orbitRadius = 150;
            sunLightPos.set(
                Math.cos(dayTime) * orbitRadius,
                Math.sin(dayTime) * orbitRadius,
                50
            );

            sun.position.copy(player.position).add(sunLightPos);
            sun.target.position.copy(player.position);
            sun.target.updateMatrixWorld();

            sunSphere.position.copy(player.position).add(sunLightPos);
            sunGlow.position.copy(sunSphere.position);

            sky.position.copy(player.position);
            skyUniforms.sunDir.value.copy(sunLightPos).normalize();

            const sunHeight = Math.sin(dayTime);
            if (sunHeight > 0) {
                sun.intensity = THREE.MathUtils.lerp(0, 2.5, Math.min(sunHeight * 3, 1));
                hemi.intensity = THREE.MathUtils.lerp(0.1, 0.6, sunHeight);
                ambient.intensity = THREE.MathUtils.lerp(0.05, 0.3, sunHeight);
                skyUniforms.topColor.value.lerpColors(new THREE.Color(0x001133), new THREE.Color(0x0066cc), sunHeight);
                skyUniforms.horizonColor.value.lerpColors(new THREE.Color(0x000000), new THREE.Color(0x87ceeb), sunHeight);
            } else {
                sun.intensity = 0;
                hemi.intensity = 0.1;
                ambient.intensity = 0.05;
                skyUniforms.topColor.value.setHex(0x000511);
                skyUniforms.horizonColor.value.setHex(0x001122);
            }

            updateHUD();
            world.updateDirtyChunks();
            renderer.render(scene, camera);
        }
        animate();
    } catch (err) {
        loadText.textContent = '啟動失敗: ' + (err.message || err);
        console.error(err);
    }
}

start();
