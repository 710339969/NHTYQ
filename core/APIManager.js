// API 管理器（酒馆自带 + 自定义）
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
            const resp = await fetch(url, { method: 'POST', headers, body: JSON.stringify(body) });
            if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
            const data = await resp.json();
            return data.choices[0].message.content;
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
