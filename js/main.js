import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World } from './world.js';
import { Player } from './player.js';
import { Inventory } from './inventory.js';
import { MagicSystem } from './magic.js';
import { HOTBAR_BLOCKS, HOTBAR_SIZE, BLOCK_NAMES, AIR, REACH_DISTANCE, WORLD_SIZE_X, WORLD_SIZE_Z, STONE, DIRT, GRASS, COBBLESTONE, WOOD, PLANKS, SAND, GRAVEL, BRICK, STONE_BRICK, GLASS } from './constants.js';

const container = document.getElementById('canvas-container');
const loadingEl = document.getElementById('loading');
const loadBar = document.getElementById('load-bar');
const loadText = document.getElementById('load-text');
const hintEl = document.getElementById('hint');
const hotbarEl = document.getElementById('hotbar');
const blockIndicator = document.getElementById('block-indicator');

let selectedSlot = 0;
let isLocked = false;

function selectSlot(index) {
    selectedSlot = index;
    inventory.selectSlot(index);
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('selected', i === index));
}

function showBlockIndicator(msg) {
    blockIndicator.textContent = msg;
    blockIndicator.style.opacity = '1';
    clearTimeout(blockIndicator._timeout);
    blockIndicator._timeout = setTimeout(() => { blockIndicator.style.opacity = '0'; }, 1200);
}

function buildHotbar(previewFn) {
    hotbarEl.innerHTML = '';
    const hotbarSlots = inventory.getHotbarSlots();
    for (let i = 0; i < HOTBAR_SIZE; i++) {
        const blockType = HOTBAR_BLOCKS[i];
        const slotData = hotbarSlots[i];
        const slot = document.createElement('div');
        slot.className = 'slot' + (i === selectedSlot ? ' selected' : '');
        slot.dataset.index = i;
        const preview = document.createElement('div');
        preview.className = 'block-preview';
        if (previewFn) {
            const canvas = previewFn(blockType, 40);
            canvas.style.width = '100%';
            canvas.style.height = '100%';
            preview.appendChild(canvas);
        }
        preview.title = BLOCK_NAMES[blockType] || '方块';
        slot.appendChild(preview);
        const count = document.createElement('span');
        count.className = 'slot-number';
        count.textContent = slotData.count > 0 ? slotData.count : '';
        slot.appendChild(count);
        slot.addEventListener('click', () => selectSlot(i));
        hotbarEl.appendChild(slot);
    }
}

const keys = {};
window.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code >= 'Digit1' && e.code <= 'Digit9') selectSlot(parseInt(e.code.replace('Digit','')) - 1);
    if (e.code === 'Digit0') selectSlot(8);
    if (e.code === 'Space') e.preventDefault();
    if (e.code === 'KeyM') { magic.toggle(); e.preventDefault(); }
    if (e.code === 'KeyC') { if (magic.active) magic.cycleSpell(e.shiftKey ? -1 : 1); e.preventDefault(); }
    if (e.code === 'KeyF') { magic.cast(); e.preventDefault(); }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
window.addEventListener('wheel', (e) => {
    if (!isLocked) return;
    if (e.deltaY > 0) selectSlot((selectedSlot + 1) % HOTBAR_SIZE);
    else selectSlot((selectedSlot - 1 + HOTBAR_SIZE) % HOTBAR_SIZE);
});
window.addEventListener('mousedown', (e) => {
    if (!isLocked) return;
    if (e.button === 0) destroyBlock();
    else if (e.button === 2) { placeBlock(); e.preventDefault(); }
});
window.addEventListener('contextmenu', (e) => { if (isLocked) e.preventDefault(); });
document.addEventListener('pointerlockchange', () => {
    isLocked = document.pointerLockElement === document.body;
    hintEl.style.opacity = isLocked ? '0' : '1';
});
document.body.addEventListener('click', () => {
    if (!isLocked) document.body.requestPointerLock();
});
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
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

function updateHUD() {
    const healthEl = document.getElementById('health-bar');
    const foodEl = document.getElementById('food-bar');
    if (!healthEl) return;

    const hearts = Math.ceil(player.health / 2);
    const maxHearts = player.maxHealth / 2;
    const foodIcons = Math.ceil(player.food / 2);
    const maxFood = player.maxFood / 2;

    healthEl.innerHTML = '';
    for (let i = 0; i < maxHearts; i++) {
        const span = document.createElement('span');
        span.className = 'icon' + (i >= hearts ? ' lost' : '');
        span.textContent = '❤️';
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

document.getElementById('respawn-btn')?.addEventListener('click', () => {
    player.respawn();
    document.body.requestPointerLock();
});

function destroyBlock() {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const result = world.raycastBlock(origin, direction, REACH_DISTANCE);
    if (result && result.blockPos) {
        const bp = result.blockPos;
        const block = world.getBlock(bp.x, bp.y, bp.z);
        if (block !== AIR) {
            world.setBlock(bp.x, bp.y, bp.z, AIR);
            world.updateDirtyChunks();
            inventory.addBlock(block, 1);
            showBlockIndicator('破坏: ' + (BLOCK_NAMES[block] || '方块'));
            buildHotbar(world.createBlockPreview);
        }
    }
}

function placeBlock() {
    const origin = camera.position.clone();
    const direction = new THREE.Vector3();
    camera.getWorldDirection(direction);
    const result = world.raycastBlock(origin, direction, REACH_DISTANCE);
    if (result && result.placePos) {
        const pp = result.placePos;
        const blockType = HOTBAR_BLOCKS[selectedSlot];
        if (!inventory.hasBlock(blockType, 1)) {
            showBlockIndicator('⛔ 沒有這個方塊');
            return;
        }
        const playerAABB = player.getAABB(player.position);
        const placeAABB = { minX: pp.x, maxX: pp.x+1, minY: pp.y, maxY: pp.y+1, minZ: pp.z, maxZ: pp.z+1 };
        const overlaps = !(playerAABB.maxX <= placeAABB.minX || playerAABB.minX >= placeAABB.maxX ||
                           playerAABB.maxY <= placeAABB.minY || playerAABB.minY >= placeAABB.maxY ||
                           playerAABB.maxZ <= placeAABB.minZ || playerAABB.minZ >= placeAABB.maxZ);
        if (overlaps) { showBlockIndicator('⛔ 无法在此放置'); return; }
        if (world.getBlock(pp.x, pp.y, pp.z) === AIR) {
            world.setBlock(pp.x, pp.y, pp.z, blockType);
            world.updateDirtyChunks();
            inventory.removeBlock(blockType, 1);
            showBlockIndicator('放置: ' + (BLOCK_NAMES[blockType] || '方块'));
            buildHotbar(world.createBlockPreview);
        }
    }
}

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.1;
container.appendChild(renderer.domElement);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x87CEEB);
scene.fog = new THREE.Fog(0x87CEEB, 60, 160);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 250);

const ambient = new THREE.AmbientLight(0x8899bb, 0.9);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff8e8, 2.5);
sun.position.set(60, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -100;
sun.shadow.camera.right = 100;
sun.shadow.camera.top = 100;
sun.shadow.camera.bottom = -100;
sun.shadow.bias = -0.0003;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8899cc, 0x554433, 0.5));

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.5;
scene.add(controls.getObject());

const world = new World(scene);
const player = new Player(camera, world);
const inventory = new Inventory(36, HOTBAR_SIZE);
const magic = new MagicSystem(world, player, camera, scene, inventory);

async function start() {
    try {
        loadText.textContent = '生成地形...';
        await new Promise(r => setTimeout(r, 50));
        await new Promise(r => requestAnimationFrame(r));

        await world.generateAll((progress, text) => {
            loadBar.style.width = Math.round(progress * 100) + '%';
            loadText.textContent = text + ` (${Math.round(progress * 100)}%)`;
        });

        // 初始物品
        inventory.addBlock(PLANKS, 16);
        inventory.addBlock(COBBLESTONE, 16);
        inventory.addBlock(DIRT, 16);
        inventory.addBlock(STONE, 16);
        inventory.addBlock(WOOD, 8);
        inventory.addBlock(GLASS, 8);

        buildHotbar(world.createBlockPreview);

        const sx = Math.floor(WORLD_SIZE_X / 2);
        const sz = Math.floor(WORLD_SIZE_Z / 2);
        let sy = world.findSurfaceY(sx, sz) + 2;
        sy = Math.max(sy, 20);
        player.respawnPos.set(sx, sy, sz);
        player.position.set(sx, sy, sz);
        player.velocity.set(0, 0, 0);
        player.camera.position.set(sx, sy + 1.6, sz);

        await new Promise(r => setTimeout(r, 400));
        loadingEl.classList.add('hidden');
        setTimeout(() => { loadingEl.style.display = 'none'; }, 600);

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            if (isLocked) player.update(delta, getInput());
            magic.update(delta);
            magic.updateLights();
            updateHUD();
            world.updateDirtyChunks();
            renderer.render(scene, camera);
        }
        animate();
    } catch (err) {
        loadText.textContent = '错误: ' + (err.message || err);
        console.error(err);
    }
}

start();
