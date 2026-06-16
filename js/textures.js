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

// ====== 雜訊輔助 ======
function fbm1D(noise, x, octaves, scale) {
    let v = 0, amp = 1, freq = 1;
    for (let i = 0; i < octaves; i++) {
        v += noise.noise2D(x * freq * scale, 0) * amp;
        amp *= 0.5; freq *= 2;
    }
    return v * 0.5 + 0.5;
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

                // 裂縫網格
                const crack1 = Math.abs(noise.noise2D(x * 0.03, y * 0.03));
                const crackVal = crack1 > 0.48 && crack1 < 0.52 ? -30 : 0;

                const base = 130 + n * 40 + d * 50 + cracks + crackVal;
                data[i] = clamp(base, 60, 200);
                data[i+1] = clamp(base - 3, 55, 195);
                data[i+2] = clamp(base - 5, 50, 190);
                data[i+3] = 255;
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
                const pebble = Math.abs(noise.noise2D(x * 0.15, y * 0.15));
                const darkSpot = pebble > 0.45 ? -30 : 0;
                const r = 105 + n * 30 + darkSpot;
                const g = 75 + n * 25 + darkSpot;
                const b = 45 + n * 20 + darkSpot;
                data[i] = clamp(r, 50, 160);
                data[i+1] = clamp(g, 40, 130);
                data[i+2] = clamp(b, 25, 90);
                data[i+3] = 255;
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
                const dark = detailNoise.noise2D(x * 0.2, y * 0.2);

                // 草叢與小花
                const grassBlade = Math.abs(noise.noise2D(x * 0.3 + y * 0.1, y * 0.3 - x * 0.1));
                const flower = Math.abs(detailNoise.noise2D(x * 0.08, y * 0.08));

                if (flower > 0.47 && flower < 0.50) {
                    // 小花
                    data[i] = 255; data[i+1] = 220; data[i+2] = 100;
                } else if (grassBlade > 0.48 && flower > 0.4) {
                    // 較亮的草葉
                    data[i] = 80 + n * 50; data[i+1] = 160 + n * 40 + dark * 20; data[i+2] = 40 + n * 30;
                } else {
                    data[i] = 60 + n * 60 + dark * 15;
                    data[i+1] = 130 + n * 50 + dark * 20;
                    data[i+2] = 35 + n * 30 + dark * 10;
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
                // 上部 25%: 草，下部 75%: 泥土，中間過渡
                if (ty < 0.2) {
                    const g = 100 + n * 60;
                    data[i] = 70 + n * 40; data[i+1] = g; data[i+2] = 30 + n * 30;
                } else if (ty < 0.35) {
                    const t = (ty - 0.2) / 0.15;
                    const r = lerp(80, 110, t) + n * 30;
                    const g = lerp(140, 85, t) + n * 25;
                    const b = lerp(45, 50, t) + n * 20;
                    data[i] = clamp(r, 50, 150); data[i+1] = clamp(g, 60, 180); data[i+2] = clamp(b, 30, 90);
                } else {
                    data[i] = clamp(105 + n * 30, 60, 160);
                    data[i+1] = clamp(75 + n * 25, 50, 130);
                    data[i+2] = clamp(45 + n * 20, 30, 90);
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
                const grain = Math.abs(detailNoise.noise2D(x * 0.15, y * 0.4));

                // 樹皮紋理：垂直條紋 + 粗糙感
                const stripe = (Math.floor(y / 4) % 2 === 0);
                const barkLine = Math.sin(y * 0.3 + x * 0.05) > 0.7;
                const base = stripe ? 100 : 140;
                const g = stripe ? 60 : 90;
                const b = stripe ? 25 : 45;

                const grainEffect = grain < 0.3 ? -15 : (grain > 0.7 ? 15 : 0);
                const r = clamp(base + n * 25 + grainEffect + (barkLine ? -10 : 0), 60, 170);
                const gg = clamp(g + n * 20 + grainEffect * 0.7, 35, 120);
                const bb = clamp(b + n * 15 + grainEffect * 0.5, 20, 70);
                data[i] = r; data[i+1] = gg; data[i+2] = bb; data[i+3] = 255;
            }
        }
    };
}

function woodTopGenerator(noise, detailNoise) {
    return (data, w, h) => {
        const cx = w / 2, cy = h / 2;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const dx = (x - cx) / cx, dy = (y - cy) / cy;
                const dist = Math.sqrt(dx * dx + dy * dy);
                const angle = Math.atan2(dy, dx);

                const n = detailNoise.noise2D(x * 0.2, y * 0.2);
                const ringVal = dist * 5 + noise.noise2D(x * 0.05, y * 0.05) * 0.3;
                const isRing = Math.abs(ringVal % 1 - 0.5) < 0.08;
                const isDark = Math.abs(ringVal % 1 - 0.5) < 0.15;

                const base = isRing ? 110 : 150;
                const darkA = isDark ? -15 : 0;
                const r = clamp(base + n * 20 + darkA, 80, 190);
                const g = clamp(base * 0.65 + n * 15 + darkA * 0.6, 50, 130);
                const b = clamp(base * 0.35 + n * 12 + darkA * 0.3, 30, 80);
                data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
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
                const cluster = Math.abs(noise.noise2D(x * 0.12, y * 0.12));

                if (cluster < 0.15) {
                    // 縫隙（透光）
                    data[i] = 50 + n * 30; data[i+1] = 120 + n * 40; data[i+2] = 30 + n * 20; data[i+3] = 120;
                } else if (cluster > 0.75) {
                    // 亮葉
                    data[i] = 40 + n * 40; data[i+1] = 140 + n * 40; data[i+2] = 35 + n * 30; data[i+3] = 230;
                } else {
                    data[i] = 30 + n * 35; data[i+1] = 110 + n * 35; data[i+2] = 25 + n * 25; data[i+3] = 200;
                }
            }
        }
    };
}

function sandGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.06);
                const dot = Math.abs(noise.noise2D(x * 0.25, y * 0.25));
                const dark = dot > 0.42 && dot < 0.44 ? -30 : 0;
                const r = clamp(215 + n * 20 + dark, 170, 245);
                const g = clamp(195 + n * 20 + dark, 150, 225);
                const b = clamp(140 + n * 15 + dark, 110, 170);
                data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
            }
        }
    };
}

function planksGenerator(noise, detailNoise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 2, 0.03);
                const grain = Math.abs(detailNoise.noise2D(x * 0.08, y * 0.12));
                const isLine = (y % 8 === 0) || (y % 8 === 1);
                const isGap = (y % 8 === 0) && (Math.sin(x * 0.2) > 0.3);
                const dark = isLine ? -25 : 0;
                const gapDark = isGap ? -40 : 0;

                const base = 160 + n * 25 + grain * 20;
                const g = 115 + n * 20 + grain * 15;
                const b = 55 + n * 15 + grain * 10;
                data[i] = clamp(base + dark + gapDark, 80, 200);
                data[i+1] = clamp(g + dark * 0.7 + gapDark, 60, 150);
                data[i+2] = clamp(b + dark * 0.5 + gapDark, 30, 90);
                data[i+3] = 255;
            }
        }
    };
}

function cobblestoneGenerator(noise, detailNoise) {
    return (data, w, h) => {
        const stoneSize = 24;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const sx = Math.floor(x / stoneSize);
                const sy = Math.floor(y / stoneSize);
                const seed = sx * 31 + sy * 17;
                const rng = ((seed * 16807) % 2147483647) / 2147483647;

                const offsetX = (rng - 0.5) * 4;
                const offsetY = (((seed * 48271) % 2147483647) / 2147483647 - 0.5) * 4;
                const lx = (x % stoneSize) - stoneSize / 2 + offsetX;
                const ly = (y % stoneSize) - stoneSize / 2 + offsetY;
                const dist = Math.sqrt(lx * lx + ly * ly) / (stoneSize * 0.45);

                const n = fbm2D(noise, x, y, 3, 0.04) * 30;
                const mortar = dist > 1 ? 20 : 0;
                const stoneBright = n + (1 - Math.min(dist, 1)) * 30;

                const base = 100 + stoneBright;
                data[i] = clamp(base + mortar * 0.3, 60, 180);
                data[i+1] = clamp(base * 0.98 + mortar * 0.3, 55, 175);
                data[i+2] = clamp(base * 0.95 + mortar * 0.3, 50, 170);
                data[i+3] = 255;
            }
        }
    };
}

function brickGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const brickH = 10, brickW = 20;
                const offset = (Math.floor(y / brickH) % 2) * (brickW / 2);
                const isMortarH = (y % brickH) >= brickH - 1;
                const isMortarV = ((x + offset) % brickW) >= brickW - 1;

                if (isMortarH || isMortarV) {
                    data[i] = 65; data[i+1] = 55; data[i+2] = 45;
                } else {
                    const n = fbm2D(noise, x, y, 3, 0.05);
                    const r = clamp(170 + n * 30, 120, 210);
                    const g = clamp(85 + n * 20, 55, 120);
                    const b = clamp(60 + n * 15, 40, 85);
                    data[i] = r; data[i+1] = g; data[i+2] = b;
                }
                data[i+3] = 255;
            }
        }
    };
}

function gravelGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 3, 0.06);
                const pebble = Math.abs(noise.noise2D(x * 0.2, y * 0.2));
                const r = clamp(120 + n * 25 + (pebble > 0.4 ? 20 : 0) - (pebble > 0.48 ? 30 : 0), 70, 170);
                const g = clamp(110 + n * 25 + (pebble > 0.4 ? 15 : 0) - (pebble > 0.48 ? 25 : 0), 65, 160);
                const b = clamp(100 + n * 20 + (pebble > 0.4 ? 10 : 0) - (pebble > 0.48 ? 20 : 0), 60, 150);
                data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
            }
        }
    };
}

function snowGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.05);
                const crystal = Math.abs(noise.noise2D(x * 0.2, y * 0.2));
                const highlight = crystal > 0.45 ? 15 : 0;
                const v = clamp(235 + n * 15 + highlight, 200, 255);
                data[i] = v; data[i+1] = v; data[i+2] = clamp(v + 5, 205, 255); data[i+3] = 255;
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
                    const oreBrightness = (ore - (1 - oreChance)) / oreChance;
                    data[i] = clamp(lerp(base, oreColor[0], oreBrightness), 30, 220);
                    data[i+1] = clamp(lerp(base - 3, oreColor[1], oreBrightness), 30, 200);
                    data[i+2] = clamp(lerp(base - 5, oreColor[2], oreBrightness), 30, 200);
                } else {
                    data[i] = clamp(base, 60, 190);
                    data[i+1] = clamp(base - 3, 55, 185);
                    data[i+2] = clamp(base - 5, 50, 180);
                }
                data[i+3] = 255;
            }
        }
    };
}

function bedrockGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 4, 0.06);
                const crack = Math.abs(noise.noise2D(x * 0.1, y * 0.1));
                const darkCrack = crack > 0.48 ? -25 : 0;
                const base = 50 + n * 20 + darkCrack;
                data[i] = clamp(base, 25, 90);
                data[i+1] = clamp(base - 3, 22, 85);
                data[i+2] = clamp(base - 5, 20, 80);
                data[i+3] = 255;
            }
        }
    };
}

function glassGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const isBorder = x < 3 || x >= w - 3 || y < 3 || y >= h - 3;
                const n = fbm2D(noise, x, y, 2, 0.04);
                if (isBorder) {
                    const v = 160 + n * 40;
                    data[i] = clamp(v, 120, 220);
                    data[i+1] = clamp(v + 10, 130, 230);
                    data[i+2] = clamp(v + 40, 160, 255);
                    data[i+3] = 180;
                } else {
                    data[i] = 180 + n * 40;
                    data[i+1] = 200 + n * 35;
                    data[i+2] = 230 + n * 25;
                    data[i+3] = 60;
                }
            }
        }
    };
}

function stoneBrickGenerator(noise) {
    return (data, w, h) => {
        const brickH = 20, brickW = 30;
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const row = Math.floor(y / brickH);
                const offset = (row % 2) * (brickW / 2);
                const isMortarH = (y % brickH) >= brickH - 2;
                const isMortarV = ((x + offset) % brickW) >= brickW - 2;

                if (isMortarH || isMortarV) {
                    data[i] = 70; data[i+1] = 65; data[i+2] = 60;
                } else {
                    const n = fbm2D(noise, x, y, 3, 0.04);
                    const r = clamp(125 + n * 30, 80, 180);
                    const g = clamp(122 + n * 28, 78, 175);
                    const b = clamp(118 + n * 25, 75, 170);
                    data[i] = r; data[i+1] = g; data[i+2] = b;
                }
                data[i+3] = 255;
            }
        }
    };
}

function craftingTableTopGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 2, 0.03);
                const gridLine = (Math.floor(x / (w / 4)) !== Math.floor((x - 1) / (w / 4))) ||
                                 (Math.floor(y / (h / 4)) !== Math.floor((y - 1) / (h / 4)));
                if (gridLine) {
                    const gv = 70 + n * 20;
                    data[i] = gv; data[i+1] = gv * 0.7; data[i+2] = gv * 0.4; data[i+3] = 255;
                } else {
                    const r = clamp(150 + n * 30, 110, 200);
                    const g = clamp(110 + n * 25, 75, 150);
                    const b = clamp(55 + n * 20, 35, 90);
                    data[i] = r; data[i+1] = g; data[i+2] = b; data[i+3] = 255;
                }
            }
        }
    };
}

function craftingTableSideGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 2, 0.03);
                const ty = y / h;
                if (ty < 0.15) {
                    // 頂部裝飾條
                    const r = clamp(110 + n * 20, 80, 150);
                    const g = clamp(85 + n * 15, 60, 115);
                    const b = clamp(50 + n * 12, 35, 75);
                    data[i] = r; data[i+1] = g; data[i+2] = b;
                } else {
                    const stripe = Math.floor(y / 6) % 2;
                    const base = stripe ? 145 : 130;
                    const r = clamp(base + n * 25, 95, 195);
                    const g = clamp(base * 0.72 + n * 20, 65, 145);
                    const b = clamp(base * 0.38 + n * 15, 35, 80);
                    data[i] = r; data[i+1] = g; data[i+2] = b;
                }
                data[i+3] = 255;
            }
        }
    };
}

function furnaceTopGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 2, 0.03);
                const cx = w / 2, cy = h / 2;
                const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);
                const inHole = dist < h * 0.25;

                if (inHole) {
                    const dark = 30 + n * 20 + (dist < h * 0.1 ? 0 : -10);
                    data[i] = clamp(dark, 15, 60);
                    data[i+1] = clamp(dark * 0.9, 12, 55);
                    data[i+2] = clamp(dark * 0.8, 10, 50);
                } else {
                    const v = clamp(110 + n * 25, 70, 160);
                    data[i] = v; data[i+1] = v * 0.95; data[i+2] = v * 0.9;
                }
                data[i+3] = 255;
            }
        }
    };
}

function furnaceSideGenerator(noise) {
    return (data, w, h) => {
        for (let y = 0; y < h; y++) {
            for (let x = 0; x < w; x++) {
                const i = (y * w + x) * 4;
                const n = fbm2D(noise, x, y, 2, 0.03);
                const cx = w / 2, cy = h / 2;
                const dx = (x - cx), dy = (y - cy);
                const inDoor = Math.abs(dx) < w * 0.2 && Math.abs(dy) < h * 0.25;

                if (inDoor) {
                    const v = clamp(50 + n * 15, 30, 85);
                    data[i] = v; data[i+1] = v * 0.9; data[i+2] = v * 0.8;
                } else {
                    const v = clamp(115 + n * 25, 75, 165);
                    data[i] = v; data[i+1] = v * 0.95; data[i+2] = v * 0.9;
                }
                data[i+3] = 255;
            }
        }
    };
}

// ====== 圖集建立 ======
export function createTextureAtlas() {
    const noisePairs = [
        { noise: new PerlinNoise(101), detail: new PerlinNoise(202) }, // stone
        { noise: new PerlinNoise(303), detail: null },
        { noise: new PerlinNoise(404), detail: new PerlinNoise(505) },
        { noise: new PerlinNoise(606), detail: null },
        { noise: new PerlinNoise(707), detail: new PerlinNoise(808) },
        { noise: new PerlinNoise(909), detail: new PerlinNoise(1010) },
        { noise: new PerlinNoise(1111), detail: null },
        { noise: new PerlinNoise(1212), detail: null },
        { noise: new PerlinNoise(1313), detail: new PerlinNoise(1414) },
        { noise: new PerlinNoise(1515), detail: new PerlinNoise(1616) },
        { noise: new PerlinNoise(1717), detail: null },
        { noise: new PerlinNoise(1818), detail: null },
        { noise: new PerlinNoise(1919), detail: null },
        { noise: new PerlinNoise(2020), detail: null },
        { noise: new PerlinNoise(2121), detail: null },
        { noise: new PerlinNoise(2222), detail: null },
        { noise: new PerlinNoise(2323), detail: null },
        { noise: new PerlinNoise(2424), detail: null },
        { noise: new PerlinNoise(2525), detail: null },
        { noise: new PerlinNoise(2626), detail: null },
        { noise: new PerlinNoise(2727), detail: null },
        { noise: new PerlinNoise(2828), detail: null },
        { noise: new PerlinNoise(2929), detail: null },
    ];

    const generators = [
        { fn: (out, w, h) => grassTopGenerator(noisePairs[2].noise, noisePairs[2].detail)(out, w, h), name: 'grass_top' },
        { fn: (out, w, h) => grassSideGenerator(noisePairs[3].noise)(out, w, h), name: 'grass_side' },
        { fn: (out, w, h) => dirtGenerator(noisePairs[1].noise)(out, w, h), name: 'dirt' },
        { fn: (out, w, h) => stoneGenerator(noisePairs[0].noise, noisePairs[0].detail)(out, w, h), name: 'stone' },
        { fn: (out, w, h) => woodSideGenerator(noisePairs[4].noise, noisePairs[4].detail)(out, w, h), name: 'wood_side' },
        { fn: (out, w, h) => woodTopGenerator(noisePairs[5].noise, noisePairs[5].detail)(out, w, h), name: 'wood_top' },
        { fn: (out, w, h) => leavesGenerator(noisePairs[6].noise)(out, w, h), name: 'leaves' },
        { fn: (out, w, h) => sandGenerator(noisePairs[7].noise)(out, w, h), name: 'sand' },
        { fn: (out, w, h) => planksGenerator(noisePairs[8].noise, noisePairs[8].detail)(out, w, h), name: 'planks' },
        { fn: (out, w, h) => cobblestoneGenerator(noisePairs[9].noise, noisePairs[9].detail)(out, w, h), name: 'cobblestone' },
        { fn: (out, w, h) => brickGenerator(noisePairs[10].noise)(out, w, h), name: 'brick' },
        { fn: (out, w, h) => gravelGenerator(noisePairs[11].noise)(out, w, h), name: 'gravel' },
        { fn: (out, w, h) => snowGenerator(noisePairs[12].noise)(out, w, h), name: 'snow' },
        { fn: (out, w, h) => oreStoneGenerator(noisePairs[13].noise, noisePairs[13].detail, [40, 40, 40], 0.25)(out, w, h), name: 'coal_ore' },
        { fn: (out, w, h) => oreStoneGenerator(noisePairs[14].noise, noisePairs[14].detail, [185, 160, 130], 0.18)(out, w, h), name: 'iron_ore' },
        { fn: (out, w, h) => oreStoneGenerator(noisePairs[15].noise, noisePairs[15].detail, [235, 210, 70], 0.12)(out, w, h), name: 'gold_ore' },
        { fn: (out, w, h) => oreStoneGenerator(noisePairs[16].noise, noisePairs[16].detail, [120, 220, 240], 0.10)(out, w, h), name: 'diamond_ore' },
        { fn: (out, w, h) => bedrockGenerator(noisePairs[17].noise)(out, w, h), name: 'bedrock' },
        { fn: (out, w, h) => glassGenerator(noisePairs[18].noise)(out, w, h), name: 'glass' },
        { fn: (out, w, h) => stoneBrickGenerator(noisePairs[19].noise)(out, w, h), name: 'stone_brick' },
        { fn: (out, w, h) => craftingTableTopGenerator(noisePairs[20].noise)(out, w, h), name: 'crafting_table_top' },
        { fn: (out, w, h) => craftingTableSideGenerator(noisePairs[21].noise)(out, w, h), name: 'crafting_table_side' },
        { fn: (out, w, h) => furnaceTopGenerator(noisePairs[22].noise)(out, w, h), name: 'furnace_top' },
        { fn: (out, w, h) => furnaceSideGenerator(noisePairs[22].noise)(out, w, h), name: 'furnace_side' },
    ];

    const atlasW = ATLAS_COLS * TEX_SIZE;
    const atlasH = Math.ceil(generators.length / ATLAS_COLS) * TEX_SIZE;

    const canvas = document.createElement('canvas');
    canvas.width = atlasW;
    canvas.height = atlasH;
    const ctx = canvas.getContext('2d');

    const genW = 64, genH = 64;

    for (let idx = 0; idx < generators.length; idx++) {
        const gen = generators[idx];
        const col = idx % ATLAS_COLS;
        const row = Math.floor(idx / ATLAS_COLS);
        const x = col * TEX_SIZE;
        const y = row * TEX_SIZE;

        ctx.save();
        ctx.translate(x, y);
        drawTexture(ctx, genW, genH, gen.fn);
        ctx.restore();
    }

    const texture = new THREE.CanvasTexture(canvas);
    texture.magFilter = THREE.LinearFilter;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.wrapS = THREE.ClampToEdgeWrapping;
    texture.wrapT = THREE.ClampToEdgeWrapping;
    texture.generateMipmaps = true;

    const cols = ATLAS_COLS;
    const tileW = TEX_SIZE / atlasW;
    const tileH = TEX_SIZE / atlasH;

    function uvRect(idx) {
        const c = idx % cols;
        const r = Math.floor(idx / cols);
        return {
            u: c * tileW, v: 1 - (r + 1) * tileH,
            u2: (c + 1) * tileW, v2: 1 - r * tileH,
        };
    }

    const blockTextures = {
        [GRASS]:       { top: 0, bottom: 2, side: 1 },
        [DIRT]:        { top: 2, bottom: 2, side: 2 },
        [STONE]:       { top: 3, bottom: 3, side: 3 },
        [WOOD]:        { top: 5, bottom: 5, side: 4 },
        [LEAVES]:      { top: 6, bottom: 6, side: 6 },
        [SAND]:        { top: 7, bottom: 7, side: 7 },
        [PLANKS]:      { top: 8, bottom: 8, side: 8 },
        [COBBLESTONE]: { top: 9, bottom: 9, side: 9 },
        [BRICK]:       { top: 10, bottom: 10, side: 10 },
        [GRAVEL]:      { top: 11, bottom: 11, side: 11 },
        [SNOW]:        { top: 12, bottom: 12, side: 12 },
        [COAL_ORE]:    { top: 13, bottom: 13, side: 13 },
        [IRON_ORE]:    { top: 14, bottom: 14, side: 14 },
        [GOLD_ORE]:    { top: 15, bottom: 15, side: 15 },
        [DIAMOND_ORE]: { top: 16, bottom: 16, side: 16 },
        [BEDROCK]:     { top: 17, bottom: 17, side: 17 },
        [GLASS]:       { top: 18, bottom: 18, side: 18 },
        [STONE_BRICK]: { top: 19, bottom: 19, side: 19 },
        [CRAFTING_TABLE]: { top: 20, bottom: 8, side: 21 },
        [FURNACE]:     { top: 22, bottom: 22, side: 23 },
    };

    function getBlockUVs(blockType, face) {
        const bt = blockTextures[blockType] || blockTextures[STONE];
        const idx = face === 'top' ? bt.top : (face === 'bottom' ? bt.bottom : bt.side);
        return uvRect(idx);
    }

    function createBlockPreview(blockType, size = 48) {
        const uv = getBlockUVs(blockType, 'top');
        const srcX = uv.u * atlasW;
        const srcY = canvas.height - uv.v2 * canvas.height;
        const preview = document.createElement('canvas');
        preview.width = size;
        preview.height = size;
        const pctx = preview.getContext('2d');
        pctx.imageSmoothingEnabled = true;
        pctx.drawImage(canvas, srcX, srcY, TEX_SIZE, TEX_SIZE, 0, 0, size, size);
        return preview;
    }

    return { texture, getBlockUVs, canvas, createBlockPreview };
}
