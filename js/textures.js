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

// ====== 圖集建立 (ASYNC) ======
export async function createTextureAtlasAsync(onProgress) {
    const TEX_SIZE = 128;
    const ATLAS_COLS = 8;
    
    // 寫實高清網絡圖片 URL 列表
    const textureUrls = [
        "https://images.unsplash.com/photo-1533460004989-cef01064af7e?auto=format&fit=crop&w=128&q=80", // 0: grass_top (草地)
        "https://images.unsplash.com/photo-1552288092-76e7d732366c?auto=format&fit=crop&w=128&q=80", // 1: grass_side (草地側面/帶點泥土)
        "https://images.unsplash.com/photo-1587834571064-16a7f5d9cbfa?auto=format&fit=crop&w=128&q=80", // 2: dirt (泥土)
        "https://images.unsplash.com/photo-1525926472898-7517c569f658?auto=format&fit=crop&w=128&q=80", // 3: stone (石頭)
        "https://images.unsplash.com/photo-1546484396-fb3f6af2005b?auto=format&fit=crop&w=128&q=80", // 4: wood_side (樹皮)
        "https://images.unsplash.com/photo-1550664890-c1e14ddeecad?auto=format&fit=crop&w=128&q=80", // 5: wood_top (原木頂部)
        "https://images.unsplash.com/photo-1542385151-efd9000785a0?auto=format&fit=crop&w=128&q=80", // 6: leaves (樹葉)
        "https://images.unsplash.com/photo-1501785888041-af3ef285b470?auto=format&fit=crop&w=128&q=80", // 7: sand (沙子)
        "https://images.unsplash.com/photo-1511516091090-e7178c78a05c?auto=format&fit=crop&w=128&q=80", // 8: planks (木板)
        "https://images.unsplash.com/photo-1518098268026-4e89f1a2cb8b?auto=format&fit=crop&w=128&q=80", // 9: cobblestone (鵝卵石)
        "https://images.unsplash.com/photo-1517646287270-a5a9ca602518?auto=format&fit=crop&w=128&q=80", // 10: brick (紅磚)
        "https://images.unsplash.com/photo-1496055401924-5e7fdc885742?auto=format&fit=crop&w=128&q=80", // 11: gravel (礫石)
        "https://images.unsplash.com/photo-1542601098-8fc114e148e2?auto=format&fit=crop&w=128&q=80", // 12: snow (雪)
        "https://images.unsplash.com/photo-1620380757270-e4b2d39999a4?auto=format&fit=crop&w=128&q=80", // 13: coal_ore (煤礦)
        "https://images.unsplash.com/photo-1587840180479-7c427f71b96a?auto=format&fit=crop&w=128&q=80", // 14: iron_ore (鐵礦)
        "https://images.unsplash.com/photo-1618365908648-e71bb5718361?auto=format&fit=crop&w=128&q=80", // 15: gold_ore (金礦)
        "https://images.unsplash.com/photo-1579546929518-9e396f3cc809?auto=format&fit=crop&w=128&q=80", // 16: diamond_ore (鑽石礦)
        "https://images.unsplash.com/photo-1601662528567-526cd06f6582?auto=format&fit=crop&w=128&q=80", // 17: bedrock (基岩)
        "https://images.unsplash.com/photo-1522204523234-8729aa6e3d5f?auto=format&fit=crop&w=128&q=80", // 18: glass (玻璃)
        "https://images.unsplash.com/photo-1525926472898-7517c569f658?auto=format&fit=crop&w=128&q=80", // 19: stone_brick (石磚)
        "https://images.unsplash.com/photo-1511516091090-e7178c78a05c?auto=format&fit=crop&w=128&q=80", // 20: crafting_table_top (工作台頂部)
        "https://images.unsplash.com/photo-1546484396-fb3f6af2005b?auto=format&fit=crop&w=128&q=80", // 21: crafting_table_side (工作台側面)
        "https://images.unsplash.com/photo-1518098268026-4e89f1a2cb8b?auto=format&fit=crop&w=128&q=80", // 22: furnace_top (熔爐頂部)
        "https://images.unsplash.com/photo-1620380757270-e4b2d39999a4?auto=format&fit=crop&w=128&q=80"  // 23: furnace_side (熔爐側面)
    ];

    const atlasW = ATLAS_COLS * TEX_SIZE;
    const atlasH = Math.ceil(textureUrls.length / ATLAS_COLS) * TEX_SIZE;
    const canvas = document.createElement('canvas');
    canvas.width = atlasW; canvas.height = atlasH;
    const ctx = canvas.getContext('2d');

    // 載入圖片的輔助函數
    const loadImage = (url) => new Promise((resolve) => {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.onload = () => resolve(img);
        img.onerror = () => {
            // 下載失敗時返回一個填滿顏色的 Canvas 作為備用
            const fallback = document.createElement('canvas');
            fallback.width = TEX_SIZE; fallback.height = TEX_SIZE;
            const fctx = fallback.getContext('2d');
            fctx.fillStyle = '#888';
            fctx.fillRect(0, 0, TEX_SIZE, TEX_SIZE);
            resolve(fallback);
        };
        img.src = url;
    });

    for (let idx = 0; idx < textureUrls.length; idx++) {
        const x = (idx % ATLAS_COLS) * TEX_SIZE;
        const y = Math.floor(idx / ATLAS_COLS) * TEX_SIZE;
        
        if (onProgress) onProgress(idx / textureUrls.length, `下載高清紋理 ${idx + 1}/${textureUrls.length}...`);
        
        const img = await loadImage(textureUrls[idx]);
        ctx.drawImage(img, x, y, TEX_SIZE, TEX_SIZE);
        
        // 特殊處理玻璃的半透明
        if (idx === 18) {
            ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
            ctx.fillRect(x, y, TEX_SIZE, TEX_SIZE);
        }
        await new Promise(r => setTimeout(r, 0));
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter; // 使用 NearestFilter 保留像素感
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.anisotropy = 4; // 提升傾斜視角清晰度
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
        const uv = getBlockUVs(blockType, 'top');
        const preview = document.createElement('canvas');
        preview.width = size; preview.height = size;
        const pctx = preview.getContext('2d');
        pctx.drawImage(canvas, uv.u * atlasW, canvas.height - uv.v2 * canvas.height, TEX_SIZE, TEX_SIZE, 0, 0, size, size);
        return preview;
    }

    return { texture, getBlockUVs, canvas, createBlockPreview };
}
