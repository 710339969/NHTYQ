// UI 样式注入
(function() {
    if (document.getElementById('htyq2-styles')) return;
    const style = document.createElement('style');
    style.id = 'htyq2-styles';
    style.textContent = `
        #htyq2-globe {
            position: fixed; z-index: 10000; width: 48px; height: 48px;
            border-radius: 50%; background: linear-gradient(135deg, #2b6cb0, #1a4a7a);
            box-shadow: 0 4px 12px rgba(0,0,0,0.3); cursor: grab;
            display: flex; align-items: center; justify-content: center;
            transition: transform 0.2s, box-shadow 0.2s; user-select: none; touch-action: none;
        }
        #htyq2-globe:active { cursor: grabbing; }
        #htyq2-globe:hover { transform: scale(1.05); box-shadow: 0 6px 16px rgba(0,0,0,0.4); }
        .htyq2-globe-icon { font-size: 28px; color: white; text-shadow: 0 1px 2px rgba(0,0,0,0.2); pointer-events: none; }
        #htyq2-panel {
            position: fixed; z-index: 10001; background: #0f172a; color: #e2e8f0;
            border-radius: 16px; box-shadow: 0 8px 20px rgba(0,0,0,0.5);
            border: 1px solid #334155; display: none; flex-direction: column; overflow: hidden;
            width: 540px; height: 600px; min-width: 480px; min-height: 500px;
        }
        @media (max-width: 768px) {
            #htyq2-panel { width: 90vw !important; height: 80vh !important; min-width: unset; min-height: unset; }
        }
        .htyq2-panel-header {
            display: flex; justify-content: space-between; align-items: center;
            padding: 12px 16px; background: #1e2937; cursor: grab; border-bottom: 1px solid #334155;
        }
        .htyq2-panel-header:active { cursor: grabbing; }
        .htyq2-panel-title { font-weight: bold; font-size: 16px; color: #a78bfa; }
        .htyq2-panel-close {
            background: none; border: none; color: #94a3b8; font-size: 20px;
            cursor: pointer; padding: 0 6px; border-radius: 8px;
        }
        .htyq2-panel-close:hover { background: #334155; color: white; }
        .htyq2-panel-content { flex: 1; overflow-y: auto; padding: 16px; }
        .htyq2-card {
            background: #1e2937; border-radius: 12px; padding: 12px; margin-bottom: 16px;
            border-left: 3px solid #3b82f6;
        }
        .htyq2-card h3 { margin: 0 0 8px 0; font-size: 15px; color: #60a5fa; }
        .htyq2-button {
            background: linear-gradient(135deg, #2563eb, #4f46e5); border: none; color: white;
            padding: 8px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; margin-right: 10px;
        }
        .htyq2-footer {
            border-top: 1px solid #334155; padding: 12px; display: flex;
            justify-content: space-between; background: #0f172a;
        }
        .htyq2-stats { font-size: 13px; color: #fbbf24; }
    `;
    document.head.appendChild(style);
})();
