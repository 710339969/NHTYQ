// 世界引擎（动态覆盖 + 世界书）
(function() {
    let dynamicState = {};
    let staticBackground = {};

    async function loadWorldbook(name) {
        if (!name) return null;
        try {
            let ctx = null;
            if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ctx = SillyTavern.getContext();
            if (ctx && ctx.loadWorldInfo) {
                const data = await ctx.loadWorldInfo(name);
                staticBackground = data || {};
                return staticBackground;
            } else {
                console.warn('[HTYQ2] 未检测到 ST 上下文，使用空世界书');
                staticBackground = {};
                return {};
            }
        } catch(e) {
            console.error('[HTYQ2] 加载世界书失败', e);
            staticBackground = {};
            return null;
        }
    }

    function setDynamic(path, value) {
        const keys = path.split('.');
        let current = dynamicState;
        for (let i = 0; i < keys.length - 1; i++) {
            if (!current[keys[i]]) current[keys[i]] = {};
            current = current[keys[i]];
        }
        current[keys[keys.length - 1]] = value;
        if (window.HTYQ2.EventBus) window.HTYQ2.EventBus.emit('world:updated', { path, value });
    }

    function getWorldState(key) {
        const keys = key.split('.');
        let fromDynamic = dynamicState;
        for (const k of keys) {
            if (fromDynamic === undefined) break;
            fromDynamic = fromDynamic[k];
        }
        if (fromDynamic !== undefined) return fromDynamic;
        let fromStatic = staticBackground;
        for (const k of keys) {
            if (fromStatic === undefined) break;
            fromStatic = fromStatic[k];
        }
        return fromStatic;
    }

    function getFullDynamic() { return JSON.parse(JSON.stringify(dynamicState)); }

    window.HTYQ2.WorldEngine = { loadWorldbook, setDynamic, getWorldState, getFullDynamic };
})();
