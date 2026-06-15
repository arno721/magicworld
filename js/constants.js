// 世界与方块常量
export const CHUNK_SIZE = 16;
export const WORLD_HEIGHT = 64;
export const CHUNKS_X = 5;
export const CHUNKS_Z = 5;
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

// 方块类型
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

export const BLOCK_COLORS = {
    [GRASS]: { top: [0.35, 0.56, 0.20], sideTop: [0.35, 0.56, 0.20], sideBottom: [0.52, 0.39, 0.10], bottom: [0.52, 0.39, 0.10] },
    [DIRT]: { all: [0.50, 0.36, 0.10] },
    [STONE]: { all: [0.48, 0.48, 0.48] },
    [WOOD]: { all: [0.65, 0.44, 0.22], top: [0.60, 0.40, 0.18] },
    [LEAVES]: { all: [0.18, 0.42, 0.10] },
    [SAND]: { all: [0.88, 0.80, 0.58] },
    [PLANKS]: { all: [0.70, 0.50, 0.24] },
    [COBBLESTONE]: { all: [0.38, 0.38, 0.38] },
    [BRICK]: { all: [0.58, 0.28, 0.22] },
    [GRAVEL]: { all: [0.44, 0.40, 0.38] },
    [SNOW]: { all: [0.94, 0.94, 0.96] },
};

export const BLOCK_NAMES = {
    [GRASS]: '草方塊', [DIRT]: '泥土', [STONE]: '石頭', [WOOD]: '原木',
    [LEAVES]: '樹葉', [SAND]: '沙子', [PLANKS]: '木材', [COBBLESTONE]: '鵝卵石',
    [BRICK]: '磚塊', [GRAVEL]: '礫石', [SNOW]: '雪',
};

// 初始快捷栏方块
export const HOTBAR_BLOCKS = [GRASS, DIRT, STONE, WOOD, PLANKS, COBBLESTONE, BRICK, SAND, GRAVEL];
export const HOTBAR_SIZE = 9;