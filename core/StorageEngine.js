// 存储引擎（三重隔离 + 时间戳）
(function() {
    function getContextIds() {
        let chatId = 'default', charId = 'none', groupId = 'none';
        try {
            const ctx = (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ? SillyTavern.getContext() : null;
            if (ctx) {
                chatId = ctx.chatId || ctx.getCurrentChatId?.() || 'default';
                charId = ctx.characterId || 'none';
                groupId = ctx.groupId || 'none';
            }
        } catch(e) { console.warn('[HTYQ2] 获取上下文失败', e); }
        return { chatId, charId, groupId };
    }

    function makeKey(path) {
        const ids = getContextIds();
        return `HTYQ2__${ids.chatId}__${ids.charId}__${ids.groupId}__${path}`;
    }

    function setItem(path, value) {
        const key = makeKey(path);
        let dataToStore = value;
        if (typeof value === 'object' && value !== null) {
            const now = Date.now();
            dataToStore = { ...value };
            if (dataToStore.createdAt === undefined) dataToStore.createdAt = now;
            dataToStore.updatedAt = now;
        }
        try {
            localStorage.setItem(key, JSON.stringify(dataToStore));
            return { success: true, key };
        } catch(e) {
            console.error('[HTYQ2] setItem 失败', e);
            return { success: false, error: e.message };
        }
    }

    function getItem(path, defaultValue = null) {
        const key = makeKey(path);
        const raw = localStorage.getItem(key);
        if (raw === null) return defaultValue;
        try {
            return JSON.parse(raw);
        } catch(e) {
            console.error('[HTYQ2] getItem 解析失败', e);
            return defaultValue;
        }
    }

    function removeItem(path) {
        const key = makeKey(path);
        localStorage.removeItem(key);
    }

    function getAllKeys() {
        const prefix = `HTYQ2__${getContextIds().chatId}__${getContextIds().charId}__${getContextIds().groupId}__`;
        return Object.keys(localStorage).filter(k => k.startsWith(prefix));
    }

    window.HTYQ2.StorageEngine = { setItem, getItem, removeItem, getAllKeys, getContextIds };
})();
