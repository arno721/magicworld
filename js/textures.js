import * as THREE from 'three';
import {
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, PLANKS, COBBLESTONE,
    BRICK, GRAVEL, SNOW, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
    BEDROCK, GLASS, STONE_BRICK, CRAFTING_TABLE, FURNACE
} from './constants.js';
import { PerlinNoise } from './perlin.js';

const TEX_SIZE = 128;
const ATLAS_COLS = 8;

function shadeColor(c, amount) {
    return [
        Math.max(0, Math.min(255, c[0] + amount)),
        Math.max(0, Math.min(255, c[1] + amount)),
        Math.max(0, Math.min(255, c[2] + amount)),
    ];
}

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function drawTexture(ctx, w, h, drawFn) {
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tc = temp.getContext('2d');
    const imgData = tc.createImageData(w, h);
    drawFn(imgData.data, w, h);
    tc.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(temp, 0, 0, TEX_SIZE, TEX_SIZE);
}

function fbm2D(noise, x, y, octaves, scale) {
    let v = 0, amp = 1, freq = 1;
    for (let i = 0; i < octaves; i++) {
        v += noise.noise2D(x * freq * scale, y * freq * scale) * amp;
        amp *= 0.5; freq *= 2;
    }
    return v * 0.5 + 0.5;
}

// ====== 紋理產生器 ======
function stoneGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 5, 0.04);
                const d = detailNoise.noise2D(x * 0.1, y * 0.1) * 0.3;
                const cracks = Math.abs(noise.noise2D(x * 0.08, y * 0.08)) < 0.06 ? -20 : 0;
                const base = 130 + n * 40 + d * 50 + cracks;
                data[i] = clamp(base, 60, 200); data[i+1] = clamp(base - 3, 55, 195); data[i+2] = clamp(base - 5, 50, 190); data[i+3] = 255;
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
                const r = 105 + n * 30; const g = 75 + n * 25; const b = 45 + n * 20;
                data[i] = clamp(r, 50, 160); data[i+1] = clamp(g, 40, 130); data[i+2] = clamp(b, 25, 90); data[i+3] = 255;
            }
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
                if (flower > 0.47 && flower < 0.50) {
                    data[i] = 255; data[i+1] = 220; data[i+2] = 100;
                } else {
                    data[i] = 60 + n * 60; data[i+1] = 130 + n * 50; data[i+2] = 35 + n * 30;
                }
                data[i+3] = 255;
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
                    data[i] = 70 + n * 40; data[i+1] = 100 + n * 60; data[i+2] = 30 + n * 30;
                } else if (ty < 0.35) {
                    const t = (ty - 0.2) / 0.15;
                    data[i] = clamp(lerp(80, 110, t) + n * 30, 50, 150); data[i+1] = clamp(lerp(140, 85, t) + n * 25, 60, 180); data[i+2] = clamp(lerp(45, 50, t) + n * 20, 30, 90);
                } else {
                    data[i] = clamp(105 + n * 30, 60, 160); data[i+1] = clamp(75 + n * 25, 50, 130); data[i+2] = clamp(45 + n * 20, 30, 90);
                }
                data[i+3] = 255;
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
                data[i] = stripe ? 100+n*20 : 140+n*20; data[i+1] = stripe ? 60+n*15 : 90+n*15; data[i+2] = stripe ? 25+n*10 : 45+n*10; data[i+3] = 255;
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
                data[i] = 30 + n * 35; data[i+1] = 110 + n * 35; data[i+2] = 25 + n * 25; data[i+3] = 210;
            }
        }
    };
}
function oreStoneGenerator(baseNoise, oreNoise, oreColor, oreChance) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(baseNoise, x, y, 3, 0.04);
                const ore = fbm2D(oreNoise, x, y, 2, 0.08);
                const base = 125 + n * 35;
                if (ore > (1 - oreChance)) {
                    data[i] = oreColor[0]; data[i+1] = oreColor[1]; data[i+2] = oreColor[2];
                } else {
                    data[i] = base; data[i+1] = base - 3; data[i+2] = base - 5;
                }
                data[i+3] = 255;
            }
        }
    };
}

// 其餘生成器簡化以節省空間
function basicGen(r, g, b) { return (data, w, h) => { for(let i=0; i<w*h*4; i+=4){ data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255; } }; }

import * as THREE from 'three';
import {
    AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, PLANKS, COBBLESTONE,
    BRICK, GRAVEL, SNOW, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE,
    BEDROCK, GLASS, STONE_BRICK, CRAFTING_TABLE, FURNACE
} from './constants.js';
import { PerlinNoise } from './perlin.js';

const TEX_SIZE = 128;
const ATLAS_COLS = 8;

function lerp(a, b, t) { return a + (b - a) * t; }
function clamp(v, mn, mx) { return Math.max(mn, Math.min(mx, v)); }

function drawTexture(ctx, w, h, drawFn) {
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tc = temp.getContext('2d');
    const imgData = tc.createImageData(w, h);
    drawFn(imgData.data, w, h);
    tc.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(temp, 0, 0, TEX_SIZE, TEX_SIZE);
}

function fbm2D(noise, x, y, octaves, scale) {
    let v = 0, amp = 1, freq = 1;
    for (let i = 0; i < octaves; i++) {
        v += noise.noise2D(x * freq * scale, y * freq * scale) * amp;
        amp *= 0.5; freq *= 2;
    }
    return v * 0.5 + 0.5;
}

// ====== 紋理產生器 (高清寫實程式化生成) ======
// 注意：由於外部圖片連結(Unsplash等)常因跨域或無效ID導致變為灰色方塊，
// 這裡重新啟用並大幅強化了「程式化生成」來確保 128x128 高清材質的一致性與匹配度。

function stoneGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 5, 0.04);
                const d = detailNoise.noise2D(x * 0.1, y * 0.1) * 0.3;
                const cracks = Math.abs(noise.noise2D(x * 0.08, y * 0.08)) < 0.06 ? -25 : 0;
                const base = 120 + n * 45 + d * 55 + cracks;
                data[i] = clamp(base, 50, 200); data[i+1] = clamp(base - 5, 45, 195); data[i+2] = clamp(base - 10, 40, 190); data[i+3] = 255;
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
                const r = 95 + n * 35 + pebble; const g = 65 + n * 25 + pebble; const b = 35 + n * 20 + pebble;
                data[i] = clamp(r, 40, 150); data[i+1] = clamp(g, 30, 120); data[i+2] = clamp(b, 20, 80); data[i+3] = 255;
            }
        }
    };
}
function grassTopGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.06);
                const flower = Math.abs(detailNoise.noise2D(x * 0.1, y * 0.1));
                if (flower > 0.48 && flower < 0.50) {
                    data[i] = 250; data[i+1] = 210; data[i+2] = 80;
                } else {
                    data[i] = 50 + n * 65; data[i+1] = 140 + n * 55; data[i+2] = 30 + n * 35;
                }
                data[i+3] = 255;
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
                const edge = 0.2 + noise.noise2D(x*0.1, y*0.1)*0.05;
                if (ty < edge) {
                    data[i] = 60 + n * 45; data[i+1] = 120 + n * 65; data[i+2] = 30 + n * 35;
                } else if (ty < edge + 0.15) {
                    const t = (ty - edge) / 0.15;
                    data[i] = clamp(lerp(70, 95, t) + n * 30, 40, 150); data[i+1] = clamp(lerp(120, 65, t) + n * 25, 50, 180); data[i+2] = clamp(lerp(30, 35, t) + n * 20, 20, 90);
                } else {
                    data[i] = clamp(95 + n * 35, 50, 150); data[i+1] = clamp(65 + n * 25, 40, 120); data[i+2] = clamp(35 + n * 20, 20, 80);
                }
                data[i+3] = 255;
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
                const bark = detailNoise.noise2D(x * 0.2, y * 0.05) > 0.3 ? -20 : 0;
                data[i] = stripe ? 90+n*25+bark : 130+n*25+bark; data[i+1] = stripe ? 50+n*20+bark : 80+n*20+bark; data[i+2] = stripe ? 20+n*15+bark : 40+n*15+bark; data[i+3] = 255;
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
                    data[i] = 40; data[i+1] = 80; data[i+2] = 20; data[i+3] = 100; // 透光縫隙
                } else {
                    data[i] = 30 + n * 40; data[i+1] = 110 + n * 45; data[i+2] = 25 + n * 30; data[i+3] = 255;
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
                const n = fbm2D(baseNoise, x, y, 3, 0.04);
                const ore = fbm2D(oreNoise, x, y, 2, 0.08);
                const base = 120 + n * 40;
                if (ore > (1 - oreChance)) {
                    data[i] = oreColor[0]; data[i+1] = oreColor[1]; data[i+2] = oreColor[2];
                } else {
                    data[i] = base; data[i+1] = base - 5; data[i+2] = base - 10;
                }
                data[i+3] = 255;
            }
        }
    };
}

// 其餘生成器簡化以節省空間
function basicGen(r, g, b) { return (data, w, h) => { for(let i=0; i<w*h*4; i+=4){ data[i]=r; data[i+1]=g; data[i+2]=b; data[i+3]=255; } }; }

// ====== 圖集建立 (ASYNC) ======
export async function createTextureAtlasAsync(onProgress) {
    const noisePairs = Array(24).fill(0).map((_, i) => ({ noise: new PerlinNoise(100 + i), detail: new PerlinNoise(200 + i) }));

    const generators = [
        { fn: grassTopGenerator(noisePairs[2].noise, noisePairs[2].detail), name: 'grass_top' },
        { fn: grassSideGenerator(noisePairs[3].noise), name: 'grass_side' },
        { fn: dirtGenerator(noisePairs[1].noise), name: 'dirt' },
        { fn: stoneGenerator(noisePairs[0].noise, noisePairs[0].detail), name: 'stone' },
        { fn: woodSideGenerator(noisePairs[4].noise, noisePairs[4].detail), name: 'wood_side' },
        { fn: (out, w, h) => basicGen(150, 100, 50)(out, w, h), name: 'wood_top' },
        { fn: leavesGenerator(noisePairs[6].noise), name: 'leaves' },
        { fn: (out, w, h) => basicGen(220, 200, 150)(out, w, h), name: 'sand' },
        { fn: (out, w, h) => basicGen(160, 120, 60)(out, w, h), name: 'planks' },
        { fn: (out, w, h) => basicGen(100, 100, 100)(out, w, h), name: 'cobblestone' },
        { fn: (out, w, h) => basicGen(180, 80, 60)(out, w, h), name: 'brick' },
        { fn: (out, w, h) => basicGen(120, 120, 120)(out, w, h), name: 'gravel' },
        { fn: (out, w, h) => basicGen(240, 240, 255)(out, w, h), name: 'snow' },
        { fn: oreStoneGenerator(noisePairs[13].noise, noisePairs[13].detail, [40, 40, 40], 0.25), name: 'coal_ore' },
        { fn: oreStoneGenerator(noisePairs[14].noise, noisePairs[14].detail, [185, 160, 130], 0.18), name: 'iron_ore' },
        { fn: oreStoneGenerator(noisePairs[15].noise, noisePairs[15].detail, [235, 210, 70], 0.12), name: 'gold_ore' },
        { fn: oreStoneGenerator(noisePairs[16].noise, noisePairs[16].detail, [120, 220, 240], 0.10), name: 'diamond_ore' },
        { fn: (out, w, h) => basicGen(50, 50, 50)(out, w, h), name: 'bedrock' },
        { fn: (out, w, h) => basicGen(180, 220, 255)(out, w, h), name: 'glass' }, // 後續處理透明度
        { fn: (out, w, h) => basicGen(120, 120, 125)(out, w, h), name: 'stone_brick' },
        { fn: (out, w, h) => basicGen(150, 110, 60)(out, w, h), name: 'crafting_table_top' },
        { fn: (out, w, h) => basicGen(130, 90, 50)(out, w, h), name: 'crafting_table_side' },
        { fn: (out, w, h) => basicGen(100, 100, 100)(out, w, h), name: 'furnace_top' },
        { fn: (out, w, h) => basicGen(90, 90, 90)(out, w, h), name: 'furnace_side' },
    ];

    const atlasW = ATLAS_COLS * TEX_SIZE;
    const atlasH = Math.ceil(generators.length / ATLAS_COLS) * TEX_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = atlasW; canvas.height = atlasH;
    const ctx = canvas.getContext('2d');

    for (let idx = 0; idx < generators.length; idx++) {
        const gen = generators[idx];
        const x = (idx % ATLAS_COLS) * TEX_SIZE;
        const y = Math.floor(idx / ATLAS_COLS) * TEX_SIZE;
        ctx.save(); ctx.translate(x, y);
        drawTexture(ctx, 128, 128, gen.fn);
        ctx.restore();
        
        if (idx === 18) { // 玻璃特殊透明處理
            ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fillRect(x, y, TEX_SIZE, TEX_SIZE);
        }
        
        if (onProgress) onProgress(idx / generators.length, `生成高清紋理 ${gen.name}...`);
        await new Promise(r => setTimeout(r, 0));
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 4;
    texture.generateMipmaps = true;

    const tileW = TEX_SIZE / atlasW, tileH = TEX_SIZE / atlasH;
    const blockTextures = {
        [GRASS]:{top:0,bottom:2,side:1}, [DIRT]:{top:2,bottom:2,side:2}, [STONE]:{top:3,bottom:3,side:3},
        [WOOD]:{top:5,bottom:5,side:4}, [LEAVES]:{top:6,bottom:6,side:6}, [SAND]:{top:7,bottom:7,side:7},
        [PLANKS]:{top:8,bottom:8,side:8}, [COBBLESTONE]:{top:9,bottom:9,side:9}, [BRICK]:{top:10,bottom:10,side:10},
        [GRAVEL]:{top:11,bottom:11,side:11}, [SNOW]:{top:12,bottom:12,side:12}, [COAL_ORE]:{top:13,bottom:13,side:13},
        [IRON_ORE]:{top:14,bottom:14,side:14}, [GOLD_ORE]:{top:15,bottom:15,side:15}, [DIAMOND_ORE]:{top:16,bottom:16,side:16},
        [BEDROCK]:{top:17,bottom:17,side:17}, [GLASS]:{top:18,bottom:18,side:18}, [STONE_BRICK]:{top:19,bottom:19,side:19},
        [CRAFTING_TABLE]:{top:20,bottom:8,side:21}, [FURNACE]:{top:22,bottom:22,side:23}
    };

    function getBlockUVs(blockType, face) {
        const bt = blockTextures[blockType] || blockTextures[STONE];
        const idx = face === 'top' ? bt.top : (face === 'bottom' ? bt.bottom : bt.side);
        const c = idx % ATLAS_COLS, r = Math.floor(idx / ATLAS_COLS);
        return { u: c * tileW, v: 1 - (r + 1) * tileH, u2: (c + 1) * tileW, v2: 1 - r * tileH };
    }

    function createBlockPreview(blockType, size = 48) {
        const uv = getBlockUVs(blockType, 'side'); // 背包預覽改為顯示側面，這樣比較符合物品外觀
        const preview = document.createElement('canvas');
        preview.width = size; preview.height = size;
        const pctx = preview.getContext('2d');
        pctx.drawImage(canvas, uv.u * atlasW, canvas.height - uv.v2 * canvas.height, TEX_SIZE, TEX_SIZE, 0, 0, size, size);
        return preview;
    }

    return { texture, getBlockUVs, canvas, createBlockPreview };
}
