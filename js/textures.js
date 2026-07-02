import * as THREE from 'three';
import {
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, PLANKS, COBBLESTONE,
    BRICK, GRAVEL, SNOW, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, WATER,
    BEDROCK, GLASS, STONE_BRICK, CRAFTING_TABLE, FURNACE, STICK, COAL,
    DEFAULT_TEXTURE_RESOLUTION
} from './constants.js';
import { PerlinNoise } from './perlin.js';

const TEX_SIZE = DEFAULT_TEXTURE_RESOLUTION || 1024;
const ATLAS_COLS = 8;
const resolveLocalTexture = (filename) => new URL(`../assets/textures/${filename}`, import.meta.url).href;

function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }
function lerp(a, b, t) { return a + (b - a) * t; }

function drawTexture(ctx, generator) {
    const temp = document.createElement('canvas');
    temp.width = TEX_SIZE;
    temp.height = TEX_SIZE;
    const tc = temp.getContext('2d');
    const imageData = tc.createImageData(TEX_SIZE, TEX_SIZE);
    const data = imageData.data;
    generator(data, TEX_SIZE, TEX_SIZE);
    tc.putImageData(imageData, 0, 0);
    ctx.drawImage(temp, 0, 0, TEX_SIZE, TEX_SIZE);
}

function fbm2D(noise, x, y, octaves, scale) {
    let value = 0;
    let amplitude = 1;
    let frequency = 1;
    let maxValue = 0;
    for (let i = 0; i < octaves; i++) {
        value += noise.noise2D(x * frequency, y * frequency) * amplitude;
        maxValue += amplitude;
        amplitude *= 0.5;
        frequency *= 2.0;
    }
    return value / maxValue * 0.5 + 0.5;
}

function basicGenerator(r, g, b, a = 255) {
    return (data) => {
        for (let i = 0; i < data.length; i += 4) {
            data[i] = r;
            data[i + 1] = g;
            data[i + 2] = b;
            data[i + 3] = a;
        }
    };
}

function grassTopGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.06);
                const flower = Math.abs(detailNoise.noise2D(x * 0.08, y * 0.08));
                if (flower > 0.48 && flower < 0.50) {
                    data[i] = 255; data[i + 1] = 220; data[i + 2] = 90;
                } else {
                    data[i] = 55 + n * 65;
                    data[i + 1] = 140 + n * 55;
                    data[i + 2] = 40 + n * 25;
                }
                data[i + 3] = 255;
            }
        }
    };
}

function grassSideGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 3, 0.05);
                const ty = y / h;
                if (ty < 0.2) {
                    data[i] = clamp(70 + n * 40, 40, 140);
                    data[i + 1] = clamp(100 + n * 60, 70, 180);
                    data[i + 2] = clamp(30 + n * 30, 20, 90);
                } else if (ty < 0.35) {
                    const t = (ty - 0.2) / 0.15;
                    data[i] = clamp(lerp(80, 110, t) + n * 30, 50, 160);
                    data[i + 1] = clamp(lerp(140, 85, t) + n * 25, 60, 180);
                    data[i + 2] = clamp(lerp(45, 50, t) + n * 20, 30, 90);
                } else {
                    data[i] = clamp(95 + n * 35, 50, 150);
                    data[i + 1] = clamp(75 + n * 25, 40, 120);
                    data[i + 2] = clamp(35 + n * 20, 20, 80);
                }
                data[i + 3] = 255;
            }
        }
    };
}

function dirtGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.05);
                const pebble = Math.abs(noise.noise2D(x * 0.2, y * 0.2)) > 0.4 ? -15 : 0;
                data[i] = clamp(90 + n * 35 + pebble, 40, 150);
                data[i + 1] = clamp(70 + n * 25 + pebble, 30, 120);
                data[i + 2] = clamp(40 + n * 20 + pebble, 20, 80);
                data[i + 3] = 255;
            }
        }
    };
}

function stoneGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 5, 0.04);
                const detail = detailNoise.noise2D(x * 0.1, y * 0.1) * 0.3;
                const cracks = Math.abs(noise.noise2D(x * 0.08, y * 0.08)) < 0.06 ? -20 : 0;
                const base = 125 + n * 35 + detail * 50 + cracks;
                data[i] = clamp(base, 60, 200);
                data[i + 1] = clamp(base - 5, 55, 195);
                data[i + 2] = clamp(base - 10, 50, 190);
                data[i + 3] = 255;
            }
        }
    };
}

function woodSideGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 3, 0.03);
                const stripe = (Math.floor(y / 4) % 2 === 0);
                const bark = detailNoise.noise2D(x * 0.2, y * 0.2) > 0.3 ? -20 : 0;
                data[i] = stripe ? 95 + n * 20 + bark : 135 + n * 20 + bark;
                data[i + 1] = stripe ? 55 + n * 15 + bark : 85 + n * 15 + bark;
                data[i + 2] = stripe ? 25 + n * 10 + bark : 45 + n * 10 + bark;
                data[i + 3] = 255;
            }
        }
    };
}

function leavesGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.08);
                const gap = Math.abs(noise.noise2D(x * 0.15, y * 0.15));
                if (gap < 0.15) {
                    data[i] = 30; data[i + 1] = 70; data[i + 2] = 25;
                    data[i + 3] = 110;
                } else {
                    data[i] = 40 + n * 30;
                    data[i + 1] = 125 + n * 35;
                    data[i + 2] = 45 + n * 25;
                    data[i + 3] = 255;
                }
            }
        }
    };
}

function oreStoneGenerator(baseNoise, oreNoise, oreColor, oreChance) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const base = 118 + fbm2D(baseNoise, x, y, 3, 0.04) * 38;
                const ore = fbm2D(oreNoise, x, y, 2, 0.08);
                if (ore > (1 - oreChance)) {
                    data[i] = oreColor[0];
                    data[i + 1] = oreColor[1];
                    data[i + 2] = oreColor[2];
                } else {
                    data[i] = clamp(base, 60, 200);
                    data[i + 1] = clamp(base - 5, 55, 195);
                    data[i + 2] = clamp(base - 10, 50, 190);
                }
                data[i + 3] = 255;
            }
        }
    };
}

function stickItemGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = Math.abs(noise.noise2D(x * 0.12, y * 0.12));
                const xg = x - w / 2;
                const yg = y - h / 2;
                const dist = Math.sqrt((xg / 2) ** 2 + (yg / 14) ** 2);
                const isStem = dist < (w / 2.2) * 0.06 || (n > 0.2 && Math.abs(xg) < w * 0.06);
                if (isStem && y > h * 0.15) {
                    data[i] = 125 + n * 40;
                    data[i + 1] = 95 + n * 25;
                    data[i + 2] = 35 + n * 20;
                    data[i + 3] = 255;
                } else {
                    data[i + 3] = 0;
                }
            }
        }
    };
}

function coalItemGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = noise.noise2D(x * 0.06, y * 0.06);
                const band = Math.abs(Math.sin((x + y) * 0.08));
                const shine = Math.abs(noise.noise2D((x + 60) * 0.09, (y + 120) * 0.09));
                const bright = band > 0.52 ? 30 : 0;
                const shade = clamp(28 + bright + Math.abs(n) * 8, 0, 255);
                data[i] = shade;
                data[i + 1] = shade;
                data[i + 2] = shade;
                data[i + 3] = 255;
                if (shine > 0.98) {
                    data[i] = 240;
                    data[i + 1] = 225;
                    data[i + 2] = 120;
                }
            }
        }
    };
}

function createImageLoaderCanvas() {
    const canvas = document.createElement('canvas');
    canvas.width = TEX_SIZE;
    canvas.height = TEX_SIZE;
    const ctx = canvas.getContext('2d');
    return { canvas, ctx };
}

function loadTextureImage(url) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => resolve(null);
        img.src = url;
    });
}

async function makeTextureSource(source, generator) {
    if (source) {
        const img = await loadTextureImage(source);
        if (img) {
            const { canvas, ctx } = createImageLoaderCanvas();
            ctx.drawImage(img, 0, 0, TEX_SIZE, TEX_SIZE);
            return canvas;
        }
    }
    const { canvas, ctx } = createImageLoaderCanvas();
    const gen = generator || basicGenerator(170, 170, 170);
    drawTexture(ctx, gen);
    return canvas;
}

export async function createTextureAtlasAsync(onProgress) {
    const noisePairs = Array.from({ length: 24 }, (_, i) => ({
        noise: new PerlinNoise(120 + i),
        detail: new PerlinNoise(220 + i),
    }));

    const textureDefs = [
        { key: 'grass_top', source: resolveLocalTexture('grass_top.png'), generator: grassTopGenerator(noisePairs[0].noise, noisePairs[0].detail) },
        { key: 'grass_side', source: resolveLocalTexture('grass_side.png'), generator: grassSideGenerator(noisePairs[1].noise) },
        { key: 'dirt', source: resolveLocalTexture('dirt.png'), generator: dirtGenerator(noisePairs[2].noise) },
        { key: 'stone', source: resolveLocalTexture('stone.png'), generator: stoneGenerator(noisePairs[3].noise, noisePairs[3].detail) },
        { key: 'wood_side', source: resolveLocalTexture('wood_side.png'), generator: woodSideGenerator(noisePairs[4].noise, noisePairs[4].detail) },
        { key: 'wood_top', source: resolveLocalTexture('wood_top.png'), generator: basicGenerator(150, 100, 50) },
        { key: 'leaves', source: resolveLocalTexture('leaves.png'), generator: leavesGenerator(noisePairs[6].noise) },
        { key: 'sand', source: resolveLocalTexture('sand.png'), generator: basicGenerator(220, 200, 150) },
        { key: 'planks', source: resolveLocalTexture('planks.png'), generator: basicGenerator(160, 120, 60) },
        { key: 'cobblestone', source: resolveLocalTexture('cobblestone.png'), generator: basicGenerator(100, 100, 100) },
        { key: 'brick', source: resolveLocalTexture('brick.png'), generator: basicGenerator(180, 80, 60) },
        { key: 'gravel', source: resolveLocalTexture('gravel.png'), generator: basicGenerator(120, 120, 120) },
        { key: 'snow', source: resolveLocalTexture('snow.png'), generator: basicGenerator(240, 240, 255) },
        { key: 'coal_ore', source: resolveLocalTexture('coal_ore.png'), generator: oreStoneGenerator(noisePairs[13].noise, noisePairs[13].detail, [45, 45, 45], 0.25) },
        { key: 'iron_ore', source: resolveLocalTexture('iron_ore.png'), generator: oreStoneGenerator(noisePairs[14].noise, noisePairs[14].detail, [185, 160, 130], 0.18) },
        { key: 'gold_ore', source: resolveLocalTexture('gold_ore.png'), generator: oreStoneGenerator(noisePairs[15].noise, noisePairs[15].detail, [235, 210, 70], 0.12) },
        { key: 'diamond_ore', source: resolveLocalTexture('diamond_ore.png'), generator: oreStoneGenerator(noisePairs[16].noise, noisePairs[16].detail, [120, 220, 240], 0.1) },
        { key: 'water', source: resolveLocalTexture('water.png'), generator: basicGenerator(60, 150, 220) },
        { key: 'bedrock', source: resolveLocalTexture('bedrock.png'), generator: basicGenerator(50, 50, 50) },
        { key: 'glass', source: resolveLocalTexture('glass.png'), generator: basicGenerator(180, 220, 255) },
        { key: 'stone_brick', source: resolveLocalTexture('stone_brick.png'), generator: basicGenerator(120, 120, 125) },
        { key: 'crafting_table_top', source: resolveLocalTexture('crafting_table_top.png'), generator: basicGenerator(120, 90, 50) },
        { key: 'crafting_table_side', source: resolveLocalTexture('crafting_table_side.png'), generator: basicGenerator(110, 85, 45) },
        { key: 'furnace_top', source: resolveLocalTexture('furnace_top.png'), generator: basicGenerator(100, 100, 100) },
        { key: 'furnace_side', source: resolveLocalTexture('furnace_side.png'), generator: basicGenerator(90, 90, 90) },
        { key: 'stick_item', source: resolveLocalTexture('stick_item.png'), generator: stickItemGenerator(noisePairs[5].noise) },
        { key: 'coal_item', source: resolveLocalTexture('coal_item.png'), generator: coalItemGenerator(noisePairs[7].noise) },
    ];

    const textures = [];
    for (let i = 0; i < textureDefs.length; i++) {
        const def = textureDefs[i];
        textures.push(await makeTextureSource(def.source, def.generator));
        if (onProgress) {
            const total = textureDefs.length;
            onProgress(i / total, `Load texture ${def.key}...`);
        }
        await Promise.resolve();
    }

    const rows = Math.ceil(textures.length / ATLAS_COLS);
    const atlasCanvas = document.createElement('canvas');
    atlasCanvas.width = ATLAS_COLS * TEX_SIZE;
    atlasCanvas.height = rows * TEX_SIZE;
    const atlasCtx = atlasCanvas.getContext('2d');
    for (let i = 0; i < textures.length; i++) {
        const x = (i % ATLAS_COLS) * TEX_SIZE;
        const y = Math.floor(i / ATLAS_COLS) * TEX_SIZE;
        atlasCtx.drawImage(textures[i], x, y, TEX_SIZE, TEX_SIZE);
    }

    const atlasTexture = new THREE.CanvasTexture(atlasCanvas);
    atlasTexture.magFilter = THREE.NearestFilter;
    atlasTexture.minFilter = THREE.LinearMipmapLinearFilter;
    atlasTexture.anisotropy = 4;
    atlasTexture.generateMipmaps = true;
    atlasTexture.colorSpace = THREE.SRGBColorSpace;

    const tileW = TEX_SIZE / atlasCanvas.width;
    const tileH = TEX_SIZE / atlasCanvas.height;

    const textureIndexByKey = {};
    textureDefs.forEach((def, i) => {
        textureIndexByKey[def.key] = i;
    });

    const blockTextures = {
        [GRASS]: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' },
        [DIRT]: { top: 'dirt', bottom: 'dirt', side: 'dirt' },
        [STONE]: { top: 'stone', bottom: 'stone', side: 'stone' },
        [WOOD]: { top: 'wood_top', bottom: 'wood_top', side: 'wood_side' },
        [LEAVES]: { top: 'leaves', bottom: 'leaves', side: 'leaves' },
        [SAND]: { top: 'sand', bottom: 'sand', side: 'sand' },
        [PLANKS]: { top: 'planks', bottom: 'planks', side: 'planks' },
        [COBBLESTONE]: { top: 'cobblestone', bottom: 'cobblestone', side: 'cobblestone' },
        [BRICK]: { top: 'brick', bottom: 'brick', side: 'brick' },
        [GRAVEL]: { top: 'gravel', bottom: 'gravel', side: 'gravel' },
        [SNOW]: { top: 'snow', bottom: 'snow', side: 'snow' },
        [COAL_ORE]: { top: 'coal_ore', bottom: 'coal_ore', side: 'coal_ore' },
        [IRON_ORE]: { top: 'iron_ore', bottom: 'iron_ore', side: 'iron_ore' },
        [GOLD_ORE]: { top: 'gold_ore', bottom: 'gold_ore', side: 'gold_ore' },
        [DIAMOND_ORE]: { top: 'diamond_ore', bottom: 'diamond_ore', side: 'diamond_ore' },
        [WATER]: { top: 'water', bottom: 'water', side: 'water' },
        [BEDROCK]: { top: 'bedrock', bottom: 'bedrock', side: 'bedrock' },
        [GLASS]: { top: 'glass', bottom: 'glass', side: 'glass' },
        [STONE_BRICK]: { top: 'stone_brick', bottom: 'stone_brick', side: 'stone_brick' },
        [CRAFTING_TABLE]: { top: 'crafting_table_top', bottom: 'planks', side: 'crafting_table_side' },
        [FURNACE]: { top: 'furnace_top', bottom: 'furnace_side', side: 'furnace_side' },
    };

    const itemTextures = {
        [STICK]: 'stick_item',
        [COAL]: 'coal_item',
    };

    const previewTemplateCache = new Map();

    function resolveTextureKey(blockType, face = 'side') {
        const blockCfg = blockTextures[blockType];
        if (blockCfg) return blockCfg[face] || blockCfg.side || blockCfg.top;
        if (itemTextures[blockType]) return itemTextures[blockType];
        return 'stone';
    }

    function getBlockUVs(blockType, face) {
        const key = resolveTextureKey(blockType, face);
        const idx = textureIndexByKey[key] || 0;
        const c = idx % ATLAS_COLS;
        const r = Math.floor(idx / ATLAS_COLS);
        return {
            u: c * tileW,
            v: 1 - (r + 1) * tileH,
            u2: (c + 1) * tileW,
            v2: 1 - r * tileH,
        };
    }

    function createBlockPreview(blockType, size = 48) {
        const key = resolveTextureKey(blockType);
        const cacheKey = `${key}:${size}`;
        let template = previewTemplateCache.get(cacheKey);
        if (!template) {
            const idx = textureIndexByKey[key];
            const c = idx % ATLAS_COLS;
            const r = Math.floor(idx / ATLAS_COLS);
            const templateCanvas = document.createElement('canvas');
            templateCanvas.width = size;
            templateCanvas.height = size;
            const pctx = templateCanvas.getContext('2d');
            pctx.drawImage(
                atlasCanvas,
                c * TEX_SIZE,
                r * TEX_SIZE,
                TEX_SIZE,
                TEX_SIZE,
                0,
                0,
                size,
                size
            );
            previewTemplateCache.set(cacheKey, templateCanvas);
            template = templateCanvas;
        }
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const pctx = canvas.getContext('2d');
        pctx.drawImage(template, 0, 0, size, size);
        return canvas;
    }

    return {
        texture: atlasTexture,
        getBlockUVs,
        createBlockPreview,
        createBlockPreviewCanvas: createBlockPreview,
        getTextureKey: resolveTextureKey,
        atlasCanvas,
    };
}
