/**
 * wheel-renderer.js — Canvas 转盘渲染器 v3
 * 修复：禁用分区灰显+删除线、文字不翻转、指针模式、中心圆
 */
const WheelRenderer = (() => {
    let canvas, ctx, dpr = 1, size = 0;
    let cx = 0, cy = 0, R = 0;
    let cachedSegments = [];
    let centerHovered = false, centerPressed = false;

    function init(c) { canvas = c; ctx = canvas.getContext('2d'); dpr = window.devicePixelRatio || 1; resize(); }
    function resize() {
        if (!canvas) return;
        const w = canvas.parentElement;
        size = Math.min(w.clientWidth, w.clientHeight);
        canvas.width = size * dpr; canvas.height = size * dpr;
        canvas.style.width = size + 'px'; canvas.style.height = size + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cx = size / 2; cy = size / 2; R = size * 0.42;
    }

    /* ── 分段（包含禁用选项） ── */
    function computeSegments(options) {
        if (!options.length) { cachedSegments = []; return []; }
        const totalW = options.reduce((s, o) => s + o.weight, 0) || 1;
        const minA = 12 * Math.PI / 180; // 固定最小 12°，保证权重差异可见
        let arr = options.map(o => ({ ...o, rawAngle: (o.weight / totalW) * 2 * Math.PI, disabled: !o.enabled }));
        let fix = arr.some(a => a.rawAngle < minA), iter = 0;
        while (fix && iter < 30) {
            const small = arr.filter(a => a.rawAngle < minA);
            const deficit = small.reduce((s, a) => s + (minA - a.rawAngle), 0);
            const big = arr.filter(a => a.rawAngle > minA);
            const bigSurplus = big.reduce((s, a) => s + (a.rawAngle - minA), 0);
            if (bigSurplus <= 0) break; // 无法再调整，保留当前角度
            const take = Math.min(deficit, bigSurplus);
            arr.forEach(a => {
                if (a.rawAngle < minA) a.rawAngle = minA;
                else a.rawAngle -= ((a.rawAngle - minA) / bigSurplus) * take;
            });
            const sum = arr.reduce((s, a) => s + a.rawAngle, 0);
            arr.forEach(a => a.rawAngle = (a.rawAngle / sum) * 2 * Math.PI);
            fix = arr.some(a => a.rawAngle < minA * 0.99); iter++;
        }
        let cur = 0;
        cachedSegments = arr.map(opt => {
            const seg = { optionId: opt.id, text: opt.text, customColor: opt.customColor, disabled: opt.disabled, startAngle: cur, endAngle: cur + opt.rawAngle };
            cur += opt.rawAngle; return seg;
        });
        return cachedSegments;
    }

    /* ── 颜色 ── */
    function hexToHSL(hex) {
        let r = parseInt(hex.slice(1, 3), 16) / 255, g = parseInt(hex.slice(3, 5), 16) / 255, b = parseInt(hex.slice(5, 7), 16) / 255;
        const mx = Math.max(r, g, b), mn = Math.min(r, g, b);
        let h, s, l = (mx + mn) / 2;
        if (mx === mn) { h = s = 0; } else {
            const d = mx - mn; s = l > 0.5 ? d / (2 - mx - mn) : d / (mx + mn);
            switch (mx) { case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break; case g: h = ((b - r) / d + 2) / 6; break; case b: h = ((r - g) / d + 4) / 6; break; }
        }
        return [h * 360, s * 100, l * 100];
    }
    function hslToHex(h, s, l) {
        s /= 100; l /= 100; const a = s * Math.min(l, 1 - l);
        const f = n => { const k = (n + h / 30) % 12; const c = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1); return Math.round(255 * c).toString(16).padStart(2, '0'); };
        return `#${f(0)}${f(8)}${f(4)}`;
    }
    function darkenColor(hex, amt) { try { const [h, s, l] = hexToHSL(hex); return hslToHex(h, s * (1 - amt), l * (1 - amt)); } catch { return hex; } }
    function desaturateColor(hex, amt) { try { const [h, s, l] = hexToHSL(hex); return hslToHex(h, s * (1 - amt), l); } catch { return hex; } }
    function grayColor(hex) { try { const [h, , l] = hexToHSL(hex); return hslToHex(h, 0, Math.max(40, Math.min(l, 60))); } catch { return '#999999'; } }

    function getSegmentColor(i, total, schemeId, theme, custom) {
        if (custom) return custom;
        const scheme = AppStorage.COLOR_SCHEMES[schemeId] || AppStorage.COLOR_SCHEMES.classic;
        return theme === 'dark' ? darkenColor(scheme.colors[i % scheme.colors.length], 0.15) : scheme.colors[i % scheme.colors.length];
    }

    /* ── 中心圆状态 ── */
    function setCenterHover(h) { centerHovered = h; }
    function setCenterPressed(p) { centerPressed = p; }

    /* ═══ 主绘制 ═══ */
    function draw(wheel, rotation, options = {}) {
        if (!ctx) return;
        const { theme = AppTheme.get(), spinMode = wheel?.spinMode || 'wheel', resultIndex = -1, drawnOptions = [],
                textColor, textStrokeEnabled, textStrokeColor, textStrokeWidth } = options;

        ctx.clearRect(0, 0, size, size);
        if (!wheel?.options?.length) { drawEmpty(); return; }

        const segments = computeSegments(wheel.options);
        if (!segments.length) { drawEmpty(); return; }

        // 指针模式：分区不旋转；普通模式：分区旋转
        const segRotation = spinMode === 'pointer' ? 0 : rotation;
        const n = segments.length;

        // 外圈阴影+边框
        ctx.save(); ctx.beginPath(); ctx.arc(cx, cy, R + 4, 0, Math.PI * 2);
        ctx.shadowColor = 'rgba(0,0,0,0.2)'; ctx.shadowBlur = 18; ctx.fillStyle = 'transparent'; ctx.fill(); ctx.restore();
        ctx.beginPath(); ctx.arc(cx, cy, R + 5, 0, Math.PI * 2);
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.08)' : 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 3; ctx.stroke();

        // 各分区
        for (let i = 0; i < n; i++) {
            drawSegment(segments[i], i, n, segRotation, theme, wheel.colorSchemeId, resultIndex, drawnOptions, segments[i]);
        }

        // 中心圆
        drawCenterCircle(theme);

        // 指针（最上层）
        drawPointer(rotation, spinMode, theme);
    }

    function drawSegment(seg, index, total, rotation, theme, schemeId, resultIndex, drawnOptions, segmentForText) {
        const cs = rotation - Math.PI / 2;
        const cStart = seg.startAngle + cs, cEnd = seg.endAngle + cs;
        const midA = (seg.startAngle + seg.endAngle) / 2 + cs;
        const isResult = resultIndex === index;
        const isDrawn = drawnOptions?.includes(seg.optionId);
        const isDisabled = seg.disabled;

        let color = getSegmentColor(index, total, schemeId, theme, seg.customColor);

        // 禁用：变灰
        if (isDisabled) color = grayColor(color);

        // 结果高亮：非选中降低饱和度
        if (resultIndex >= 0 && !isResult) color = desaturateColor(color, 0.75);

        // 绘制扇形
        ctx.save(); ctx.beginPath(); ctx.moveTo(cx, cy);
        ctx.arc(cx, cy, R, cStart, cEnd); ctx.closePath();
        ctx.fillStyle = color; ctx.fill();
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.06)';
        ctx.lineWidth = 1.5; ctx.stroke();

        // 已抽取覆盖
        if (isDrawn && !isDisabled) { ctx.fillStyle = theme === 'dark' ? 'rgba(0,0,0,0.4)' : 'rgba(255,255,255,0.4)'; ctx.fill(); }

        // 结果发光
        if (isResult) {
            ctx.save(); ctx.shadowColor = color; ctx.shadowBlur = 18;
            ctx.beginPath(); ctx.moveTo(cx, cy); ctx.arc(cx, cy, R, cStart, cEnd); ctx.closePath();
            ctx.fillStyle = color; ctx.fill(); ctx.restore();
        }
        ctx.restore();

        // 文字（不翻转，始终从中心向边缘）—— 直接传入 segment，避免旋转依赖的查找
        drawText(seg.text, midA, isResult, isDrawn, isDisabled, theme, segmentForText);
    }

    /* ── 文本截断（二分查找，O(log n) 次测量） ── */
    function truncateToWidth(text, maxWidth, addEllipsis) {
        if (!text || text.length === 0) return text;
        if (ctx.measureText(text).width <= maxWidth) return text;
        const suffix = addEllipsis ? '…' : '';
        const targetW = maxWidth - ctx.measureText(suffix).width;
        if (targetW <= 0) return suffix;
        let lo = 1, hi = text.length;
        while (lo < hi) {
            const mid = Math.ceil((lo + hi) / 2);
            if (ctx.measureText(text.slice(0, mid)).width <= targetW) lo = mid;
            else hi = mid - 1;
        }
        const truncated = text.slice(0, lo);
        return (truncated === text) ? text : truncated + suffix;
    }

    function drawText(text, midCanvasAngle, isResult, isDrawn, isDisabled, theme, segment) {
        // 防御性检查：确保 text 是有效字符串
        if (typeof text !== 'string') text = String(text || '');

        const settings = AppStorage.loadSettings();
        let textColor = settings.textColor || (theme === 'dark' ? '#e0e0e0' : '#ffffff');

        if (isDisabled || isDrawn) {
            textColor = theme === 'dark' ? 'rgba(180,180,180,0.6)' : 'rgba(100,100,100,0.6)';
        }

        const baseFontSize = Math.max(11, Math.min(18, R * 0.07));
        const fontSize = baseFontSize;

        // ── 计算扇形弧宽（直接使用传入的 segment，不依赖旋转角度查找） ──
        const segArc = segment ? (segment.endAngle - segment.startAngle) : Math.PI / 4;

        const textXBase = R * 0.55;
        const arcAtTextPos = textXBase;
        const arcWidth = Math.max(10, segArc * arcAtTextPos);

        const canWrap = arcWidth > fontSize * 2.5;
        const maxSingleLineWidth = Math.max(10, Math.min(R * 0.48, arcWidth * 0.85));

        // ── 处理手动换行 ──
        const rawLines = text.split('\n').filter(l => true); // 确保数组

        // ── 自动换行逻辑 ──
        ctx.save();
        try {
            ctx.font = `bold ${fontSize}px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif`;

            let lines = [];
            if (rawLines.length === 1 && !canWrap) {
                lines = [truncateToWidth(rawLines[0], maxSingleLineWidth, true)];
            } else if (rawLines.length === 1 && canWrap) {
                const wrapWidth = Math.max(10, Math.min(maxSingleLineWidth, arcWidth * 0.8));
                // 二分查找第一行能放多少字符
                let lo = 0, hi = rawLines[0].length;
                while (lo < hi) {
                    const mid = Math.ceil((lo + hi) / 2);
                    if (ctx.measureText(rawLines[0].slice(0, mid)).width <= wrapWidth) lo = mid;
                    else hi = mid - 1;
                }
                lines.push(rawLines[0].slice(0, lo));
                if (lo < rawLines[0].length) {
                    lines.push(truncateToWidth(rawLines[0].slice(lo), wrapWidth, true));
                }
            } else {
                for (let i = 0; i < Math.min(rawLines.length, 2); i++) {
                    let line = String(rawLines[i] || '');
                    const lineMaxW = Math.max(10, (rawLines.length <= 2 || !canWrap) ? maxSingleLineWidth : Math.min(maxSingleLineWidth, arcWidth * 0.8));
                    lines.push(truncateToWidth(line, lineMaxW, line.length > 0));
                }
            }

            lines = lines.slice(0, 2);

            const totalTextLen = lines.join('').length;
            const longTextThreshold = 8;
            let textX;
            if (totalTextLen > longTextThreshold) {
                const shift = Math.min(R * 0.15, (totalTextLen - longTextThreshold) * R * 0.015);
                textX = textXBase - shift;
            } else {
                textX = textXBase;
            }

            ctx.translate(cx, cy);
            ctx.rotate(midCanvasAngle);
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';

            const lineHeight = fontSize * 1.25;
            const totalHeight = lines.length * lineHeight;
            const startY = -(totalHeight - lineHeight) / 2;

            const strokeOn = settings.textStrokeEnabled !== false;
            const strokeColor = settings.textStrokeColor || '#000000';
            const strokeWidth = Math.max(0.5, Math.min(5, settings.textStrokeWidth || 2));

            lines.forEach((line, idx) => {
                const y = startY + idx * lineHeight;
                if (strokeOn) {
                    ctx.strokeStyle = strokeColor;
                    ctx.lineWidth = strokeWidth;
                    ctx.lineJoin = 'round';
                    ctx.strokeText(line, textX, y);
                }
                ctx.fillStyle = textColor;
                ctx.fillText(line, textX, y);
            });

            if (isDisabled || isDrawn) {
                const widths = lines.map(l => { try { return ctx.measureText(l).width; } catch(e) { return 0; } });
                const tw = Math.max(0, ...widths);
                ctx.beginPath();
                ctx.strokeStyle = textColor;
                ctx.lineWidth = 1.5;
                ctx.lineCap = 'round';
                ctx.moveTo(textX, startY);
                ctx.lineTo(textX + tw, startY);
                ctx.stroke();
            }
        } finally {
            ctx.restore();
        }
    }

    /* ── 指针 ── */
    function drawPointer(rotation, spinMode, theme) {
        let pointerAngle;
        if (spinMode === 'pointer') {
            // 指针模式：指针绕转盘旋转
            pointerAngle = rotation - Math.PI / 2;
        } else {
            // 转盘模式：指针固定在顶部
            pointerAngle = 0;
        }

        const pw = R * 0.06, ph = R * 0.12;

        ctx.save();
        ctx.translate(cx, cy);
        ctx.rotate(pointerAngle);

        // 等腰三角形，尖端指向圆心
        ctx.beginPath();
        ctx.moveTo(0, -(R + 2));
        ctx.lineTo(-pw, -(R + ph));
        ctx.lineTo(pw, -(R + ph));
        ctx.closePath();

        const pc = theme === 'dark' ? '#4cc9f0' : '#e63946';
        ctx.fillStyle = pc;
        ctx.shadowColor = 'rgba(0,0,0,0.3)'; ctx.shadowBlur = 8;
        ctx.fill(); ctx.shadowBlur = 0;

        ctx.restore();
    }

    /* ── 中心圆 ── */
    function drawCenterCircle(theme) {
        const baseR = R * 0.12;
        let r = baseR;
        if (centerHovered) r *= 1.08;
        if (centerPressed) r *= 0.95;

        ctx.save();
        if (centerHovered || centerPressed) {
            ctx.shadowColor = centerPressed ? 'rgba(0,0,0,0.4)' : 'rgba(0,0,0,0.25)';
            ctx.shadowBlur = centerPressed ? 6 : 12;
            ctx.shadowOffsetY = centerPressed ? 2 : 4;
        } else {
            ctx.shadowColor = 'rgba(0,0,0,0.15)'; ctx.shadowBlur = 6; ctx.shadowOffsetY = 2;
        }

        const grad = ctx.createRadialGradient(cx - r * 0.3, cy - r * 0.3, 0, cx, cy, r);
        if (theme === 'dark') {
            grad.addColorStop(0, centerHovered ? '#3a3a5e' : '#2e2e48');
            grad.addColorStop(1, centerPressed ? '#1a1a30' : '#22223a');
        } else {
            grad.addColorStop(0, centerHovered ? '#ffffff' : '#f8f8fa');
            grad.addColorStop(1, centerPressed ? '#d8d8e0' : '#e8e8ec');
        }
        ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.fillStyle = grad; ctx.fill();
        ctx.strokeStyle = theme === 'dark' ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)';
        ctx.lineWidth = 1.5; ctx.stroke();

        const st = SpinEngine.getState();
        let icon = '▶';
        if (st === SpinEngine.STATE.SPINNING || st === SpinEngine.STATE.STOPPING) icon = '⏹';
        else if (st === SpinEngine.STATE.RESULT) icon = '↺';
        ctx.font = `${r * 0.7}px sans-serif`;
        ctx.fillStyle = theme === 'dark' ? 'rgba(255,255,255,0.7)' : 'rgba(0,0,0,0.45)';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(icon, cx, cy + 1);
        ctx.restore();
    }

    function drawEmpty() {
        ctx.beginPath(); ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(128,128,128,0.12)'; ctx.fill();
        ctx.strokeStyle = 'rgba(128,128,128,0.25)'; ctx.lineWidth = 2;
        ctx.setLineDash([10, 5]); ctx.stroke(); ctx.setLineDash([]);
        ctx.font = '18px -apple-system, "PingFang SC", "Microsoft YaHei", sans-serif';
        ctx.fillStyle = 'rgba(128,128,128,0.45)'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('请添加选项', cx, cy);
    }

    /* ── 碰撞检测 ── */
    function hitTestSegment(x, y, rotation, spinMode) {
        const dx = x - cx, dy = y - cy, dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < R * 0.15 || dist > R + 15) return -1;
        const segRot = spinMode === 'pointer' ? 0 : rotation;
        let clickA = Math.atan2(dy, dx) + Math.PI / 2 - segRot;
        clickA = ((clickA % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        for (let i = 0; i < cachedSegments.length; i++) {
            const s = cachedSegments[i];
            let sa = s.startAngle % (Math.PI * 2), ea = s.endAngle % (Math.PI * 2);
            if (sa < 0) sa += Math.PI * 2; if (ea < 0) ea += Math.PI * 2;
            if (sa < ea) { if (clickA >= sa && clickA < ea) return i; }
            else { if (clickA >= sa || clickA < ea) return i; }
        }
        return -1;
    }

    function hitTestCenter(x, y) {
        const dx = x - cx, dy = y - cy;
        return Math.sqrt(dx * dx + dy * dy) <= R * 0.15;
    }

    function getGeometry() { return { centerX: cx, centerY: cy, radius: R, size }; }
    function getSegments() { return cachedSegments; }
    function getCanvasCoords(e) {
        const r = canvas.getBoundingClientRect();
        return { x: (e.clientX || 0) - r.left, y: (e.clientY || 0) - r.top };
    }
    function getCanvasCoordsFromTouch(t) {
        const r = canvas.getBoundingClientRect();
        return { x: (t.clientX || 0) - r.left, y: (t.clientY || 0) - r.top };
    }

    return {
        init, resize, draw,
        hitTestSegment, hitTestCenter,
        getGeometry, getSegments, getCanvasCoords, getCanvasCoordsFromTouch,
        computeSegments, setCenterHover, setCenterPressed,
        darkenColor, desaturateColor, grayColor, hexToHSL, hslToHex,
    };
})();
