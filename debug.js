// 调试工具
(function() {
    function status() {
        return {
            ok: true,
            version: window.HTYQ2.version,
            ready: window.HTYQ2._internal.ready,
            uptime: Date.now() - window.HTYQ2._internal.initTime,
            apiMode: window.HTYQ2.APIManager?.loadSettings().mode || 'unknown'
        };
    }

    function exportState() {
        const allKeys = window.HTYQ2.StorageEngine.getAllKeys();
        const data = {};
        for (const key of allKeys) {
            const raw = localStorage.getItem(key);
            try { data[key] = JSON.parse(raw); } catch(e) { data[key] = raw; }
        }
        return data;
    }

    function validateAll() {
        const issues = [];
        const worldState = window.HTYQ2.WorldState.get();
        if (worldState) {
            const validation = window.HTYQ2.SchemaValidator.validate(worldState, 'WorldState');
            if (!validation.valid) issues.push(`WorldState 无效: ${validation.error}`);
        }
        return { valid: issues.length === 0, issues };
    }

    window.HTYQ2.debug = { status, exportState, validateAll };
})();
