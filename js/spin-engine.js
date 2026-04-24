/**
 * spin-engine.js — 旋转物理引擎 v4
 * 修复：跳过禁用/已抽区域、按钮动画、手动拖拽物理、减速曲线生效
 */
const SpinEngine = (() => {
    const STATE = { IDLE: 'idle', DRAGGING: 'dragging', SPINNING: 'spinning', STOPPING: 'stopping', RESULT: 'result' };
    const STOP_VEL = 0.015;
    const DRAG_THRESHOLD = 1.8;

    let state = STATE.IDLE, angle = 0, velocity = 0, lastTime = 0, animId = null;

    // 旋转模式：统一使用缓动曲线
    let spinType = 'button';
    let btnDuration = 4, btnV0 = 0, btnElapsed = 0;
    let spinDirection = 1; // 1=顺时针, -1=逆时针

    let config = { buttonSpinDuration: 4, decelerationPreset: 'normal', clickToStop: true, skipDelay: 500 };

    let drag = { active: false, onCenter: false, lastAngle: 0, velHistory: [], longTimer: null, isLong: false, moved: false };
    let _onTick, _onState, _onResult, _onSpinStart, _onCenterLong;

    function set(s) { const o = state; state = s; if (_onState) _onState(s, o); }
    function gf(p) { return AppStorage.DECELERATION_MAP[p] || 0.984; }
    function norm(a) { return ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2); }

    /* ═══ 按钮旋转（缓动曲线）═══ */
    function spin(options = {}) {
        if (state === STATE.SPINNING || state === STATE.STOPPING) cancelAnimationFrame(animId);

        btnDuration = options.duration || config.buttonSpinDuration;
        btnV0 = 25 * (0.9 + Math.random() * 0.2);
        btnElapsed = 0;
        velocity = btnV0;
        spinType = 'button';
        spinDirection = 1;
        drag.active = false;
        set(STATE.SPINNING);
        if (_onSpinStart) _onSpinStart();
        lastTime = performance.now();
        loop(lastTime);
    }

    /* ═══ 拖拽旋转（使用和按钮相同的缓动曲线）═══ */
    function spinFromDrag(dragVel) {
        const absVel = Math.abs(dragVel);
        spinType = 'button';
        spinDirection = dragVel >= 0 ? 1 : -1;
        // 时长与速度成正比：拖得越快转越久
        const refV0 = 25;
        btnDuration = Math.max(0.4, config.buttonSpinDuration * (absVel / refV0));
        btnV0 = absVel;
        btnElapsed = 0;
        set(STATE.SPINNING);
        if (_onSpinStart) _onSpinStart();
        lastTime = performance.now();
        loop(lastTime);
    }

    function stop() { if (state === STATE.SPINNING) set(STATE.STOPPING); }
    function quickStop() {
        if (state === STATE.IDLE || state === STATE.RESULT) return;
        cancelAnimationFrame(animId); set(STATE.RESULT);
        if (_onResult) _onResult(angle); if (_onTick) _onTick(angle, state);
    }

    /** 跳到随机结果 */
    function skipToResult(segments) {
        if (state !== STATE.SPINNING && state !== STATE.STOPPING) return;
        if (!segments?.length) return;
        cancelAnimationFrame(animId); set(STATE.STOPPING);
        const idx = Math.floor(Math.random() * segments.length);
        const mid = (segments[idx].startAngle + segments[idx].endAngle) / 2;
        let target = -mid; target = norm(target);
        while (target < angle + Math.PI * 4) target += Math.PI * 2;
        const sA = angle, dA = target - sA, sT = performance.now();
        function sl(ts) {
            const t = Math.min((ts - sT) / 800, 1), e = 1 - Math.pow(1 - t, 3);
            angle = norm(sA + dA * e);
            if (_onTick) _onTick(angle, state);
            if (t < 1) animId = requestAnimationFrame(sl);
            else { angle = norm(target); set(STATE.RESULT); if (_onResult) _onResult(angle); if (_onTick) _onTick(angle, state); }
        }
        animId = requestAnimationFrame(sl);
    }

    /** 跳过禁用/已抽区域，停在下一个有效区域 */
    function snapToValid(segments, drawnIds) {
        if (!segments?.length) return;
        cancelAnimationFrame(animId); set(STATE.STOPPING);
        const pl = norm(-angle);
        // 找到当前指针所指的下一个有效分区（顺时针方向最近的）
        let bestDist = Infinity, bestMid = 0;
        for (const seg of segments) {
            if (seg.disabled || drawnIds?.includes(seg.optionId)) continue;
            const mid = (seg.startAngle + seg.endAngle) / 2;
            let d = mid - pl; if (d < 0) d += Math.PI * 2;
            if (d > 0 && d < bestDist) { bestDist = d; bestMid = mid; }
        }
        if (bestDist === Infinity) { set(STATE.RESULT); if (_onResult) _onResult(angle); return; }

        let target = norm(-bestMid);
        // 确保只前进一小段
        while (target < angle) target += Math.PI * 2;
        // 至少前进一点（超过当前角度一点点）
        while (target < angle + Math.PI * 0.5) target += Math.PI * 2;

        const sA = angle, dA = target - sA, sT = performance.now(), dur = 500;
        function sl(ts) {
            const t = Math.min((ts - sT) / dur, 1), e = 1 - Math.pow(1 - t, 2);
            angle = norm(sA + dA * e);
            if (_onTick) _onTick(angle, state);
            if (t < 1) animId = requestAnimationFrame(sl);
            else { angle = norm(target); set(STATE.RESULT); if (_onResult) _onResult(angle); if (_onTick) _onTick(angle, state); }
        }
        animId = requestAnimationFrame(sl);
    }

    function reset() { cancelAnimationFrame(animId); state = STATE.IDLE; angle = 0; velocity = 0; clearDrag(); }
    function idle() { cancelAnimationFrame(animId); set(STATE.IDLE); velocity = 0; if (_onTick) _onTick(angle, state); }

    /* ═══ 动画循环 ═══ */
    function loop(ts) {
        const dt = Math.min((ts - lastTime) / 1000, 0.05);
        lastTime = ts;

        if (state === STATE.SPINNING || state === STATE.STOPPING) {
            // 统一使用二次缓动曲线
            btnElapsed += dt;
            const t = Math.min(btnElapsed / btnDuration, 1);
            velocity = btnV0 * Math.max(0, 1 - t * t);

            angle += velocity * dt * spinDirection;
            angle = norm(angle);

            if (velocity < STOP_VEL) {
                velocity = 0; set(STATE.RESULT);
                if (_onTick) _onTick(angle, state);
                if (_onResult) _onResult(angle);
                return; // 停止后不再调度下一帧，防止 snapToValid 改状态后重复触发
            }
        }
        if (_onTick) _onTick(angle, state);
        if (state === STATE.SPINNING || state === STATE.STOPPING) animId = requestAnimationFrame(loop);
    }

    /* ═══ 拖拽 ═══ */
    function clearDrag() { if (drag.longTimer) clearTimeout(drag.longTimer); drag = { active: false, onCenter: false, lastAngle: 0, velHistory: [], longTimer: null, isLong: false, moved: false, wasSpinning: false }; }

    function onDragStart(cx, cy, geoX, geoY, onCenter) {
        const dx = cx - geoX, dy = cy - geoY, dist = Math.sqrt(dx * dx + dy * dy);
        drag.onCenter = onCenter; drag.moved = false; drag.wasSpinning = false;
        if (onCenter) {
            drag.active = true; drag.isLong = false;
            drag.longTimer = setTimeout(() => { drag.isLong = true; if (_onCenterLong) _onCenterLong(); }, config.skipDelay);
            return;
        }
        if (dist < 20) return;
        drag.active = true; drag.lastAngle = Math.atan2(dy, dx);
        drag.velHistory = [{ angle: drag.lastAngle, time: performance.now() }]; drag.isLong = false;
        if (state === STATE.SPINNING || state === STATE.STOPPING) {
            drag.wasSpinning = true; // 记录旋转状态，等真正拖动时再取消
        } else {
            if (state !== STATE.DRAGGING) set(STATE.DRAGGING);
        }
        lastTime = performance.now();
    }

    function onDragMove(cx, cy, geoX, geoY) {
        if (!drag.active || drag.onCenter) { if (drag.onCenter) drag.moved = true; return; }
        const dx = cx - geoX, dy = cy - geoY, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 15) return;
        drag.moved = true;
        // 旋转中真正开始拖动：取消旋转，切换到拖拽模式
        if (drag.wasSpinning) {
            drag.wasSpinning = false;
            cancelAnimationFrame(animId); velocity = 0;
            if (state !== STATE.DRAGGING) set(STATE.DRAGGING);
        }
        const curA = Math.atan2(dy, dx);
        let delta = curA - drag.lastAngle;
        if (delta > Math.PI) delta -= Math.PI * 2;
        if (delta < -Math.PI) delta += Math.PI * 2;
        angle = norm(angle + delta);
        drag.lastAngle = curA;
        const now = performance.now();
        drag.velHistory.push({ angle: delta, time: now });
        drag.velHistory = drag.velHistory.filter(h => h.time >= now - 120);
        if (_onTick) _onTick(angle, state);
    }

    function onDragEnd() {
        if (!drag.active) return;
        if (drag.longTimer) clearTimeout(drag.longTimer);

        if (drag.onCenter) {
            if (!drag.isLong && !drag.moved) {
                if (state === STATE.SPINNING || state === STATE.STOPPING) {
                    quickStop();
                } else {
                    spin();
                }
            }
            drag.active = false; drag.onCenter = false; drag.isLong = false; drag.wasSpinning = false;
            return;
        }

        // 旋转中点击（无实际拖动）：不改变状态，让 app.js 处理
        if (drag.wasSpinning && !drag.moved) {
            drag.active = false; drag.onCenter = false; drag.isLong = false; drag.wasSpinning = false;
            return;
        }

        drag.wasSpinning = false;

        if (state === STATE.DRAGGING) {
            const hist = drag.velHistory;
            if (hist.length >= 2) {
                const totalD = hist.reduce((s, h) => s + h.angle, 0);
                const totalT = (hist[hist.length - 1].time - hist[0].time) / 1000;
                if (totalT > 0.01 && Math.abs(totalD / totalT) > DRAG_THRESHOLD) {
                    spinFromDrag(totalD / totalT);
                } else { set(STATE.IDLE); }
            } else { set(STATE.IDLE); }
        }
        drag.active = false; drag.onCenter = false; drag.isLong = false;
    }

    function setConfig(p) { Object.assign(config, p); }
    function getConfig() { return { ...config }; }
    function getAngle() { return angle; }
    function setAngle(a) { angle = norm(a); }
    function getState() { return state; }
    function isIdle() { return state === STATE.IDLE; }
    function isSpinning() { return state === STATE.SPINNING || state === STATE.STOPPING; }
    function isResult() { return state === STATE.RESULT; }
    function isDragging() { return state === STATE.DRAGGING; }
    function isDragActive() { return drag.active; }
    function isDragOnCenter() { return drag.onCenter; }
    function getVelocity() { return velocity; }

    function getResultIndex(segments) {
        const pl = norm(-angle);
        for (let i = 0; i < segments.length; i++) {
            let s = segments[i].startAngle % (Math.PI * 2), e = segments[i].endAngle % (Math.PI * 2);
            if (s < 0) s += Math.PI * 2; if (e < 0) e += Math.PI * 2;
            if (s < e) { if (pl >= s && pl < e) return i; }
            else { if (pl >= s || pl < e) return i; }
        }
        return -1;
    }

    return {
        STATE, spin, spinFromDrag, stop, quickStop, skipToResult, snapToValid, reset, idle,
        onDragStart, onDragMove, onDragEnd,
        setConfig, getConfig, getAngle, setAngle, getState, getVelocity,
        isIdle, isSpinning, isResult, isDragging, isDragActive, isDragOnCenter,
        getResultIndex,
        set onTick(fn) { _onTick = fn; },
        set onStateChange(fn) { _onState = fn; },
        set onResult(fn) { _onResult = fn; },
        set onSpinStart(fn) { _onSpinStart = fn; },
        set onCenterLongPress(fn) { _onCenterLong = fn; },
    };
})();
