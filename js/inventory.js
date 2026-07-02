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

    getSlot(index) {
        if (index < 0 || index >= this.size) return null;
        return this.slots[index];
    }

    moveStack(fromSlotIndex, toSlotIndex) {
        if (fromSlotIndex === toSlotIndex) return false;
        if (fromSlotIndex < 0 || fromSlotIndex >= this.size || toSlotIndex < 0 || toSlotIndex >= this.size) return false;

        const from = this.slots[fromSlotIndex];
        const to = this.slots[toSlotIndex];
        if (!from || from.count <= 0) return false;

        if (to.count <= 0) {
            this.slots[toSlotIndex] = {
                blockType: from.blockType,
                count: from.count,
            };
            this.slots[fromSlotIndex] = { blockType: AIR, count: 0 };
            return true;
        }

        if (to.blockType === from.blockType) {
            const canMove = Math.min(from.count, MAX_STACK - to.count);
            if (canMove <= 0) return false;

            to.count += canMove;
            from.count -= canMove;
            if (from.count <= 0) {
                from.blockType = AIR;
            }
            return true;
        }

        const temp = { ...to };
        this.slots[toSlotIndex] = { ...from };
        this.slots[fromSlotIndex] = temp;
        return true;
    }

    splitStack(fromSlotIndex, toSlotIndex, splitCount = null) {
        if (fromSlotIndex < 0 || fromSlotIndex >= this.size || toSlotIndex < 0 || toSlotIndex >= this.size) return false;
        if (fromSlotIndex === toSlotIndex) return false;

        const from = this.slots[fromSlotIndex];
        if (!from || from.count <= 1) return false;

        const targetCount = splitCount === null ? Math.ceil(from.count / 2) : Math.min(from.count - 1, splitCount);
        if (targetCount <= 0) return false;

        if (targetCount >= from.count) return false;
        const to = this.slots[toSlotIndex];
        if (to.count > 0 && to.blockType !== from.blockType) return false;
        if (to.count >= MAX_STACK) return false;

        const placeCount = Math.min(targetCount, MAX_STACK - to.count);
        if (placeCount <= 0) return false;

        to.blockType = from.blockType;
        to.count += placeCount;
        from.count -= placeCount;
        if (from.count <= 0) {
            from.blockType = AIR;
        }
        return true;
    }
}
