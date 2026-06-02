// 事件总线
(function() {
    const listeners = new Map();

    function on(event, callback) {
        if (!listeners.has(event)) listeners.set(event, []);
        listeners.get(event).push(callback);
    }

    function off(event, callback) {
        const list = listeners.get(event);
        if (!list) return;
        const idx = list.indexOf(callback);
        if (idx !== -1) list.splice(idx, 1);
    }

    function emit(event, data) {
        const list = listeners.get(event);
        if (!list) return;
        for (const cb of list) {
            try { cb(data); } catch(e) { console.error(`[HTYQ2] EventBus 错误: ${event}`, e); }
        }
    }

    function clear() { listeners.clear(); }

    window.HTYQ2.EventBus = { on, off, emit, clear };
})();
