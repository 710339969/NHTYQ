// HTYQ 2.0 核心插件 - 基础框架（含 API 管理、设置、核心模块）
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

    // ==================== 7. APIManager（支持酒馆自带和自定义 API） ====================
    (function() {
        // 设置存储 key（与聊天隔离）
        function getSettingsPath() { return 'settings/api'; }
        let currentSettings = { mode: 'tavern', customUrl: '', customKey: '', customModel: '' };

        // 加载保存的设置
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

        // 核心 API 调用函数
        async function callAPI(messages, options = {}) {
            const settings = loadSettings();
            const temperature = options.temperature ?? 0.8;
            const maxTokens = options.maxTokens ?? 2000;

            if (settings.mode === 'custom' && settings.customUrl) {
                // 自定义 OpenAI 兼容 API
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
                // 使用酒馆自带 generateRaw
                let ctx = null;
                try {
                    if (typeof SillyTavern !== 'undefined' && SillyTavern.getContext) ctx = SillyTavern.getContext();
                    else if (typeof getContext === 'function') ctx = getContext();
                } catch(e) {}
                if (!ctx || !ctx.generateRaw) throw new Error('酒馆 generateRaw 不可用');
                // 将 messages 转换为 prompt 字符串
                let prompt = '';
                for (const msg of messages) {
                    const role = msg.role === 'user' ? 'User' : (msg.role === 'assistant' ? 'Assistant' : 'System');
                    prompt += `${role}: ${msg.content}\n`;
                }
                const result = await ctx.generateRaw({ prompt, max_tokens: maxTokens, temperature, should_stream: false });
                return typeof result === 'string' ? result : (result.text || String(result));
            }
        }

        // 测试连接
        async function testConnection() {
            try {
                const response = await callAPI([{ role: 'user', content: 'Hello' }], { maxTokens: 10 });
                return { success: true, preview: response?.substring(0, 50) };
            } catch(e) {
                return { success: false, error: e.message };
            }
        }

        window.HTYQ2.APIManager = { loadSettings, saveSettings, callAPI, testConnection };
        // 初始化加载设置
        loadSettings();
    })();

    // ==================== 8. 调试工具 ====================
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
            const worldState = window.HTYQ2.StorageEngine.getItem('world/current');
            if (worldState) {
                const validation = window.HTYQ2.SchemaValidator.validate(worldState, 'WorldState');
                if (!validation.valid) issues.push(`WorldState 无效: ${validation.error}`);
            }
            return { valid: issues.length === 0, issues };
        }
        window.HTYQ2.debug = { status, exportState, validateAll };
    })();

    // ==================== 9. 初始化完成 ====================
    window.HTYQ2._internal.ready = true;
    console.log('[HTYQ2] 基础框架已加载', { version: window.HTYQ2.version, apiMode: window.HTYQ2.APIManager?.loadSettings().mode });
})();
