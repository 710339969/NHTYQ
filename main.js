// main.js – 基础悬浮球面板 + 可调整大小（PC拖拽 + 手机预设尺寸）
(function() {
    if (window.__HTYQ_GLOBE_LOADED__) return;
    window.__HTYQ_GLOBE_LOADED__ = true;

    // ========== 工具函数 ==========
    function getScriptBaseUrl() {
        const scripts = document.getElementsByTagName('script');
        for (let i = 0; i < scripts.length; i++) {
            const src = scripts[i].src;
            if (src && src.includes('main.js')) {
                return src.substring(0, src.lastIndexOf('/'));
            }
        }
        return './plugins/htyq';
    }

    // 注入基础样式（包含 resize 手柄样式）
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
                min-width: 320px;
                min-height: 400px;
                resize: both;
            }
            /* 自定义resize手柄样式（PC） */
            .st-floating-panel::-webkit-resizer {
                background: #3b82f6;
                border-radius: 0 0 12px 0;
            }
            .st-panel-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                padding: 12px 16px;
                background: #1e2937;
                cursor: grab;
                border-bottom: 1px solid #334155;
                flex-shrink: 0;
            }
            .st-panel-header:active { cursor: grabbing; }
            .st-panel-title {
                font-weight: bold;
                font-size: 16px;
                color: #a78bfa;
                display: flex;
                align-items: center;
                gap: 8px;
            }
            .st-panel-close, .st-panel-resize {
                background: none;
                border: none;
                color: #94a3b8;
                font-size: 18px;
                cursor: pointer;
                padding: 0 8px;
                border-radius: 8px;
            }
            .st-panel-close:hover, .st-panel-resize:hover {
                background: #334155;
                color: white;
            }
            .st-panel-content {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
            }
            /* 手机端预设尺寸（通过class控制） */
            .st-floating-panel.size-small {
                width: 360px !important;
                height: 500px !important;
            }
            .st-floating-panel.size-medium {
                width: 540px !important;
                height: 600px !important;
            }
            .st-floating-panel.size-large {
                width: 720px !important;
                height: 700px !important;
            }
            @media (max-width: 768px) {
                .st-floating-panel.size-small {
                    width: 85vw !important;
                    height: 70vh !important;
                }
                .st-floating-panel.size-medium {
                    width: 90vw !important;
                    height: 80vh !important;
                }
                .st-floating-panel.size-large {
                    width: 95vw !important;
                    height: 90vh !important;
                }
            }
        `;
        document.head.appendChild(style);
    }

    // ========== 拖拽逻辑（同前，略优化）==========
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
            if (e.target.closest && (e.target.closest('.st-panel-close') || e.target.closest('.st-panel-resize'))) return;
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

    // ========== 位置存储 ==========
    const STORAGE_KEY_GLOBE = 'htyq_globe_pos';
    const STORAGE_KEY_PANEL = 'htyq_panel_pos';
    const STORAGE_KEY_PANEL_SIZE = 'htyq_panel_size'; // 新增：存储尺寸名称

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

    function initPosition(el, key, defaultLeft, defaultTop) {
        const { left, top } = loadPos(key, defaultLeft, defaultTop, el);
        el.style.left = left + 'px';
        el.style.top = top + 'px';
        el.style.right = 'auto';
        el.style.bottom = 'auto';
        return { left, top };
    }

    // ========== 大小调整功能 ==========
    const SIZES = ['small', 'medium', 'large'];
    let currentSizeIndex = 1; // 默认 medium

    function applyPanelSize(panel, sizeName) {
        // 移除所有尺寸类
        SIZES.forEach(s => panel.classList.remove(`size-${s}`));
        panel.classList.add(`size-${sizeName}`);
        // 保存到 localStorage
        localStorage.setItem(STORAGE_KEY_PANEL_SIZE, sizeName);
        // 重新约束位置（避免面板超出屏幕）
        setTimeout(() => {
            const left = parseInt(panel.style.left, 10);
            const top = parseInt(panel.style.top, 10);
            if (!isNaN(left)) {
                const maxX = window.innerWidth - panel.offsetWidth;
                const maxY = window.innerHeight - panel.offsetHeight;
                let newLeft = Math.min(Math.max(left, 0), maxX);
                let newTop = Math.min(Math.max(top, 0), maxY);
                if (newLeft !== left || newTop !== top) {
                    panel.style.left = newLeft + 'px';
                    panel.style.top = newTop + 'px';
                    savePos(STORAGE_KEY_PANEL, newLeft, newTop);
                }
            }
        }, 10);
    }

    function cyclePanelSize(panel) {
        currentSizeIndex = (currentSizeIndex + 1) % SIZES.length;
        applyPanelSize(panel, SIZES[currentSizeIndex]);
    }

    // 加载保存的尺寸
    function loadPanelSize(panel) {
        const saved = localStorage.getItem(STORAGE_KEY_PANEL_SIZE);
        if (saved && SIZES.includes(saved)) {
            currentSizeIndex = SIZES.indexOf(saved);
            applyPanelSize(panel, saved);
        } else {
            applyPanelSize(panel, 'medium');
        }
    }

    // ========== 创建DOM ==========
    function createGlobeAndPanel() {
        const globe = document.createElement('div');
        globe.className = 'st-floating-globe';
        globe.innerHTML = '<span class="st-globe-icon">🌐</span>';
        document.body.appendChild(globe);

        const panel = document.createElement('div');
        panel.className = 'st-floating-panel';
        panel.innerHTML = `
            <div class="st-panel-header">
                <div class="st-panel-title">
                    🌍 活体引擎
                    <button class="st-panel-resize" title="切换面板大小">⤡</button>
                </div>
                <button class="st-panel-close">✕</button>
            </div>
            <div class="st-panel-content" id="htyq-panel-content">
                <div style="color:#aaa; text-align:center;">✅ 面板可调整大小<br>PC上可拖拽右下角边缘<br>手机点⤡切换尺寸</div>
            </div>
        `;
        document.body.appendChild(panel);
        return { globe, panel };
    }

    // ========== 事件绑定 ==========
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
                // 确保位置和尺寸不超出边界
                setTimeout(() => {
                    const left = parseInt(panel.style.left, 10);
                    const top = parseInt(panel.style.top, 10);
                    if (!isNaN(left)) {
                        const maxX = window.innerWidth - panel.offsetWidth;
                        const maxY = window.innerHeight - panel.offsetHeight;
                        let newLeft = Math.min(Math.max(left, 0), maxX);
                        let newTop = Math.min(Math.max(top, 0), maxY);
                        if (newLeft !== left || newTop !== top) {
                            panel.style.left = newLeft + 'px';
                            panel.style.top = newTop + 'px';
                            savePos(STORAGE_KEY_PANEL, newLeft, newTop);
                        }
                    }
                }, 10);
            }
        }
        const closeBtn = panel.querySelector('.st-panel-close');
        closeBtn.addEventListener('click', () => {
            panel.style.display = 'none';
            panelVisible = false;
        });

        const resizeBtn = panel.querySelector('.st-panel-resize');
        resizeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            cyclePanelSize(panel);
        });

        window.__htyq_togglePanel = togglePanel;
        // 监听窗口大小变化，重新约束面板位置
        window.addEventListener('resize', () => {
            if (panel.style.display === 'flex') {
                const left = parseInt(panel.style.left, 10);
                const top = parseInt(panel.style.top, 10);
                if (!isNaN(left)) {
                    const maxX = window.innerWidth - panel.offsetWidth;
                    const maxY = window.innerHeight - panel.offsetHeight;
                    let newLeft = Math.min(Math.max(left, 0), maxX);
                    let newTop = Math.min(Math.max(top, 0), maxY);
                    if (newLeft !== left || newTop !== top) {
                        panel.style.left = newLeft + 'px';
                        panel.style.top = newTop + 'px';
                        savePos(STORAGE_KEY_PANEL, newLeft, newTop);
                    }
                }
            }
        });
    }

    // ========== 启动 ==========
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

        // 加载并应用保存的面板尺寸
        loadPanelSize(panel);

        bindEvents(globe, panel);

        console.log('[HTYQ] 基础面板已启动（支持调整大小）');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
