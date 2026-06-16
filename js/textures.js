import * as THREE from 'three';
import { AIR, GRASS, DIRT, STONE, WOOD, LEAVES, SAND, PLANKS, COBBLESTONE, BRICK, GRAVEL, SNOW, COAL_ORE, IRON_ORE, GOLD_ORE, DIAMOND_ORE, BEDROCK, GLASS, STONE_BRICK, CRAFTING_TABLE, FURNACE } from './constants.js';

const TEX_SIZE = 16;
const ATLAS_COLS = 8;
const SEED = 42;

class SeededRandom {
    constructor(s) { this.s = s | 0; }
    next() { this.s = (this.s * 1664525 + 1013904223) | 0; return (this.s >>> 0) / 4294967296; }
    range(min, max) { return min + this.next() * (max - min); }
    int(min, max) { return Math.floor(this.range(min, max + 1)); }
}

function shadeColor(c, amount) {
    return [
        Math.max(0, Math.min(255, c[0] + amount)),
        Math.max(0, Math.min(255, c[1] + amount)),
        Math.max(0, Math.min(255, c[2] + amount)),
    ];
}

function hexToRgb(hex) {
    return [(hex >> 16) & 255, (hex >> 8) & 255, hex & 255];
}

function noiseMap(w, h, scale, rng, octaves = 3) {
    const map = new Float32Array(w * h);
    for (let o = 0; o < octaves; o++) {
        const freq = 1 << o;
        const amp = 1 / (o + 1);
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = y * w + x;
                const v = rng.next();
                map[i] += v * amp;
            }
        }
    }
    let min = Infinity, max = -Infinity;
    for (let i = 0; i < map.length; i++) { if (map[i] < min) min = map[i]; if (map[i] > max) max = map[i]; }
    const range = max - min || 1;
    for (let i = 0; i < map.length; i++) map[i] = (map[i] - min) / range;
    return map;
}

function drawPixelated(ctx, w, h, drawFn) {
    const temp = document.createElement('canvas');
    temp.width = w; temp.height = h;
    const tc = temp.getContext('2d');
    const imgData = tc.createImageData(w, h);
    drawFn(imgData.data, w, h);
    tc.putImageData(imgData, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(temp, 0, 0, TEX_SIZE, TEX_SIZE);
}

function createStoneTexture(rng) {
    const base = [130, 130, 130];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                const v = n > 0.6 ? shadeColor(base, rng.int(-30, 10)) : shadeColor(base, rng.int(-15, 15));
                data[i] = v[0]; data[i+1] = v[1]; data[i+2] = v[2]; data[i+3] = 255;
            }
        }
        // Add crack lines
        for (let c = 0; c < 3; c++) {
            const sx = rng.int(1, w - 2);
            const sy = rng.int(1, h - 2);
            for (let l = 0; l < rng.int(2, 5); l++) {
                const px = Math.min(w - 1, Math.max(0, sx + (rng.next() > 0.5 ? 1 : -1) * l));
                const py = Math.min(h - 1, Math.max(0, sy + (rng.next() > 0.5 ? 1 : -1)));
                const i = (py * w + px) * 4;
                const dark = shadeColor(base, -40);
                data[i] = dark[0]; data[i+1] = dark[1]; data[i+2] = dark[2];
            }
        }
    };
}

function createDirtTexture(rng) {
    const base = [120, 85, 50];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                if (n < 0.1) {
                    const dark = shadeColor(base, -40);
                    data[i] = dark[0]; data[i+1] = dark[1]; data[i+2] = dark[2];
                } else if (n < 0.15) {
                    const light = shadeColor(base, 25);
                    data[i] = light[0]; data[i+1] = light[1]; data[i+2] = light[2];
                } else {
                    data[i] = base[0]; data[i+1] = base[1]; data[i+2] = base[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createGrassTopTexture(rng) {
    const base = [90, 160, 50];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                if (n < 0.08) {
                    const flower = rng.int(0, 2) === 0 ? [255, 255, 100] : [255, 100, 200];
                    data[i] = flower[0]; data[i+1] = flower[1]; data[i+2] = flower[2];
                } else {
                    const shade = shadeColor(base, rng.int(-25, 20));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                }
                data[i+3] = 255;
            }
        }
        // Grass blades on top row
        for (let x = 0; x < w; x += 2) {
            const i = x * 4;
            data[i] = 70; data[i+1] = 180; data[i+2] = 40; data[i+3] = 255;
        }
    };
}

function createGrassSideTexture(rng) {
    return (data, w, h) => {
        // Top 4 rows: grass color, bottom 12 rows: dirt color
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (y < 4) {
                    const shade = shadeColor([90, 160, 50], rng.int(-20, 15));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                } else if (y < 6) {
                    const t = (y - 4) / 2;
                    const g = Math.round(90 * (1 - t) + 120 * t);
                    const r2 = Math.round(160 * (1 - t) + 85 * t);
                    const b2 = Math.round(50 * (1 - t) + 50 * t);
                    const shade = shadeColor([r2, g, b2], rng.int(-10, 10));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                } else {
                    const shade = shadeColor([120, 85, 50], rng.int(-15, 15));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createWoodSideTexture(rng) {
    const dark = [90, 55, 25];
    const light = [130, 85, 40];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            const stripe = (Math.floor(y / 3) % 2 === 0);
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const base = stripe ? dark : light;
                const shade = shadeColor(base, rng.int(-8, 8));
                data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 255;
            }
        }
    };
}

function createWoodTopTexture(rng) {
    const base = [145, 105, 55];
    const ring = [110, 75, 35];
    return (data, w, h) => {
        const cx = w / 2, cy = h / 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2) / (w / 2);
                const isRing = Math.abs(dist * 4 % 1 - 0.5) < 0.15;
                const col = isRing ? ring : base;
                const shade = shadeColor(col, rng.int(-10, 10));
                data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 255;
            }
        }
    };
}

function createLeavesTexture(rng) {
    const dark = [40, 100, 20];
    const light = [60, 140, 35];
    const bright = [80, 170, 50];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                let col;
                if (n < 0.15) col = dark;
                else if (n < 0.7) col = light;
                else col = bright;
                const shade = shadeColor(col, rng.int(-10, 10));
                data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 240;
            }
        }
    };
}

function createSandTexture(rng) {
    const base = [220, 200, 145];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const v = rng.next();
                if (v < 0.05) {
                    const dot = shadeColor(base, -30);
                    data[i] = dot[0]; data[i+1] = dot[1]; data[i+2] = dot[2];
                } else {
                    const shade = shadeColor(base, rng.int(-10, 10));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createPlanksTexture(rng) {
    const base = [160, 115, 55];
    const dark = [130, 90, 40];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isLine = (y % 4 === 0);
                const col = isLine ? dark : base;
                const shade = shadeColor(col, rng.int(-5, 5));
                data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 255;
            }
        }
    };
}

function createCobblestoneTexture(rng) {
    const base = [110, 110, 110];
    const dark = [75, 75, 75];
    const light = [140, 140, 140];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                let col;
                if (n < 0.25) col = dark;
                else if (n < 0.75) col = base;
                else col = light;
                const border = (x === 0 || x === w - 1 || y === 0 || y === h - 1);
                if (border && rng.next() > 0.3) {
                    const mortar = shadeColor(col, -35);
                    data[i] = mortar[0]; data[i+1] = mortar[1]; data[i+2] = mortar[2];
                } else {
                    data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createBrickTexture(rng) {
    const brick1 = [165, 80, 60];
    const brick2 = [145, 70, 50];
    const mortar = [70, 60, 50];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isHorizMortar = (y % 5 === 4);
                const offset = (Math.floor(y / 5) % 2) * 4;
                const isVertMortar = ((x + offset) % 8 === 7);
                if (isHorizMortar || isVertMortar) {
                    data[i] = mortar[0]; data[i+1] = mortar[1]; data[i+2] = mortar[2];
                } else {
                    const col = ((x + y) % 8 < 4) ? brick1 : brick2;
                    const shade = shadeColor(col, rng.int(-8, 8));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createGravelTexture(rng) {
    const base = [125, 115, 105];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                if (n < 0.2) {
                    const dot = shadeColor(base, rng.int(-30, 30));
                    data[i] = dot[0]; data[i+1] = dot[1]; data[i+2] = dot[2];
                } else {
                    data[i] = base[0]; data[i+1] = base[1]; data[i+2] = base[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createSnowTexture(rng) {
    const white = [240, 245, 250];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const shade = shadeColor(white, rng.int(-8, 3));
                data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 255;
            }
        }
    };
}

function createOreTexture(rng, baseColor, speckColor, speckChance) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (rng.next() < speckChance) {
                    data[i] = speckColor[0]; data[i+1] = speckColor[1]; data[i+2] = speckColor[2];
                } else {
                    const shade = shadeColor(baseColor, rng.int(-12, 12));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createBedrockTexture(rng) {
    const base = [55, 50, 45];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = rng.next();
                if (n < 0.15) {
                    const dark = [30, 28, 25];
                    data[i] = dark[0]; data[i+1] = dark[1]; data[i+2] = dark[2];
                } else if (n < 0.25) {
                    data[i] = base[0]+15; data[i+1] = base[1]+12; data[i+2] = base[2]+10;
                } else {
                    data[i] = base[0]; data[i+1] = base[1]; data[i+2] = base[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

function createGlassTexture(rng) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isBorder = (x === 0 || x === w-1 || y === 0 || y === h-1);
                if (isBorder) {
                    const v = 180 + rng.int(-20, 20);
                    data[i] = v; data[i+1] = v; data[i+2] = 255; data[i+3] = 200;
                } else {
                    data[i] = 200; data[i+1] = 220; data[i+2] = 255; data[i+3] = 80;
                }
            }
        }
    };
}

function createStoneBrickTexture(rng) {
    const base = [125, 125, 125];
    const dark = [100, 100, 100];
    const mortar = [70, 70, 70];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isHoriz = (y % 5 === 4);
                const isVert = (x % 8 === 7);
                if (isHoriz || isVert) {
                    data[i] = mortar[0]; data[i+1] = mortar[1]; data[i+2] = mortar[2]; data[i+3] = 255;
                } else {
                    const col = (Math.floor(y/5) + Math.floor(x/8)) % 2 === 0 ? base : dark;
                    const shade = shadeColor(col, rng.int(-8, 8));
                    data[i] = shade[0]; data[i+1] = shade[1]; data[i+2] = shade[2]; data[i+3] = 255;
                }
            }
        }
    };
}

function createCraftingTableTopTexture(rng) {
    const wood = [140, 100, 50];
    const grid = [80, 55, 25];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isGrid = (x % 4 === 3) || (y % 4 === 3);
                const col = isGrid ? grid : shadeColor(wood, rng.int(-8, 8));
                data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2]; data[i+3] = 255;
            }
        }
    };
}

function createCraftingTableSideTexture(rng) {
    const wood = [140, 100, 50];
    const tool = [100, 80, 60];
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                if (y < 4) {
                    const col = shadeColor(tool, rng.int(-6, 6));
                    data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2];
                } else {
                    const stripe = (Math.floor(y / 2) % 2 === 0);
                    const base = stripe ? wood : shadeColor(wood, -15);
                    const col = shadeColor(base, rng.int(-6, 6));
                    data[i] = col[0]; data[i+1] = col[1]; data[i+2] = col[2];
                }
                data[i+3] = 255;
            }
        }
    };
}

// Each block type: { top, bottom, side } texture indices
export function createTextureAtlas() {
    const rng = new SeededRandom(SEED);

    // All texture generators in order
    const generators = [
        createGrassTopTexture(rng),           // 0: grass_top
        createGrassSideTexture(rng),           // 1: grass_side
        createDirtTexture(rng),                // 2: dirt
        createStoneTexture(rng),               // 3: stone
        createWoodSideTexture(rng),            // 4: wood_side
        createWoodTopTexture(rng),             // 5: wood_top
        createLeavesTexture(rng),              // 6: leaves
        createSandTexture(rng),                // 7: sand
        createPlanksTexture(rng),              // 8: planks
        createCobblestoneTexture(rng),         // 9: cobblestone
        createBrickTexture(rng),               // 10: brick
        createGravelTexture(rng),              // 11: gravel
        createSnowTexture(rng),                // 12: snow
        createOreTexture(rng, [130,130,130], [40,40,40], 0.25),    // 13: coal_ore
        createOreTexture(rng, [130,130,130], [185,160,130], 0.18), // 14: iron_ore
        createOreTexture(rng, [130,130,130], [235,210,70], 0.12),  // 15: gold_ore
        createOreTexture(rng, [130,130,130], [120,220,240], 0.10), // 16: diamond_ore
        createBedrockTexture(rng),             // 17: bedrock
        createGlassTexture(rng),               // 18: glass
        createStoneBrickTexture(rng),          // 19: stone_brick
        createCraftingTableTopTexture(rng),    // 20: crafting_table_top
        createCraftingTableSideTexture(rng),   // 21: crafting_table_side
    ];

    const atlasW = ATLAS_COLS * TEX_SIZE;
    const atlasH = Math.ceil(generators.length / ATLAS_COLS) * TEX_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');

    generators.forEach((gen, idx) => {
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        const x = col * TEX_SIZE;
        const y = row * TEX_SIZE;

        ctx.save();
        ctx.translate(x, y);
        drawPixelated(ctx, TEX_SIZE, TEX_SIZE, gen);
        ctx.restore();
    });

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.NearestFilter;
    texture.minFilter = THREE.NearestFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;

    const cols = ATLAS_COLS;
    const tileW = 1 / cols;
    const tileH = TEX_SIZE / atlasH;

    function uvRect(idx) {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        return {
            u: c * tileW, v: 1 - (r + 1) * tileH,
            u2: (c + 1) * tileW, v2: 1 - r * tileH,
            w: tileW, h: tileH,
        };
    }

    // Block texture mappings: { top, bottom, side } → atlas index
    const blockTextures = {
        [GRASS]:    { top: 0, bottom: 2, side: 1 },
        [DIRT]:     { top: 2, bottom: 2, side: 2 },
        [STONE]:    { top: 3, bottom: 3, side: 3 },
        [WOOD]:     { top: 5, bottom: 5, side: 4 },
        [LEAVES]:   { top: 6, bottom: 6, side: 6 },
        [SAND]:     { top: 7, bottom: 7, side: 7 },
        [PLANKS]:   { top: 8, bottom: 8, side: 8 },
        [COBBLESTONE]: { top: 9, bottom: 9, side: 9 },
        [BRICK]:    { top: 10, bottom: 10, side: 10 },
        [GRAVEL]:   { top: 11, bottom: 11, side: 11 },
        [SNOW]:     { top: 12, bottom: 12, side: 12 },
        [COAL_ORE]: { top: 13, bottom: 13, side: 13 },
        [IRON_ORE]: { top: 14, bottom: 14, side: 14 },
        [GOLD_ORE]: { top: 15, bottom: 15, side: 15 },
        [DIAMOND_ORE]: { top: 16, bottom: 16, side: 16 },
        [BEDROCK]:  { top: 17, bottom: 17, side: 17 },
        [GLASS]:    { top: 18, bottom: 18, side: 18 },
        [STONE_BRICK]: { top: 19, bottom: 19, side: 19 },
        [CRAFTING_TABLE]: { top: 20, bottom: 8, side: 21 },
    };

    function getBlockUVs(blockType, face) {
        const bt = blockTextures[blockType] || blockTextures[STONE];
        const idx = face === 'top' ? bt.top : (face === 'bottom' ? bt.bottom : bt.side);
        return uvRect(idx);
    }

    function createBlockPreview(blockType, size = 48) {
        const uv = getBlockUVs(blockType, 'top');
        const cols = ATLAS_COLS;
        const tileH = TEX_SIZE / atlasH;
        const srcX = (uv.u * atlasW);
        const srcY = canvas.height - (uv.v2 * canvas.height);
        const srcW = TEX_SIZE;
        const srcH = TEX_SIZE;

        const preview = document.createElement('canvas');
        preview.width = size;
        preview.height = size;
        const pctx = preview.getContext('2d');
        pctx.imageSmoothingEnabled = false;
        pctx.drawImage(canvas, srcX, srcY, srcW, srcH, 0, 0, size, size);
        return preview;
    }

    return { texture, getBlockUVs, canvas, createBlockPreview };
}
