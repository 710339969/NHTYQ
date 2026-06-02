// 世界状态默认值与辅助函数
(function() {
    function initDefaultWorldState() {
        return {
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
    }

    function getWorldState() {
        let state = window.HTYQ2.StorageEngine.getItem('world/current');
        if (!state) {
            state = initDefaultWorldState();
            window.HTYQ2.StorageEngine.setItem('world/current', state);
        }
        return state;
    }

    function saveWorldState(newState) {
        window.HTYQ2.StorageEngine.setItem('world/current', newState);
    }

    window.HTYQ2.WorldState = { get: getWorldState, save: saveWorldState, initDefault: initDefaultWorldState };
})();
