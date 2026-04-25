/**
 * storage.js — 数据持久化层
 */
const AppStorage = (() => {
    const KEYS = {
        WHEEL_GROUPS: 'lw_wheel_groups',
        SETTINGS: 'lw_settings',
        CURRENT_GROUP: 'lw_current_group',
        CURRENT_WHEEL: 'lw_current_wheel',
    };

    const COLOR_SCHEMES = {
        classic: {
            name: '经典多彩',
            colors: ['#FF6B6B','#4ECDC4','#45B7D1','#96CEB4','#FFEAA7','#DDA0DD','#98D8C8','#F7DC6F','#BB8FCE','#85C1E9',
                     '#E74C3C','#2ECC71','#3498DB','#F39C12','#9B59B6','#1ABC9C','#E67E22','#2980B9','#27AE60','#C0392B']
        },
        pastel: {
            name: '柔和马卡龙',
            colors: ['#FFB3BA','#BAFFC9','#BAE1FF','#FFFFBA','#E8BAFF','#FFD9BA','#C9BAFF','#BAFFF5','#FFC9DE','#D4E4FF',
                     '#F8BBD0','#C8E6C9','#BBDEFB','#FFF9C4','#E1BEE7','#FFE0B2','#D1C4E9','#B2EBF2','#FCE4EC','#E0F7FA']
        },
        neon: {
            name: '霓虹荧光',
            colors: ['#FF0080','#00FF80','#0080FF','#FF8000','#8000FF','#FF00FF','#00FFFF','#80FF00','#FF0040','#4000FF',
                     '#FF1493','#00FA9A','#1E90FF','#FF6347','#9400D3','#FF69B4','#00CED1','#7FFF00','#FF4500','#6A0DAD']
        },
        ocean: {
            name: '海洋蓝绿',
            colors: ['#0077B6','#00B4D8','#48CAE4','#90E0EF','#006D77','#83C5BE','#0096C7','#023E8A','#0353A4','#006494',
                     '#005F73','#0A9396','#94D2BD','#E9D8A6','#EE9B00','#CA6702','#BB3E03','#AE2012','#9B2226','#001219']
        },
        warm: {
            name: '暖色调',
            colors: ['#E76F51','#F4A261','#E9C46A','#264653','#2A9D8F','#E63946','#457B9D','#1D3557','#F1FAEE','#A8DADC',
                     '#D4A373','#CCD5AE','#E9EDC9','#FEFAE0','#FAEDCD','#D4A373','#BC6C25','#DDA15E','#606C38','#283618']
        }
    };

    const DEFAULT_SETTINGS = {
        theme: 'light',
        defaultSpinDuration: 4,
        textColor: '#ffffff',
        resetTextColorOnThemeChange: true,
        colorScheme: 'classic',
        spinMode: 'wheel',
        allowRepeat: true,
        clickToStop: true,
        decelerationPreset: 'normal',
        textStrokeEnabled: true,
        textStrokeColor: '#000000',
        textStrokeWidth: 2,
        sfxVolume: 0.5,
        sfxMuted: false,
        sfxTickTimbre: 'crisp',
    };

    const DECELERATION_MAP = {
        slow:   0.992,
        normal: 0.984,
        fast:   0.970,
    };

    function genId() {
        return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
    }

    function deepClone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    function createDefaultGroup() {
        return { id: genId(), name: '默认转盘组', createdAt: Date.now(), wheels: [createDefaultWheel()] };
    }

    function createDefaultWheel() {
        return {
            id: genId(), name: '幸运转盘',
            options: [
                { id: genId(), text: '选项一', weight: 1, enabled: true, customColor: null },
                { id: genId(), text: '选项二', weight: 1, enabled: true, customColor: null },
                { id: genId(), text: '选项三', weight: 1, enabled: true, customColor: null },
                { id: genId(), text: '选项四', weight: 1, enabled: true, customColor: null },
                { id: genId(), text: '选项五', weight: 1, enabled: true, customColor: null },
                { id: genId(), text: '选项六', weight: 1, enabled: true, customColor: null },
            ],
            spinMode: 'wheel', allowRepeat: true, clickToStop: true,
            colorSchemeId: 'classic', drawnOptions: [],
        };
    }

    function load(key, fallback) {
        try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback; }
        catch (e) { return fallback; }
    }

    function save(key, data) {
        try { localStorage.setItem(key, JSON.stringify(data)); } catch (e) {}
    }

    function loadGroups() {
        let g = load(KEYS.WHEEL_GROUPS, null);
        if (!g || g.length === 0) { g = [createDefaultGroup()]; saveGroups(g); }
        return g;
    }
    function saveGroups(g) { save(KEYS.WHEEL_GROUPS, g); }
    function addGroup(name) {
        const gs = loadGroups();
        const ng = { id: genId(), name: name || '新转盘组', createdAt: Date.now(), wheels: [] };
        gs.push(ng); saveGroups(gs); return ng;
    }
    function updateGroup(gid, patch) {
        const gs = loadGroups(); const g = gs.find(x => x.id === gid);
        if (g) Object.assign(g, patch); saveGroups(gs); return g;
    }
    function deleteGroup(gid) {
        let gs = loadGroups(); gs = gs.filter(g => g.id !== gid);
        if (gs.length === 0) gs = [createDefaultGroup()];
        saveGroups(gs); return gs;
    }

    function addWheel(gid, w) {
        const gs = loadGroups(); const g = gs.find(x => x.id === gid);
        if (!g) return null;
        const nw = w || createDefaultWheel();
        if (!w) nw.name = '新转盘 ' + (g.wheels.length + 1);
        g.wheels.push(nw); saveGroups(gs); return nw;
    }
    function updateWheel(gid, wid, patch) {
        const gs = loadGroups(); const g = gs.find(x => x.id === gid);
        if (!g) return null;
        const w = g.wheels.find(x => x.id === wid);
        if (w) Object.assign(w, patch);
        saveGroups(gs); return w;
    }
    function deleteWheel(gid, wid) {
        const gs = loadGroups(); const g = gs.find(x => x.id === gid);
        if (!g) return gs;
        g.wheels = g.wheels.filter(w => w.id !== wid);
        saveGroups(gs); return gs;
    }

    function loadSettings() {
        const s = load(KEYS.SETTINGS, {});
        return { ...deepClone(DEFAULT_SETTINGS), ...s };
    }
    function saveSettings(s) { save(KEYS.SETTINGS, s); }
    function resetSettings() { save(KEYS.SETTINGS, deepClone(DEFAULT_SETTINGS)); return deepClone(DEFAULT_SETTINGS); }

    function loadCurrentGroup() { return localStorage.getItem(KEYS.CURRENT_GROUP) || null; }
    function saveCurrentGroup(id) { localStorage.setItem(KEYS.CURRENT_GROUP, id); }
    function loadCurrentWheel() { return localStorage.getItem(KEYS.CURRENT_WHEEL) || null; }
    function saveCurrentWheel(id) { localStorage.setItem(KEYS.CURRENT_WHEEL, id); }

    function exportAll() {
        return JSON.stringify({ groups: loadGroups(), settings: loadSettings(), exportedAt: Date.now(), version: '1.0' }, null, 2);
    }
    function importAll(json) {
        try { const d = JSON.parse(json); if (d.groups) saveGroups(d.groups); if (d.settings) saveSettings(d.settings); return true; }
        catch (e) { return false; }
    }

    return {
        COLOR_SCHEMES, DEFAULT_SETTINGS, DECELERATION_MAP,
        genId, deepClone, createDefaultWheel, createDefaultGroup,
        loadGroups, saveGroups, addGroup, updateGroup, deleteGroup,
        addWheel, updateWheel, deleteWheel,
        loadSettings, saveSettings, resetSettings,
        loadCurrentGroup, saveCurrentGroup, loadCurrentWheel, saveCurrentWheel,
        exportAll, importAll,
    };
})();
