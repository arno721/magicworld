import {
    PLANKS, STICK, COAL, WOOD, COBBLESTONE, STONE, BRICK, GRAVEL,
    GLASS, SAND, STONE_BRICK, CRAFTING_TABLE, FURNACE, DIRT,
    AIR
} from './constants.js';

// 配方格式：{ result, count, pattern, ingredients }
// pattern 是 2x2 或 3x3 字串陣列，空格=空
// ingredients 映射字元到物品

const SHAPED = [
    {
        id: 'planks',
        result: PLANKS, count: 4,
        pattern: ['#'],
        ingredients: { '#': WOOD },
    },
    {
        id: 'stick',
        result: STICK, count: 4,
        pattern: ['#', '#'],
        ingredients: { '#': PLANKS },
    },
    {
        id: 'crafting_table',
        result: CRAFTING_TABLE, count: 1,
        pattern: ['##', '##'],
        ingredients: { '#': PLANKS },
    },
    {
        id: 'furnace',
        result: FURNACE, count: 1,
        pattern: ['###', '# #', '###'],
        ingredients: { '#': COBBLESTONE },
    },
    {
        id: 'stone_brick',
        result: STONE_BRICK, count: 4,
        pattern: ['##', '##'],
        ingredients: { '#': STONE },
    },
    {
        id: 'glass',
        result: GLASS, count: 1,
        pattern: ['#'],
        ingredients: { '#': SAND },
    },
    {
        id: 'brick_block',
        result: BRICK, count: 4,
        pattern: ['##', '##'],
        ingredients: { '#': GRAVEL },
    },
    {
        id: 'coal',
        result: COAL, count: 1,
        pattern: ['#'],
        ingredients: { '#': WOOD },
    },
    {
        id: 'torch',
        result: STICK, count: 4,
        pattern: ['#', 'C'],
        ingredients: { '#': STICK, 'C': COAL },
    },
    {
        id: 'dirt_to_cobble',
        result: COBBLESTONE, count: 2,
        pattern: ['##', '##'],
        ingredients: { '#': DIRT },
    },
];

export function findRecipe(grid, width, height) {
    // width/height: 2 或 3（2x2 或 3x3 合成格）
    // grid: 2D 陣列 [y][x] = blockType 或 AIR
    for (const recipe of SHAPED) {
        const rw = recipe.pattern[0].length;
        const rh = recipe.pattern.length;
        if (rw > width || rh > height) continue;

        // 在所有可能位置嘗試匹配
        for (let dy = 0; dy <= height - rh; dy++) {
            for (let dx = 0; dx <= width - rw; dx++) {
                if (matchesRecipe(grid, width, height, recipe, dx, dy)) {
                    return recipe;
                }
            }
        }
    }
    return null;
}

function matchesRecipe(grid, w, h, recipe, ox, oy) {
    const ing = recipe.ingredients;
    const pat = recipe.pattern;

    for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
            const gx = x - ox, gy = y - oy;
            const inPattern = gx >= 0 && gx < pat[0].length && gy >= 0 && gy < pat.length;
            const char = inPattern ? pat[gy][gx] : ' ';
            const expected = char === ' ' ? AIR : (ing[char] || AIR);
            const actual = grid[y][x];

            if (expected !== actual) return false;
        }
    }
    return true;
}

export function getRecipeOutput(recipe, grid, width, height) {
    // 計算實際可製作的數量（取決於材料數量）
    if (!recipe) return null;
    return { blockType: recipe.result, count: recipe.count };
}
