// main.js – 仅负责悬浮球面板 + 动态加载后续模块（干净版本）
(function() {
    if (window.__HTYQ_GLOBE_LOADED__) return;
    window.__HTYQ_GLOBE_LOADED__ = true;

    // ---------- 工具函数 ----------
    function getScriptBaseUrl() {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src && src.includes('main.js')) {
                return src.substring(0, src.lastIndexOf('/'));
            }
        }
        return './plugins/htyq'; // fallback
    }

    // 基础样式注入（保证悬浮球样式存在，避免依赖外部css）
    function injectBaseStyles() {
        if (document.getElementById('htyq-base-styles')) return;
        const style = document.createElement('style');
        style.id = 'htyq-base-styles';
        style.textContent = `
            .st-floating-globe {
                position: fixed;
                z-index: 10000;
                width: 48px;
                height: 48px;
                border-radius: 50%;
                background: linear-gradient(135deg, #2b6cb0, #1a4a7a);
                box-shadow: 0 4px 12px rgba(0,0,0,0.3);
                cursor: grab;
                display: flex;
                align-items: center;
                justify-content: center;
                user-select: none;
                touch-action: none;
            }
            .st-floating-globe:active { cursor: grabbing; }
            .st-globe-icon { font-size: 28px; color: white; pointer-events: none; }
            .st-floating-panel {
                position: fixed;
                z-index: 10001;
                background: #0f172a;
                color: #e2e8f0;
                border-radius: 16px;
                box-shadow: 0 8px 20px rgba(0,0,0,0.5);
                border: 1px solid #334155;
                display: none;
                flex-direction: column;
                overflow: hidden;
                width: 540px;
                height: 600px;
            }
            .st-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #1e2937;
                cursor: grab;
                border-bottom: 1px solid #334155;
            }
            .st-panel-header:active { cursor: grabbing; }
            .st-panel-title { font-weight: bold; font-size: 16px; color: #a78bfa; }
            .st-panel-close {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 20px;
                cursor: pointer;
                padding: 0 6px;
                border-radius: 8px;
            }
            .st-panel-close:hover { background: #334155; color: white; }
            .st-panel-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            @media (max-width: 768px) {
                .st-floating-panel { width: 90vw !important; height: 80vh !important; }
            }
        `;
        document.head.appendChild(style);
    }

    // 拖拽逻辑（完全重写，稳定）
    function makeDraggable(el, onDragEnd, handleSelector = null) {
        let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;
        const dragHandle = handleSelector ? el.querySelector(handleSelector) : el;
        if (!dragHandle) return;

        const onMove = (e) => {
            if (!dragging) return;
            e.preventDefault();
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
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
            if (e.target.closest && e.target.closest('.st-panel-close')) return;
            e.preventDefault();
            dragging = true;
            let clientX, clientY;
            if (e.touches) {
                clientX = e.touches[0].clientX;
                clientY = e.touches[0].clientY;
            } else {
                clientX = e.clientX;
                clientY = e.clientY;
            }
            startX = clientX; startY = clientY;
            startLeft = el.offsetLeft; startTop = el.offsetTop;
            document.body.style.userSelect = 'none';
            document.addEventListener('mousemove', onMove);
            document.addEventListener('mouseup', onUp);
            document.addEventListener('touchmove', onMove, { passive: false });
            document.addEventListener('touchend', onUp);
        };
        dragHandle.addEventListener('mousedown', onDown);
        dragHandle.addEventListener('touchstart', onDown, { passive: false });
    }

    // 位置存储
    const STORAGE_KEY_GLOBE = 'htyq_globe_pos';
    const STORAGE_KEY_PANEL = 'htyq_panel_pos';

    function savePos(key, left, top) {
        localStorage.setItem(key, JSON.stringify({ left, top }));
    }

    function loadPos(key, defaultLeft, defaultTop, el) {
        const saved = localStorage.getItem(key);
        if (saved) {
            try {
                const pos = JSON.parse(saved);
                let left = pos.left, top = pos.top;
                const maxX = window.innerWidth - el.offsetWidth;
                const maxY = window.innerHeight - el.offsetHeight;
                left = Math.min(Math.max(left, 0), maxX);
                top = Math.min(Math.max(top, 0), maxY);
                return { left, top };
            } catch(e) {}
        }
        return { left: defaultLeft, top: defaultTop };
    }

    // 创建DOM元素
    function createGlobeAndPanel() {
        const globe = document.createElement('div');
        globe.className = 'st-floating-globe';
        globe.innerHTML = '<span class="st-globe-icon">🌐</span>';
        document.body.appendChild(globe);

        const panel = document.createElement('div');
        panel.className = 'st-floating-panel';
        panel.innerHTML = `
            <div class="st-panel-header">
                <span class="st-panel-title">🌍 活体引擎 (重构版)</span>
                <button class="st-panel-close">✕</button>
            </div>
            <div class="st-panel-content" id="htyq-panel-content">
                <div style="color:#aaa; text-align:center;">加载中…</div>
            </div>
        `;
        document.body.appendChild(panel);
        return { globe, panel };
    }

    // 初始化位置
    function initPosition(el, key, defaultLeft, defaultTop) {
        const { left, top } = loadPos(key, defaultLeft, defaultTop, el);
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        return { left, top };
    }

    // 事件绑定
    function bindEvents(globe, panel) {
        let dragMoved = false, dragStarted = false;
        globe.addEventListener('mousedown', () => { dragMoved = false; dragStarted = true; });
        globe.addEventListener('touchstart', () => { dragMoved = false; dragStarted = true; });
        globe.addEventListener('mousemove', () => { if (dragStarted) dragMoved = true; });
        globe.addEventListener('touchmove', () => { if (dragStarted) dragMoved = true; });
        globe.addEventListener('mouseup', () => {
            if (dragStarted && !dragMoved) togglePanel();
            dragStarted = false; dragMoved = false;
        });
        globe.addEventListener('touchend', () => {
            if (dragStarted && !dragMoved) togglePanel();
            dragStarted = false; dragMoved = false;
        });

        let panelVisible = false;
        function togglePanel() {
            if (panelVisible) {
                panel.style.display = 'none';
                panelVisible = false;
            } else {
                panel.style.display = 'flex';
                panelVisible = true;
                // 这里后续会加载真正的内容模块
            }
        }
        const closeBtn = panel.querySelector('.st-panel-close');
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            panelVisible = false;
        });
        // 提供给外部调用
        window.__htyq_togglePanel = togglePanel;
    }

    // 启动
    function init() {
        injectBaseStyles();
        const { globe, panel } = createGlobeAndPanel();

        // 初始化位置
        const globeW = globe.offsetWidth, globeH = globe.offsetHeight;
        const defaultGlobeLeft = window.innerWidth - globeW - 20;
        const defaultGlobeTop = window.innerHeight - globeH - 20;
        initPosition(globe, STORAGE_KEY_GLOBE, defaultGlobeLeft, defaultGlobeTop);
        makeDraggable(globe, (l, t) => savePos(STORAGE_KEY_GLOBE, l, t));

        const panelW = panel.offsetWidth, panelH = panel.offsetHeight;
        const defaultPanelLeft = (window.innerWidth - panelW) / 2;
        const defaultPanelTop = (window.innerHeight - panelH) / 2;
        initPosition(panel, STORAGE_KEY_PANEL, defaultPanelLeft, defaultPanelTop);
        makeDraggable(panel, (l, t) => savePos(STORAGE_KEY_PANEL, l, t), '.st-panel-header');

        bindEvents(globe, panel);

        // 临时显示就绪信息
        const contentDiv = document.getElementById('htyq-panel-content');
        if (contentDiv) {
            contentDiv.innerHTML = '<div style="color: #4ade80;">✅ 基础面板已加载，下一步将加载引擎模块。</div>';
        }
        console.log('[HTYQ] 基础悬浮球面板已启动');
    }

    // 等DOM完全加载后再执行
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
