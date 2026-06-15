import { AIR } from './constants.js';

const MAX_STACK = 64;

export class Inventory {
    constructor(size = 36, hotbarSize = 9) {
        this.hotbarSize = hotbarSize;
        this.size = size;
        this.slots = new Array(size).fill(null).map(() => ({ blockType: AIR, count: 0 }));
        this.selected = 0;
    }

    getSelectedSlot() {
        return this.slots[this.selected];
    }

    getSelectedBlock() {
        return this.getSelectedSlot().blockType;
    }

    addBlock(blockType, count = 1) {
        if (blockType === AIR) return 0;
        let remaining = count;

        // 先堆疊到現有堆疊
        for (let i = 0; i < this.size && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot.blockType === blockType && slot.count < MAX_STACK) {
                const add = Math.min(remaining, MAX_STACK - slot.count);
                slot.count += add;
                remaining -= add;
            }
        }

        // 再放入空位
        for (let i = 0; i < this.size && remaining > 0; i++) {
            const slot = this.slots[i];
            if (slot.count === 0) {
                const add = Math.min(remaining, MAX_STACK);
                slot.blockType = blockType;
                slot.count = add;
                remaining -= add;
            }
        }

        return remaining; // 沒放進去的數量
    }

    removeBlock(blockType, count = 1) {
        if (blockType === AIR) return 0;
        let remaining = count;

        for (let i = this.size - 1; i >= 0 && remaining > 0; i--) {
            const slot = this.slots[i];
            if (slot.blockType === blockType) {
                const remove = Math.min(remaining, slot.count);
                slot.count -= remove;
                remaining -= remove;
                if (slot.count <= 0) {
                    slot.blockType = AIR;
                    slot.count = 0;
                }
            }
        }

        return remaining;
    }

    countBlock(blockType) {
        let total = 0;
        for (const slot of this.slots) {
            if (slot.blockType === blockType) total += slot.count;
        }
        return total;
    }

    hasBlock(blockType, count = 1) {
        return this.countBlock(blockType) >= count;
    }

    selectSlot(index) {
        if (index >= 0 && index < this.hotbarSize) {
            this.selected = index;
        }
    }

    getHotbarSlots() {
        return this.slots.slice(0, this.hotbarSize);
    }
}
