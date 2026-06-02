// HTYQ 2.0 入口 - 动态加载所有模块
(function() {
    if (window.HTYQ2) {
        console.warn('[HTYQ2] 已存在，跳过重复加载');
        return;
    }

    window.HTYQ2 = {
        version: '2.0.0',
        _internal: { ready: false, initTime: Date.now(), modules: {} }
    };

    const baseUrl = (() => {
        const scripts = document.getElementsByTagName('script');
        for (let s of scripts) {
            if (s.src && s.src.includes('/HTYQ2/index.js')) {
                return s.src.substring(0, s.src.lastIndexOf('/'));
            }
        }
        return '/plugins/HTYQ2';
    })();

    const modules = [
        'core/SchemaValidator.js',
        'core/StorageEngine.js',
        'core/EventBus.js',
        'core/APIManager.js',
        'core/WorldState.js',
        'memory/MemoryEngine.js',
        'world/WorldEngine.js',
        'debug.js',
        'ui/styles.js',
        'ui/UI.js'
    ];

    let loaded = 0;
    function loadScript(src) {
        return new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = `${baseUrl}/${src}`;
            script.onload = () => { window.HTYQ2._internal.modules[src] = true; resolve(); };
            script.onerror = () => reject(new Error(`加载失败: ${src}`));
            document.head.appendChild(script);
        });
    }

    async function loadAll() {
        for (const mod of modules) {
            await loadScript(mod);
        }
        window.HTYQ2._internal.ready = true;
        console.log('[HTYQ2] 所有模块加载完成', { version: window.HTYQ2.version });
    }

    loadAll().catch(e => console.error('[HTYQ2] 模块加载失败', e));
})();
