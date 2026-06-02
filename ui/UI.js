// UI 面板（悬浮球+可拖拽面板）
(function() {
    function escapeHtml(str) {
        if (!str) return '';
        return String(str).replace(/[&<>]/g, m => m === '&' ? '&amp;' : m === '<' ? '&lt;' : '&gt;');
    }

    function makeDraggable(el, onDragEnd, handleSelector) {
        let startX, startY, startLeft, startTop, dragging = false;
        const handle = handleSelector ? el.querySelector(handleSelector) : el;
        if (!handle) return;
        const onMove = (e) => {
            if (!dragging) return;
            e.preventDefault();
            let clientX, clientY;
            if (e.touches) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
            else { clientX = e.clientX; clientY = e.clientY; }
            let newLeft = startLeft + (clientX - startX);
            let newTop = startTop + (clientY - startY);
            const maxX = window.innerWidth - el.offsetWidth;
            const maxY = window.innerHeight - el.offsetHeight;
            newLeft = Math.min(Math.max(newLeft, 0), maxX);
            newTop = Math.min(Math.max(newTop, 0), maxY);
            el.style.left = newLeft + 'px';
            el.style.top = newTop + 'px';
            el.style.right = 'auto';
            el.style.bottom = 'auto';
            if (onDragEnd) onDragEnd(newLeft, newTop);
        };
        const onUp = () => {
            if (!dragging) return;
            dragging = false;
            document.removeEventListener('mousemove', onMove);
            document.removeEventListener('mouseup', onUp);
            document.removeEventListener('touchmove', onMove);
            document.removeEventListener('touchend', onUp);
            document.body.style.userSelect = '';
        };
        const onDown = (e) => {
            if (e.target.closest && e.target.closest('.htyq2-panel-close')) return;
            e.preventDefault();
            dragging = true;
            let clientX, clientY;
            if (e.touches) { clientX = e.touches[0].clientX; clientY = e.touches[0].clientY; }
            else { clientX = e.clientX; clientY = e.clientY; }
            startX = clientX; startY = clientY;
            startLeft = el.offsetLeft; startTop = el.offsetTop;
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };
        handle.addEventListener('mousedown', onDown);
        handle.addEventListener('touchstart', onDown, { passive: false });
    }

    function loadStoredPosition(el, key, defaultLeft, defaultTop) {
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                let left = Math.min(Math.max(pos.left, 10), window.innerWidth - el.offsetWidth);
                let top = Math.min(Math.max(pos.top, 10), window.innerHeight - el.offsetHeight);
                el.style.left = left + 'px';
                el.style.top = top + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
                return;
            } catch(e) {}
        }
        el.style.left = defaultLeft + 'px';
        el.style.top = defaultTop + 'px';
    }

    if (document.getElementById('htyq2-globe')) return;

    const globe = document.createElement('div');
    globe.id = 'htyq2-globe';
    globe.innerHTML = '<span class="htyq2-globe-icon">🌐</span>';
    document.body.appendChild(globe);

    const panel = document.createElement('div');
    panel.id = 'htyq2-panel';
    panel.innerHTML = `
        <div class="htyq2-panel-header">
            <span class="htyq2-panel-title">📋 HTYQ 2.0 世界状态</span>
            <button class="htyq2-panel-close">✕</button>
        </div>
        <div class="htyq2-panel-content" id="htyq2-panel-content">加载中...</div>
        <div class="htyq2-footer">
            <button id="htyq2-evolve-btn" class="htyq2-button">🌀 手动推演</button>
            <button id="htyq2-refresh-btn" class="htyq2-button" style="background:#3b82f6;">🔄 刷新</button>
            <div class="htyq2-stats">轮次: <span id="htyq2-round">0</span></div>
        </div>
    `;
    document.body.appendChild(panel);

    loadStoredPosition(globe, 'htyq2_globe_pos', window.innerWidth - 68, window.innerHeight - 68);
    loadStoredPosition(panel, 'htyq2_panel_pos', (window.innerWidth - 540) / 2, (window.innerHeight - 600) / 2);
    makeDraggable(globe, (l,t) => localStorage.setItem('htyq2_globe_pos', JSON.stringify({left:l, top:t})));
    makeDraggable(panel, (l,t) => localStorage.setItem('htyq2_panel_pos', JSON.stringify({left:l, top:t})), '.htyq2-panel-header');

    let panelVisible = false;
    function openPanel() { panel.style.display = 'flex'; panelVisible = true; refreshPanel(); }
    function closePanel() { panel.style.display = 'none'; panelVisible = false; }
    panel.querySelector('.htyq2-panel-close').addEventListener('click', closePanel);

    let dragMoved = false, dragStarted = false;
    globe.addEventListener('mousedown', () => { dragMoved = false; dragStarted = true; });
    globe.addEventListener('touchstart', () => { dragMoved = false; dragStarted = true; });
    globe.addEventListener('mousemove', () => { if (dragStarted) dragMoved = true; });
    globe.addEventListener('touchmove', () => { if (dragStarted) dragMoved = true; });
    globe.addEventListener('mouseup', () => { if (dragStarted && !dragMoved) openPanel(); dragStarted = false; dragMoved = false; });
    globe.addEventListener('touchend', () => { if (dragStarted && !dragMoved) openPanel(); dragStarted = false; dragMoved = false; });

    function refreshPanel() {
        const state = window.HTYQ2.WorldState.get();
        const rep = state.reputation || {};
        const eco = state.economy || {};
        const rumors = (state.rumors || []).slice(0, 5);
        const events = (state.events || []).slice(0, 5);
        const factions = (state.factions || []).slice(0, 5);
        const round = state.timestamp ? Math.floor((Date.now() - state.timestamp) / 60000) : 0;
        document.getElementById('htyq2-round').innerText = round;
        const content = document.getElementById('htyq2-panel-content');
        content.innerHTML = `
            <div class="htyq2-card"><h3>🌍 世界摘要</h3><div>${escapeHtml(state.worldDigest || '无')}</div></div>
            <div class="htyq2-card"><h3>⭐ 声誉</h3><div>江湖:${rep.jianghu} 官府:${rep.official} 民间:${rep.folk} 黑道:${rep.underworld}</div></div>
            <div class="htyq2-card"><h3>💰 经济</h3><div>资金:${eco.fundsStatus} | 市场:${eco.marketTrend}</div></div>
            <div class="htyq2-card"><h3>⚡ 事件链</h3>${events.map(e => `<div>• ${escapeHtml(e.name || e.description)}</div>`).join('') || '<div>无</div>'}</div>
            <div class="htyq2-card"><h3>🗣️ 流言</h3>${rumors.map(r => `<div>• ${escapeHtml(r.content)}</div>`).join('') || '<div>无</div>'}</div>
            <div class="htyq2-card"><h3>🏛️ 势力</h3>${factions.map(f => `<div>• ${escapeHtml(f.name)}</div>`).join('') || '<div>无</div>'}</div>
        `;
    }

    document.getElementById('htyq2-refresh-btn').addEventListener('click', refreshPanel);
    document.getElementById('htyq2-evolve-btn').addEventListener('click', async () => {
        console.log('[HTYQ2] 手动推演占位');
        try {
            const response = await window.HTYQ2.APIManager.callAPI([{ role: 'user', content: '请简要推演下一步世界状态' }], { maxTokens: 200 });
            const state = window.HTYQ2.WorldState.get();
            state.worldDigest = response.substring(0, 200);
            state.timestamp = Date.now();
            window.HTYQ2.WorldState.save(state);
            refreshPanel();
        } catch(e) { console.error(e); }
    });

    refreshPanel();
})();
