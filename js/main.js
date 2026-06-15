import * as THREE from 'three';
import { PointerLockControls } from 'three/addons/controls/PointerLockControls.js';
import { World } from './world.js';
import { Player } from './player.js';
import { HOTBAR_BLOCKS, HOTBAR_SIZE, BLOCK_COLORS, BLOCK_NAMES, AIR, REACH_DISTANCE, WORLD_SIZE_X, WORLD_SIZE_Z } from './constants.js';

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
    document.querySelectorAll('.slot').forEach((s, i) => s.classList.toggle('selected', i === index));
}

function showBlockIndicator(msg) {
    blockIndicator.textContent = msg;
    blockIndicator.style.opacity = '1';
    clearTimeout(blockIndicator._timeout);
    blockIndicator._timeout = setTimeout(() => { blockIndicator.style.opacity = '0'; }, 1200);
}

function buildHotbar() {
    hotbarEl.innerHTML = '';
    for (let i = 0; i < HOTBAR_SIZE; i++) {
        const blockType = HOTBAR_BLOCKS[i];
        const slot = document.createElement('div');
        slot.className = 'slot' + (i === selectedSlot ? ' selected' : '');
        slot.dataset.index = i;
        const preview = document.createElement('div');
        preview.className = 'block-preview';
        const colorInfo = BLOCK_COLORS[blockType] || BLOCK_COLORS[3];
        const col = colorInfo.all || colorInfo.top || [0.5, 0.5, 0.5];
        preview.style.backgroundColor = `rgb(${Math.round(col[0]*255)},${Math.round(col[1]*255)},${Math.round(col[2]*255)})`;
        preview.title = BLOCK_NAMES[blockType] || '方块';
        slot.appendChild(preview);
        const num = document.createElement('span');
        num.className = 'slot-number';
        num.textContent = i + 1;
        slot.appendChild(num);
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
    };
}

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
            showBlockIndicator('破坏: ' + (BLOCK_NAMES[block] || '方块'));
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
        const playerAABB = player.getAABB(player.position);
        const placeAABB = { minX: pp.x, maxX: pp.x+1, minY: pp.y, maxY: pp.y+1, minZ: pp.z, maxZ: pp.z+1 };
        const overlaps = !(playerAABB.maxX <= placeAABB.minX || playerAABB.minX >= placeAABB.maxX ||
                           playerAABB.maxY <= placeAABB.minY || playerAABB.minY >= placeAABB.maxY ||
                           playerAABB.maxZ <= placeAABB.minZ || playerAABB.minZ >= placeAABB.maxZ);
        if (overlaps) { showBlockIndicator('⛔ 无法在此放置'); return; }
        if (world.getBlock(pp.x, pp.y, pp.z) === AIR) {
            world.setBlock(pp.x, pp.y, pp.z, HOTBAR_BLOCKS[selectedSlot]);
            world.updateDirtyChunks();
            showBlockIndicator('放置: ' + (BLOCK_NAMES[HOTBAR_BLOCKS[selectedSlot]] || '方块'));
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
scene.fog = new THREE.Fog(0x87CEEB, 40, 90);

const camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.1, 150);

const ambient = new THREE.AmbientLight(0x8899bb, 0.9);
scene.add(ambient);
const sun = new THREE.DirectionalLight(0xfff8e8, 2.5);
sun.position.set(60, 80, 40);
sun.castShadow = true;
sun.shadow.mapSize.width = 2048;
sun.shadow.mapSize.height = 2048;
sun.shadow.camera.left = -80;
sun.shadow.camera.right = 80;
sun.shadow.camera.top = 80;
sun.shadow.camera.bottom = -80;
sun.shadow.bias = -0.0003;
scene.add(sun);
scene.add(new THREE.HemisphereLight(0x8899cc, 0x554433, 0.5));

const controls = new PointerLockControls(camera, document.body);
controls.pointerSpeed = 0.5;
scene.add(controls.getObject());

const world = new World(scene);
const player = new Player(camera, world);

async function start() {
    try {
        buildHotbar();

        loadText.textContent = '生成地形...';
        await new Promise(r => setTimeout(r, 50));
        await new Promise(r => requestAnimationFrame(r));

        let totalFaces = 0;
        world.generateAll((progress, text) => {
            loadBar.style.width = Math.round(progress * 100) + '%';
            loadText.textContent = text;
        });

        const sx = Math.floor(WORLD_SIZE_X / 2);
        const sz = Math.floor(WORLD_SIZE_Z / 2);
        let sy = world.findSurfaceY(sx, sz) + 2;
        sy = Math.max(sy, 20);
        player.position.set(sx, sy, sz);
        player.velocity.set(0, 0, 0);
        player.camera.position.set(sx, sy + 1.6, sz);

        // 除錯資訊
        for (const chunk of world.chunks.values()) {
            if (chunk.mesh) {
                const geo = chunk.mesh.geometry;
                totalFaces += geo.attributes.position.count / 3;
            }
        }
        const dbg = document.createElement('div');
        dbg.id = 'debug';
        dbg.style.cssText = 'position:fixed;top:10px;left:10px;z-index:999;color:#fff;background:rgba(0,0,0,0.8);padding:10px;font-size:13px;font-family:monospace;pointer-events:none;';
        dbg.innerHTML = `Chunks: ${world.chunks.size}<br>Faces: ${totalFaces}<br>Cam: (${camera.position.x.toFixed(1)}, ${camera.position.y.toFixed(1)}, ${camera.position.z.toFixed(1)})<br>SurfaceY: ${sy-2}`;
        document.body.appendChild(dbg);

        await new Promise(r => setTimeout(r, 400));
        loadingEl.classList.add('hidden');
        setTimeout(() => { loadingEl.style.display = 'none'; }, 600);

        const clock = new THREE.Clock();
        function animate() {
            requestAnimationFrame(animate);
            const delta = clock.getDelta();
            if (isLocked) player.update(delta, getInput());
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
