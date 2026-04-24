/**
 * theme.js — 主题管理
 * 深色/浅色模式切换，CSS 变量驱动
 */
const AppTheme = (() => {
    let currentTheme = 'light';

    const THEME_DEFAULTS = {
        light: { textColor: '#ffffff', bgAdjust: 0, textAdjust: 1.0 },
        dark:  { textColor: '#e0e0e0', bgAdjust: 0.15, textAdjust: 1.1 }
    };

    function init() {
        const settings = AppStorage.loadSettings();
        apply(settings.theme);
    }

    function apply(theme) {
        currentTheme = theme;
        document.documentElement.setAttribute('data-theme', theme);
    }

    function get() {
        return currentTheme;
    }

    function toggle() {
        const next = currentTheme === 'light' ? 'dark' : 'light';
        set(next);
        return next;
    }

    function set(theme) {
        const settings = AppStorage.loadSettings();
        const oldTheme = settings.theme;

        settings.theme = theme;
        AppStorage.saveSettings(settings);
        apply(theme);

        // 切换主题时自动重置文字颜色
        if (settings.resetTextColorOnThemeChange && oldTheme !== theme) {
            const defaults = THEME_DEFAULTS[theme];
            settings.textColor = defaults.textColor;
            AppStorage.saveSettings(settings);
        }
    }

    function getTextColorForTheme(theme) {
        return THEME_DEFAULTS[theme || currentTheme].textColor;
    }

    return { init, apply, get, toggle, set, THEME_DEFAULTS, getTextColorForTheme };
})();
