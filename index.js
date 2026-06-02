// HTYQ 2.0 核心插件 - 完整版（含 UI 面板，适配移动端/PC端）
(function() {
    if (window.HTYQ2) {
        console.warn('[HTYQ2] 已存在，跳过重复加载');
        return;
    }

    // ==================== 1. 命名空间 ====================
    window.HTYQ2 = {
        version: '2.0.0',
        _internal: { ready: false, initTime: Date.now() },
        debug: { logs: [] }
    };

    // ==================== 2. SchemaValidator ====================
    (function() {
        const schemas = {
            WorldState: {
                required: ['version', 'timestamp', 'regions', 'globalFlags'],
                properties: {
                    version: { type: 'string', pattern: /^\d+\.\d+$/ },
                    timestamp: { type: 'number', min: 0 },
                    regions: { type: 'object' },
                    globalFlags: { type: 'object' }
                }
            },
            Character: {
                required: ['id', 'name', 'factionId', 'status'],
                properties: {
                    id: { type: 'string', minLength: 1 },
                    name: { type: 'string', minLength: 1 },
                    factionId: { type: 'string' },
                    status: { type: 'string', enum: ['alive', 'dead', 'missing'] },
                    memories: { type: 'array', items: { type: 'object' } }
                }
            },
            Faction: {
                required: ['id', 'name', 'power', 'wealth'],
                properties: {
                    id: { type: 'string' },
                    name: { type: 'string' },
                    power: { type: 'number', min: 0, max: 100 },
                    wealth: { type: 'number', min: 0 }
                }
            },
            Event: {
                required: ['id', 'type', 'description', 'timestamp'],
                properties: {
                    id: { type: 'string' },
                    type: { type: 'string' },
                    description: { type: 'string' },
                    timestamp: { type: 'number' },
                    involved: { type: 'array', items: { type: 'string' } }
                }
            }
        };

        function validate(data, schemaName) {
            const schema = schemas[schemaName];
            if (!schema) return { valid: false, error: `未知 schema: ${schemaName}` };
            for (const field of schema.required) {
                if (data[field] === undefined) return { valid: false, error: `缺少必需字段: ${field}` };
            }
            for (const [field, rule] of Object.entries(schema.properties)) {
                const value = data[field];
                if (value === undefined) continue;
                if (rule.type === 'string' && typeof value !== 'string') return { valid: false, error: `${field} 应为字符串` };
                if (rule.type === 'number' && typeof value !== 'number') return { valid: false, error: `${field} 应为数字` };
                if (rule.type === 'object' && (typeof value !== 'object' || value === null)) return { valid: false, error: `${field} 应为对象` };
                if (rule.type === 'array' && !Array.isArray(value)) return { valid: false, error: `${field} 应为数组` };
                if (rule.pattern && !rule.pattern.test(value)) return { valid: false, error: `${field} 格式不正确` };
                if (rule.enum && !rule.enum.includes(value)) return { valid: false, error: `${field} 值不在允许范围内` };
                if (rule.min !== undefined && value < rule.min) return { valid: false, error: `${field} 小于最小值 ${rule.min}` };
                if (rule.max !== undefined && value > rule.max) return { valid: false, error: `${field} 大于最大值 ${rule.max}` };
                if (rule.minLength !== undefined && value.length < rule.minLength) return { valid: false, error: `${field} 长度不足 ${rule.minLength}` };
            }
            return { valid: true };
        }

        window.HTYQ2.SchemaValidator = { schemas, validate };
    })();

    // ==================== 3. StorageEngine（三重隔离 + 时间戳） ====================
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
            } catch(e) { console.warn('[HTYQ2] 获取上下文失败，使用默认值', e); }
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
                console.error('[HTYQ2] StorageEngine setItem 失败', e);
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
                console.error('[HTYQ2] StorageEngine getItem 解析失败', e);
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

    // ==================== 4. EventBus ====================
    (function() {
        const listeners = new Map();
        function on(event, callback) { if (!listeners.has(event)) listeners.set(event, []); listeners.get(event).push(callback); }
        function off(event, callback) { const list = listeners.get(event); if (list) { const idx = list.indexOf(callback); if (idx !== -1) list.splice(idx, 1); } }
        function emit(event, data) { if (!listeners.has(event)) return; for (const cb of listeners.get(event)) try { cb(data); } catch(e) { console.error(`[HTYQ2] EventBus 回调错误: ${event}`, e); } }
        function clear() { listeners.clear(); }
        window.HTYQ2.EventBus = { on, off, emit, clear };
    })();

    // ==================== 5. MemoryEngine ====================
    (function() {
        const memories = new Map();
        let nextId = 1;
        function addMemory(content, tags = [], initialStrength = 1.0) {
            const id = `mem_${nextId++}`;
            const now = Date.now();
            const memory = { id, content, tags: [...tags], strength: initialStrength, createdAt: now, lastRecallAt: now };
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

    // ==================== 6. WorldEngine（动态覆盖 + 世界书） ====================
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
            } catch(e) { console.error('[HTYQ2] 加载世界书失败', e); staticBackground = {}; return null; }
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
            for (const k of keys) { if (fromDynamic === undefined) break; fromDynamic = fromDynamic[k]; }
            if (fromDynamic !== undefined) return fromDynamic;
            let fromStatic = staticBackground;
            for (const k of keys) { if (fromStatic === undefined) break; fromStatic = fromStatic[k]; }
            return fromStatic;
        }
        function getFullDynamic() { return JSON.parse(JSON.stringify(dynamicState)); }
        window.HTYQ2.WorldEngine = { loadWorldbook, setDynamic, getWorldState, getFullDynamic };
    })();

    // ==================== 7. APIManager ====================
    (function() {
        function getSettingsPath() { return 'settings/api'; }
        let currentSettings = { mode: 'tavern', customUrl: '', customKey: '', customModel: '' };

        function loadSettings() {
            const saved = window.HTYQ2.StorageEngine.getItem(getSettingsPath());
            if (saved && typeof saved === 'object') currentSettings = { ...currentSettings, ...saved };
            return currentSettings;
        }
        function saveSettings(settings) {
            currentSettings = { ...currentSettings, ...settings };
            window.HTYQ2.StorageEngine.setItem(getSettingsPath(), currentSettings);
            return currentSettings;
        }

        async function callAPI(messages, options = {}) {
            const settings = loadSettings();
            const temperature = options.temperature ?? 0.8;
            const maxTokens = options.maxTokens ?? 2000;

            if (settings.mode === 'custom' && settings.customUrl) {
                let url = settings.customUrl.trim().replace(/\/+$/, '');
                if (!url.endsWith('/chat/completions')) {
                    url = url.endsWith('/v1') ? url + '/chat/completions' : url + '/v1/chat/completions';
                }
                const headers = {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${settings.customKey}`
                };
                const body = {
                    model: settings.customModel || 'gpt-3.5-turbo',
                    messages: messages,
                    temperature: temperature,
                    max_tokens: maxTokens
                };
                try {
                    const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
                    if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                    const data = await resp.json();
                    return data.choices[0].message.content;
                } catch(e) {
                    console.error('[HTYQ2] 自定义 API 调用失败', e);
                    throw e;
                }
            } else {
                let ctx = null;
                try {
                    if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ctx = SillyTavern.getContext();
                    else if (typeof getContext === 'function') ctx = getContext();
                } catch(e) {}
                if (!ctx || !ctx.generateRaw) throw new Error('酒馆 generateRaw 不可用');
                let prompt = '';
                for (const msg of messages) {
                    const role = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : 'System');
                    prompt += `${role}: ${msg.content}\n`;
                }
                const result = await ctx.generateRaw({ prompt, max_tokens: maxTokens, temperature, should_stream: false });
                return typeof result === 'string' ? result : (result.text || String(result));
            }
        }

        async function testConnection() {
            try {
                const response = await callAPI([{ role: 'user', content: 'Hello' }], { maxTokens: 10 });
                return { success: true, preview: response?.substring(0, 50) };
            } catch(e) {
                return { success: false, error: e.message };
            }
        }

        window.HTYQ2.APIManager = { loadSettings, saveSettings, callAPI, testConnection };
        loadSettings();
    })();

    // ==================== 8. 默认世界状态初始化 ====================
    (function() {
        function initDefaultWorldState() {
            const existing = window.HTYQ2.StorageEngine.getItem('world/current');
            if (existing) return existing;
            const defaultState = {
                version: '2.0',
                timestamp: Date.now(),
                worldDigest: '世界尚未开始推演，一切处于混沌。',
                overallAtmosphere: '平静',
                drivingEvent: '无',
                citizenMood: '冷漠',
                securityStatus: '一般',
                astrology: '平稳',
                reputation: { jianghu: '默默无闻', official: '默默无闻', folk: '默默无闻', underworld: '默默无闻' },
                economy: { fundsStatus: '勉强糊口', marketTrend: '平稳', keyResources: [] },
                rumors: [],
                events: [],
                factions: []
            };
            window.HTYQ2.StorageEngine.setItem('world/current', defaultState);
            return defaultState;
        }
        window.HTYQ2.getWorldState = () => window.HTYQ2.StorageEngine.getItem('world/current') || initDefaultWorldState();
        window.HTYQ2.saveWorldState = (newState) => window.HTYQ2.StorageEngine.setItem('world/current', newState);
        initDefaultWorldState();
    })();

    // ==================== 9. UI 面板模块（可拖拽，适配移动端/PC端） ====================
    (function() {
        // 等待 DOM 加载完成
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', buildUI);
        } else {
            buildUI();
        }

        function buildUI() {
            // 防止重复创建
            if (document.getElementById('htyq2-globe')) return;

            // 注入全局样式
            const style = document.createElement('style');
            style.textContent = `
                /* 悬浮球 */
                #htyq2-globe {
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
                    transition: transform 0.2s, box-shadow 0.2s;
                    user-select: none;
                    touch-action: none;
                }
                #htyq2-globe:active { cursor: grabbing; }
                #htyq2-globe:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
                .htyq2-globe-icon { font-size: 28px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2); pointer-events: none; }

                /* 面板 */
                #htyq2-panel {
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
                    min-width: 480px;
                    min-height: 500px;
                }
                @media (max-width: 768px) {
                    #htyq2-panel {
                        width: 90vw !important;
                        height: 80vh !important;
                        min-width: unset;
                        min-height: unset;
                    }
                }
                .htyq2-panel-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    padding: 12px 16px;
                    background: #1e2937;
                    cursor: grab;
                    border-bottom: 1px solid #334155;
                }
                .htyq2-panel-header:active { cursor: grabbing; }
                .htyq2-panel-title { font-weight: bold; font-size: 16px; color: #a78bfa; }
                .htyq2-panel-close {
                    background: none;
                    border: none;
                    color: #94a3b8;
                    font-size: 20px;
                    cursor: pointer;
                    padding: 0 6px;
                    border-radius: 8px;
                }
                .htyq2-panel-close:hover { background: #334155; color: white; }
                .htyq2-panel-content {
                    flex: 1;
                    overflow-y: auto;
                    padding: 16px;
                }
                .htyq2-card {
                    background: #1e2937;
                    border-radius: 12px;
                    padding: 12px;
                    margin-bottom: 16px;
                    border-left: 3px solid #3b82f6;
                }
                .htyq2-card h3 {
                    margin: 0 0 8px 0;
                    font-size: 15px;
                    color: #60a5fa;
                }
                .htyq2-button {
                    background: linear-gradient(135deg, #2563eb, #4f46e5);
                    border: none;
                    color: white;
                    padding: 8px 20px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-weight: bold;
                    margin-right: 10px;
                }
                .htyq2-footer {
                    border-top: 1px solid #334155;
                    padding: 12px;
                    display: flex;
                    justify-content: space-between;
                    background: #0f172a;
                }
                .htyq2-stats {
                    font-size: 13px;
                    color: #fbbf24;
                }
            `;
            document.head.appendChild(style);

            // 悬浮球
            const globe = document.createElement('div');
            globe.id = 'htyq2-globe';
            globe.innerHTML = '<span class="htyq2-globe-icon">🌐</span>';
            document.body.appendChild(globe);

            // 面板
            const panel = document.createElement('div');
            panel.id = 'htyq2-panel';
            panel.innerHTML = `
                <div class="htyq2-panel-header">
                    <span class="htyq2-panel-title">📋 HTYQ 2.0 世界状态</span>
                    <button class="htyq2-panel-close" aria-label="关闭">✕</button>
                </div>
                <div class="htyq2-panel-content" id="htyq2-panel-content">
                    <div style="text-align:center; padding:20px;">加载中...</div>
                </div>
                <div class="htyq2-footer">
                    <button id="htyq2-evolve-btn" class="htyq2-button">🌀 手动推演</button>
                    <button id="htyq2-refresh-btn" class="htyq2-button" style="background:#3b82f6;">🔄 刷新</button>
                    <div class="htyq2-stats">轮次: <span id="htyq2-round">0</span></div>
                </div>
            `;
            document.body.appendChild(panel);

            // 拖拽逻辑
            let dragMoved = false;
            let dragStarted = false;
            let panelVisible = false;

            function setPos(el, left, top) {
                el.style.left = left + 'px';
                el.style.top = top + 'px';
                el.style.right = 'auto';
                el.style.bottom = 'auto';
            }

            function makeDraggable(el, onDragEnd, handleSelector) {
                let startX = 0, startY = 0, startLeft = 0, startTop = 0, dragging = false;
                const handle = handleSelector ? el.querySelector(handleSelector) : el;
                if (!handle) return;
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
                    setPos(el, newLeft, newTop);
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
                handle.addEventListener('mousedown', onDown);
                handle.addEventListener('touchstart', onDown, { passive: false });
            }

            // 保存位置
            function loadStoredPosition(el, key, defaultLeft, defaultTop) {
                const saved = localStorage.getItem(key);
                if (saved) {
                    try {
                        const pos = JSON.parse(saved);
                        let { left, top } = pos;
                        left = Math.min(Math.max(left, 10), window.innerWidth - el.offsetWidth);
                        top = Math.min(Math.max(top, 10), window.innerHeight - el.offsetHeight);
                        setPos(el, left, top);
                        return;
                    } catch(e) {}
                }
                setPos(el, defaultLeft, defaultTop);
            }
            function savePosition(el, key) {
                localStorage.setItem(key, JSON.stringify({ left: el.offsetLeft, top: el.offsetTop }));
            }

            loadStoredPosition(globe, 'htyq2_globe_pos', window.innerWidth - 68, window.innerHeight - 68);
            loadStoredPosition(panel, 'htyq2_panel_pos', (window.innerWidth - 540) / 2, (window.innerHeight - 600) / 2);
            makeDraggable(globe, (l,t) => savePosition(globe, 'htyq2_globe_pos'));
            makeDraggable(panel, (l,t) => savePosition(panel, 'htyq2_panel_pos'), '.htyq2-panel-header');

            // 点击悬浮球开关面板
            let globeDragMoved = false, globeDragStarted = false;
            globe.addEventListener('mousedown', () => { globeDragMoved = false; globeDragStarted = true; });
            globe.addEventListener('touchstart', () => { globeDragMoved = false; globeDragStarted = true; });
            globe.addEventListener('mousemove', () => { if (globeDragStarted) globeDragMoved = true; });
            globe.addEventListener('touchmove', () => { if (globeDragStarted) globeDragMoved = true; });
            globe.addEventListener('mouseup', () => {
                if (globeDragStarted && !globeDragMoved) togglePanel();
                globeDragStarted = false; globeDragMoved = false;
            });
            globe.addEventListener('touchend', () => {
                if (globeDragStarted && !globeDragMoved) togglePanel();
                globeDragStarted = false; globeDragMoved = false;
            });

            const closeBtn = panel.querySelector('.htyq2-panel-close');
            function togglePanel() {
                if (panelVisible) closePanel();
                else openPanel();
            }
            function openPanel() {
                panel.style.display = 'flex';
                panelVisible = true;
                refreshPanelContent();
            }
            function closePanel() {
                panel.style.display = 'none';
                panelVisible = false;
            }
            closeBtn.addEventListener('click', closePanel);

            // 刷新面板内容
            function refreshPanelContent() {
                const contentDiv = panel.querySelector('#htyq2-panel-content');
                const worldState = window.HTYQ2.getWorldState();
                const round = worldState.timestamp ? Math.floor((Date.now() - worldState.timestamp) / 60000) : 0; // 临时轮次
                document.getElementById('htyq2-round').innerText = round;

                const reputation = worldState.reputation || { jianghu:'默默无闻', official:'默默无闻', folk:'默默无闻', underworld:'默默无闻' };
                const eco = worldState.economy || { fundsStatus:'未知', marketTrend:'平稳' };
                const rumors = (worldState.rumors || []).slice(0, 5);
                const events = (worldState.events || []).slice(0, 5);
                const factions = (worldState.factions || []).slice(0, 5);

                contentDiv.innerHTML = `
                    <div class="htyq2-card">
                        <h3>🌍 世界摘要</h3>
                        <div>${escapeHtml(worldState.worldDigest || '无')}</div>
                    </div>
                    <div class="htyq2-card">
                        <h3>⭐ 声誉</h3>
                        <div>江湖:${reputation.jianghu} 官府:${reputation.official} 民间:${reputation.folk} 黑道:${reputation.underworld}</div>
                    </div>
                    <div class="htyq2-card">
                        <h3>💰 经济</h3>
                        <div>资金:${eco.fundsStatus} | 市场:${eco.marketTrend}</div>
                    </div>
                    <div class="htyq2-card">
                        <h3>⚡ 事件链（最近5条）</h3>
                        ${events.map(e => `<div>• ${escapeHtml(e.name || e.description)}</div>`).join('') || '<div>无</div>'}
                    </div>
                    <div class="htyq2-card">
                        <h3>🗣️ 流言（最近5条）</h3>
                        ${rumors.map(r => `<div>• ${escapeHtml(r.content)}</div>`).join('') || '<div>无</div>'}
                    </div>
                    <div class="htyq2-card">
                        <h3>🏛️ 势力（最近5个）</h3>
                        ${factions.map(f => `<div>• ${escapeHtml(f.name)}</div>`).join('') || '<div>无</div>'}
                    </div>
                `;
            }

            // 手动推演按钮（占位，后续接入推演引擎）
            const evolveBtn = document.getElementById('htyq2-evolve-btn');
            evolveBtn.addEventListener('click', async () => {
                console.log('[HTYQ2] 手动推演触发（占位）');
                // 临时调用 APIManager 示例
                try {
                    const response = await window.HTYQ2.APIManager.callAPI([{ role: 'user', content: '请简要推演下一步世界状态' }], { maxTokens: 200 });
                    console.log('推演结果:', response);
                    // 更新世界摘要示例
                    const state = window.HTYQ2.getWorldState();
                    state.worldDigest = response.substring(0, 200);
                    state.timestamp = Date.now();
                    window.HTYQ2.saveWorldState(state);
                    refreshPanelContent();
                } catch(e) {
                    console.error('推演失败', e);
                }
            });

            const refreshBtn = document.getElementById('htyq2-refresh-btn');
            refreshBtn.addEventListener('click', () => refreshPanelContent());

            function escapeHtml(str) {
                if (!str) return '';
                return String(str).replace(/[&<>]/g, function(m) {
                    if (m === '&') return '&amp;';
                    if (m === '<') return '&lt;';
                    if (m === '>') return '&gt;';
                    return m;
                });
            }

            // 初始刷新一次
            refreshPanelContent();
        }
    })();

    // ==================== 10. 调试工具 ====================
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
            const worldState = window.HTYQ2.getWorldState();
            if (worldState) {
                const validation = window.HTYQ2.SchemaValidator.validate(worldState, 'WorldState');
                if (!validation.valid) issues.push(`WorldState 无效: ${validation.error}`);
            }
            return { valid: issues.length === 0, issues };
        }
        window.HTYQ2.debug = { status, exportState, validateAll };
    })();

    // ==================== 11. 初始化完成 ====================
    window.HTYQ2._internal.ready = true;
    console.log('[HTYQ2] 完整版已加载（含UI面板）', { version: window.HTYQ2.version });
})();
