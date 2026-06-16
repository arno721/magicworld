// 世界與方塊常量
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 128;
export const CHUNKS_X = 15;
export const CHUNKS_Z = 15;
export const WORLD_SIZE_X = CHUNKS_X * CHUNK_SIZE;
export const WORLD_SIZE_Z = CHUNKS_Z * CHUNK_SIZE;
export const GRAVITY = 24;
export const JUMP_VELOCITY = 9.5;
export const MOVE_SPEED = 6.5;
export const PLAYER_WIDTH = 0.6;
export const PLAYER_HEIGHT = 1.75;
export const PLAYER_EYE_HEIGHT = 1.6;
export const REACH_DISTANCE = 7;
export const PLAYER_HALF_W = PLAYER_WIDTH / 2;
export const HOTBAR_SIZE = 9;

// 方塊類型
export const AIR = 0;
export const GRASS = 1;
export const DIRT = 2;
export const STONE = 3;
export const WOOD = 4;
export const LEAVES = 5;
export const SAND = 6;
export const PLANKS = 7;
export const COBBLESTONE = 8;
export const BRICK = 9;
export const GRAVEL = 10;
export const SNOW = 11;
export const COAL_ORE = 12;
export const IRON_ORE = 13;
export const GOLD_ORE = 14;
export const DIAMOND_ORE = 15;
export const BEDROCK = 16;
export const GLASS = 17;
export const STONE_BRICK = 18;
export const WATER = 19;
export const CRAFTING_TABLE = 20;
export const FURNACE = 21;

// 透明方塊（不遮擋相鄰面）
export const TRANSPARENT_BLOCKS = new Set([AIR, LEAVES, GLASS]);

// 物品類型（非方塊，可存在物品欄但不能放置）
export const STICK = 100;
export const COAL = 101;

// 方塊名稱
export const BLOCK_NAMES = {
    [GRASS]: '草方塊', [DIRT]: '泥土', [STONE]: '石頭', [WOOD]: '原木',
    [LEAVES]: '樹葉', [SAND]: '沙子', [PLANKS]: '木材', [COBBLESTONE]: '鵝卵石',
    [BRICK]: '磚塊', [GRAVEL]: '礫石', [SNOW]: '雪',
    [COAL_ORE]: '煤礦', [IRON_ORE]: '鐵礦', [GOLD_ORE]: '金礦', [DIAMOND_ORE]: '鑽石礦',
    [BEDROCK]: '基岩', [GLASS]: '玻璃', [STONE_BRICK]: '石磚', [WATER]: '水',
    [CRAFTING_TABLE]: '工作台', [FURNACE]: '熔爐',
    [STICK]: '木棒', [COAL]: '木炭',
};

// 初始快捷欄方塊
export const HOTBAR_BLOCKS = [GRASS, DIRT, STONE, COBBLESTONE, WOOD, PLANKS, CRAFTING_TABLE, STONE_BRICK, GLASS];
