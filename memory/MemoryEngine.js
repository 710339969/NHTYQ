// 记忆引擎（标签召回 + 时间衰减）
(function() {
    const memories = new Map();
    let nextId = 1;

    function addMemory(content, tags = [], initialStrength = 1.0) {
        const id = `mem_${nextId++}`;
        const now = Date.now();
        const memory = {
            id, content, tags: [...tags], strength: initialStrength,
            createdAt: now, lastRecallAt: now
        };
        memories.set(id, memory);
        if (window.HTYQ2.EventBus) window.HTYQ2.EventBus.emit('memory:added', memory);
        return id;
    }

    function recallByTags(queryTags, maxResults = 5) {
        const now = Date.now();
        const results = [];
        for (const mem of memories.values()) {
            const commonTags = mem.tags.filter(t => queryTags.includes(t));
            if (commonTags.length === 0) continue;
            const daysSinceRecall = (now - mem.lastRecallAt) / (1000 * 3600 * 24);
            const decayFactor = Math.pow(0.95, daysSinceRecall / 7);
            const effectiveStrength = mem.strength * decayFactor;
            results.push({ ...mem, effectiveStrength, commonTags });
        }
        results.sort((a, b) => b.effectiveStrength - a.effectiveStrength);
        const top = results.slice(0, maxResults);
        for (const r of top) {
            const original = memories.get(r.id);
            original.lastRecallAt = now;
            original.strength = Math.max(0.1, original.strength * 0.98);
            memories.set(r.id, original);
        }
        return top;
    }

    function getAllMemories() { return Array.from(memories.values()); }

    window.HTYQ2.MemoryEngine = { addMemory, recallByTags, getAllMemories };
})();
