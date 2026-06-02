// 数据验证器
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
