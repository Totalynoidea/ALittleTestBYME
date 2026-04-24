/**
 * app.js — 主应用入口 v4
 * 修复：跳过禁用区、旋转中不禁用、拖拽误触、按钮停止、拖拽恢复颜色、中心圆动画、渲染循环
 */
(function () {
    'use strict';

    let currentGroupId = null, currentWheelId = null, currentWheel = null;
    let resultIndex = -1, resultText = '';
    let renderLoopActive = false, didDrag = false;

    const canvas = document.getElementById('wheel-canvas');
    const wheelNameEl = document.getElementById('wheel-name');
    const appTitleEl = document.getElementById('app-title');
    const pointerTarget = document.getElementById('pointer-target');
    const spinBtn = document.getElementById('spin-btn');
    const settingsBtn = document.getElementById('settings-btn');
    const wheelTabs = document.getElementById('wheel-tabs');
    const editBtn = document.getElementById('edit-btn');
    const resetDrawnBtn = document.getElementById('reset-drawn-btn');
    const presetBtn = document.getElementById('preset-btn');

    function init() {
        AppTheme.init(); WheelRenderer.init(canvas);
        loadSelection(); bindEvents(); render();
    }

    function loadSelection() {
        const gs = AppStorage.loadGroups();
        currentGroupId = AppStorage.loadCurrentGroup() || gs[0]?.id;
        currentWheelId = AppStorage.loadCurrentWheel();
        if (!gs.find(g => g.id === currentGroupId) && gs.length) currentGroupId = gs[0].id;
        loadWheel();
        if (!currentWheel && gs.length) {
            const g = gs.find(g => g.id === currentGroupId);
            if (g?.wheels.length) { currentWheelId = g.wheels[0].id; loadWheel(); }
        }
        AppStorage.saveCurrentGroup(currentGroupId);
        if (currentWheelId) AppStorage.saveCurrentWheel(currentWheelId);
        const s = AppStorage.loadSettings();
        const hp = document.getElementById('help-panel');
        if (hp) { if (s.showHelp !== false) hp.classList.add('visible'); else hp.classList.remove('visible'); }
    }

    function loadWheel() {
        currentWheel = AppStorage.loadGroups().find(g => g.id === currentGroupId)?.wheels.find(w => w.id === currentWheelId) || null;
    }

    /* ── 渲染 ── */
    function render() {
        if (!currentWheel) { WheelRenderer.draw(null, 0); pointerTarget.textContent = ''; wheelNameEl.textContent = ''; updateBtn(); wheelTabs.innerHTML = ''; return; }
        wheelNameEl.textContent = currentWheel.name || '';
        const s = AppStorage.loadSettings(), rot = SpinEngine.getAngle();
        const sm = currentWheel.spinMode || s.spinMode || 'wheel';
        SpinEngine.setConfig({ buttonSpinDuration: s.defaultSpinDuration, decelerationPreset: s.decelerationPreset, clickToStop: s.clickToStop });
        WheelRenderer.draw(currentWheel, rot, { theme: s.theme, spinMode: sm, resultIndex, drawnOptions: currentWheel.drawnOptions || [], textColor: s.textColor, textStrokeEnabled: s.textStrokeEnabled, textStrokeColor: s.textStrokeColor, textStrokeWidth: s.textStrokeWidth });
        updateTarget(rot, sm); updateBtn(); renderTabs();
    }

    function updateTarget(rot, sm) {
        if (!currentWheel) { pointerTarget.textContent = ''; return; }
        const all = WheelRenderer.getSegments(), enabled = all.filter(s => !s.disabled);
        if (!enabled.length) { pointerTarget.textContent = ''; return; }
        const idx = SpinEngine.getResultIndex(enabled);
        if (idx < 0) { pointerTarget.textContent = ''; return; }
        pointerTarget.textContent = enabled[idx].text;
        pointerTarget.classList.toggle('result-active', idx === resultIndex);
    }

    function renderTabs() {
        const g = AppStorage.loadGroups().find(g => g.id === currentGroupId);
        if (!g || g.wheels.length <= 1) { wheelTabs.innerHTML = ''; wheelTabs.style.display = 'none'; return; }
        wheelTabs.style.display = 'flex'; wheelTabs.innerHTML = '';
        g.wheels.forEach(w => {
            const t = document.createElement('button'); t.className = 'wheel-tab' + (w.id === currentWheelId ? ' active' : '');
            t.textContent = w.name;
            t.onclick = () => { if (SpinEngine.isSpinning()) return; currentWheelId = w.id; loadWheel(); AppStorage.saveCurrentWheel(w.id); resultIndex = -1; SpinEngine.reset(); render(); };
            wheelTabs.appendChild(t);
        });
    }

    function updateBtn() {
        if (SpinEngine.isResult()) { spinBtn.textContent = '🎡 再转一次'; spinBtn.disabled = false; spinBtn.onclick = () => { resultIndex = -1; doSpin(); }; }
        else if (SpinEngine.isSpinning()) { spinBtn.textContent = '⏹ 立刻停止'; spinBtn.disabled = false; spinBtn.onclick = () => SpinEngine.quickStop(); }
        else { spinBtn.textContent = '🎰 开始旋转'; spinBtn.disabled = !currentWheel; spinBtn.onclick = () => doSpin(); }
    }

    function doSpin() {
        if (!currentWheel) return;
        const s = AppStorage.loadSettings();
        if (!s.allowRepeat) {
            const avail = currentWheel.options.filter(o => o.enabled && !currentWheel.drawnOptions?.includes(o.id));
            if (!avail.length) { UI.toast('所有选项已抽完', 'warn'); return; }
        }
        SpinEngine.spin(); startLoop();
    }

    /* ── 渲染循环 ── */
    function startLoop() { if (!renderLoopActive) { renderLoopActive = true; requestAnimationFrame(tick); } }
    function tick() {
        render();
        if (SpinEngine.isSpinning() || SpinEngine.isDragging()) {
            requestAnimationFrame(tick);
        } else renderLoopActive = false;
    }
    function reqRender() { if (!SpinEngine.isSpinning() && !SpinEngine.isDragging()) startLoop(); }

    function toCanvas(e) { const r = canvas.getBoundingClientRect(); return { x: (e.clientX || 0) - r.left, y: (e.clientY || 0) - r.top }; }

    /* ── 事件 ── */
    function bindEvents() {
        spinBtn.onclick = () => doSpin();

        SpinEngine.onTick = () => {};
        SpinEngine.onStateChange = (ns) => {
            updateBtn();
            if (ns === SpinEngine.STATE.SPINNING) startLoop(); // 确保旋转时渲染循环在跑
            if (ns === SpinEngine.STATE.DRAGGING) { resultIndex = -1; resultText = ''; startLoop(); } // 拖拽时恢复颜色
        };
        SpinEngine.onResult = (a) => handleResult(a);
        SpinEngine.onSpinStart = () => { resultIndex = -1; resultText = ''; }; // 旋转开始时清除高亮
        SpinEngine.onCenterLongPress = () => { SpinEngine.skipToResult(WheelRenderer.getSegments().filter(s => !s.disabled)); startLoop(); };

        // Canvas down
        canvas.addEventListener('mousedown', onDown);
        canvas.addEventListener('touchstart', e => { e.preventDefault(); onDown(e.touches[0]); }, { passive: false });

        // 文档级 move/up（拖拽不丢失）
        document.addEventListener('mousemove', onMove);
        document.addEventListener('mouseup', onUp);
        document.addEventListener('touchmove', e => { if (SpinEngine.isDragActive()) { e.preventDefault(); onMove(e.touches[0]); } }, { passive: false });
        document.addEventListener('touchend', e => { if (SpinEngine.isDragActive()) { e.preventDefault(); onUp(); } }, { passive: false });

        canvas.addEventListener('mouseleave', () => { WheelRenderer.setCenterHover(false); canvas.style.cursor = 'default'; });

        settingsBtn.onclick = () => UI.openSettings(s => { if (currentWheel) { AppStorage.updateWheel(currentGroupId, currentWheelId, { spinMode: s.spinMode, allowRepeat: s.allowRepeat, clickToStop: s.clickToStop, colorSchemeId: s.colorScheme }); loadWheel(); } render(); });
        editBtn.onclick = () => {
            if (!currentWheel) return;
            if (SpinEngine.isSpinning()) { UI.toast('请等待停止', 'warn'); return; }
            UI.openWheelEditor(AppStorage.deepClone(currentWheel), w => {
                AppStorage.updateWheel(currentGroupId, currentWheelId, w); loadWheel(); resultIndex = -1; SpinEngine.reset(); render();
            }, () => {
                // 删除当前转盘后跳转到同组其他转盘
                const gs = AppStorage.loadGroups();
                const group = gs.find(g => g.id === currentGroupId);
                if (!group || group.wheels.length <= 1) { UI.toast('该组至少保留一个转盘', 'warn'); return; }
                AppStorage.deleteWheel(currentGroupId, currentWheelId);
                const updated = AppStorage.loadGroups();
                const updatedGroup = updated.find(g => g.id === currentGroupId);
                currentWheelId = updatedGroup?.wheels[0]?.id || currentWheelId;
                if (currentWheelId) AppStorage.saveCurrentWheel(currentWheelId);
                loadWheel(); resultIndex = -1; SpinEngine.reset(); render();
                UI.toast('转盘已删除', 'success');
            });
        };
        presetBtn.onclick = () => { if (SpinEngine.isSpinning()) { UI.toast('请等待停止', 'warn'); return; } UI.openPresetManager(AppStorage.loadGroups(), currentGroupId, currentWheelId, (gid, wid) => { currentGroupId = gid; currentWheelId = wid; AppStorage.saveCurrentGroup(gid); AppStorage.saveCurrentWheel(wid); loadWheel(); resultIndex = -1; SpinEngine.reset(); render(); }); };
        resetDrawnBtn.onclick = () => { if (!currentWheel?.drawnOptions?.length) { UI.toast('无需重置', 'info'); return; } currentWheel.drawnOptions = []; AppStorage.updateWheel(currentGroupId, currentWheelId, { drawnOptions: [] }); loadWheel(); resultIndex = -1; SpinEngine.reset(); render(); UI.toast('已重置', 'success'); };
        document.getElementById('settings-close').onclick = UI.closeSettings;
        document.getElementById('panel-backdrop').onclick = UI.closeSettings;
        document.getElementById('help-toggle').onclick = () => { const hp = document.getElementById('help-panel'); hp.classList.toggle('visible'); const s = AppStorage.loadSettings(); s.showHelp = hp.classList.contains('visible'); AppStorage.saveSettings(s); };
        window.addEventListener('resize', () => { WheelRenderer.resize(); render(); });
    }

    /* ── 指针交互 ── */
    let mouseDownPos = null;
    let wasSpinningBeforeClick = false;

    function onDown(e) {
        const c = toCanvas(e), g = WheelRenderer.getGeometry();
        mouseDownPos = c; didDrag = false;
        wasSpinningBeforeClick = SpinEngine.isSpinning();
        SpinEngine.onDragStart(c.x, c.y, g.centerX, g.centerY, WheelRenderer.hitTestCenter(c.x, c.y));
        startLoop();
    }

    function onMove(e) {
        if (!SpinEngine.isDragActive()) return;
        const c = toCanvas(e), g = WheelRenderer.getGeometry();
        didDrag = true;
        SpinEngine.onDragMove(c.x, c.y, g.centerX, g.centerY);
    }

    function onUp() {
        if (SpinEngine.isDragOnCenter()) WheelRenderer.setCenterPressed(false);
        SpinEngine.onDragEnd();

        // 旋转中点击（无拖动）：根据 clickToStop 设置决定是否停止
        if (wasSpinningBeforeClick && !didDrag) {
            wasSpinningBeforeClick = false;
            mouseDownPos = null;
            const s = AppStorage.loadSettings();
            if (s.clickToStop) {
                SpinEngine.quickStop();
                startLoop();
            }
            // clickToStop 关闭时什么都不做，旋转自然继续
            return; // 永远不触发禁用逻辑
        }

        wasSpinningBeforeClick = false;

        // 只有在【空闲状态】且【确实没有拖拽】时才允许禁用/启用分区
        if (mouseDownPos && !didDrag && SpinEngine.isIdle()) {
            const g = WheelRenderer.getGeometry();
            if (!WheelRenderer.hitTestCenter(mouseDownPos.x, mouseDownPos.y)) {
                const sm = currentWheel?.spinMode || AppStorage.loadSettings().spinMode || 'wheel';
                const si = WheelRenderer.hitTestSegment(mouseDownPos.x, mouseDownPos.y, SpinEngine.getAngle(), sm);
                if (si >= 0 && currentWheel) {
                    const seg = WheelRenderer.getSegments()[si], opt = currentWheel.options.find(o => o.id === seg.optionId);
                    if (opt) {
                        if (opt.enabled && currentWheel.options.filter(o => o.enabled).length <= 2) UI.toast('至少保留两个启用', 'warn');
                        else { opt.enabled = !opt.enabled; AppStorage.updateWheel(currentGroupId, currentWheelId, { options: currentWheel.options }); loadWheel(); render(); UI.toast(opt.enabled ? `"${opt.text}" 已启用` : `"${opt.text}" 已禁用`); }
                    }
                }
            }
        }
        mouseDownPos = null;
        reqRender();
    }

    /* ── 结果处理 ── */
    function handleResult() {
        if (!currentWheel) return;
        const allSegs = WheelRenderer.getSegments();
        const enabledSegs = allSegs.filter(s => !s.disabled);
        if (!enabledSegs.length) { resultIndex = -1; return; }

        const settings = AppStorage.loadSettings();
        const idx = SpinEngine.getResultIndex(enabledSegs);
        if (idx < 0) { resultIndex = -1; return; }

        const seg = enabledSegs[idx];

        // 如果落在已抽区域（不允许重复时），跳到下一个有效区域
        if (!settings.allowRepeat && seg.optionId && currentWheel.drawnOptions?.includes(seg.optionId)) {
            SpinEngine.snapToValid(enabledSegs, currentWheel.drawnOptions || []);
            startLoop();
            return;
        }

        // 落在禁用区域（理论上不应该，但安全兜底）
        if (seg.disabled) {
            SpinEngine.snapToValid(enabledSegs, currentWheel.drawnOptions || []);
            startLoop();
            return;
        }

        resultIndex = idx;
        resultText = enabledSegs[resultIndex].text;

        // 记录已抽取
        if (!settings.allowRepeat) {
            if (!currentWheel.drawnOptions) currentWheel.drawnOptions = [];
            if (!currentWheel.drawnOptions.includes(enabledSegs[resultIndex].optionId)) {
                currentWheel.drawnOptions.push(enabledSegs[resultIndex].optionId);
                AppStorage.updateWheel(currentGroupId, currentWheelId, { drawnOptions: currentWheel.drawnOptions });
            }
        }

        const sm = currentWheel.spinMode || settings.spinMode || 'wheel';
        updateTarget(SpinEngine.getAngle(), sm);
        updateBtn();
        WheelRenderer.draw(currentWheel, SpinEngine.getAngle(), { theme: settings.theme, spinMode: sm, resultIndex, drawnOptions: currentWheel.drawnOptions || [], textColor: settings.textColor, textStrokeEnabled: settings.textStrokeEnabled, textStrokeColor: settings.textStrokeColor, textStrokeWidth: settings.textStrokeWidth });
        if (!settings.allowRepeat) { const a = currentWheel.options.filter(o => o.enabled && !currentWheel.drawnOptions?.includes(o.id)); if (!a.length) setTimeout(() => UI.toast('🎉 全部抽完！', 'info'), 500); }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
