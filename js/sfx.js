/**
 * sfx.js — 音效引擎 v2
 * 使用 Web Audio API 程序化生成音效，无需外部音频文件
 * 功能：每经过一个分区触发 tick、多种音色、旋转摩擦底噪
 */
const SFX = (() => {
    let audioCtx = null;
    let masterGain = null;
    let volume = 0.5;
    let muted = false;

    // ── tick 状态：追踪当前指针所在的分区索引 ──
    let currentSegIndex = -1;

    // ── tick 音色定义 ──
    const TICK_PRESETS = {
        crisp:   { name: '清脆',   type: 'triangle', freqBase: 1200, freqRange: 300,  duration: 0.025, vol: 0.18 },
        soft:    { name: '柔和',   type: 'sine',     freqBase: 700,  freqRange: 200,  duration: 0.045, vol: 0.12 },
        wooden:  { name: '木质',   type: 'wooden' },
        knock:   { name: '敲击',   type: 'triangle', freqBase: 200,  freqRange: 50,   duration: 0.06,  vol: 0.15, noiseMix: true },
        click:   { name: '咔嗒',   type: 'sawtooth', freqBase: 3000, freqRange: 500,  duration: 0.008, vol: 0.08 },
        bubble:  { name: '气泡',   type: 'sine',     freqBase: 900,  freqRange: 600,  duration: 0.06,  vol: 0.10, vibrato: true },
        chime:   { name: '风铃',   type: 'sine',     freqBase: 1800, freqRange: 800,  duration: 0.08,  vol: 0.10, overtones: true },
    };
    let tickTimbre = 'crisp';

    function getCtx() {
        if (!audioCtx) {
            audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            masterGain = audioCtx.createGain();
            masterGain.connect(audioCtx.destination);
            applyVolume();
        }
        if (audioCtx.state === 'suspended') audioCtx.resume();
        return audioCtx;
    }

    function applyVolume() {
        if (masterGain) {
            masterGain.gain.setValueAtTime(muted ? 0 : volume, audioCtx.currentTime);
        }
    }

    /* ══════════════════════════════════
       tick 音效
    ══════════════════════════════════ */
    function playTickSound(volumeScale = 1.0) {
        if (muted) return;
        try {
            const ctx = getCtx();
            const preset = TICK_PRESETS[tickTimbre] || TICK_PRESETS.crisp;

            // ── 木质音色：单独处理 ──
            if (preset.type === 'wooden') {
                playWoodenTick();
                return;
            }

            const freq = preset.freqBase + (Math.random() - 0.5) * preset.freqRange;

            // 主音
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = preset.type;
            osc.frequency.setValueAtTime(freq, ctx.currentTime);
            gain.gain.setValueAtTime(preset.vol * volumeScale, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.duration);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + preset.duration + 0.01);

            // 泛音（风铃）
            if (preset.overtones) {
                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(freq * 2.0, ctx.currentTime);
                gain2.gain.setValueAtTime(preset.vol * 0.3 * volumeScale, ctx.currentTime);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.duration * 0.7);
                osc2.connect(gain2);
                gain2.connect(masterGain);
                osc2.start(ctx.currentTime);
                osc2.stop(ctx.currentTime + preset.duration * 0.7 + 0.01);
            }

            // 噪音混合（敲击）
            if (preset.noiseMix) {
                const bufLen = Math.floor(ctx.sampleRate * preset.duration);
                const buf = ctx.createBuffer(1, bufLen, ctx.sampleRate);
                const data = buf.getChannelData(0);
                for (let i = 0; i < bufLen; i++) data[i] = (Math.random() * 2 - 1) * 0.5;
                const noise = ctx.createBufferSource();
                noise.buffer = buf;
                const ng = ctx.createGain();
                ng.gain.setValueAtTime(preset.vol * 0.5 * volumeScale, ctx.currentTime);
                ng.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + preset.duration);
                const filt = ctx.createBiquadFilter();
                filt.type = 'highpass';
                filt.frequency.value = freq;
                noise.connect(filt);
                filt.connect(ng);
                ng.connect(masterGain);
                noise.start(ctx.currentTime);
                noise.stop(ctx.currentTime + preset.duration + 0.01);
            }

            // 颤音（气泡）
            if (preset.vibrato) {
                const lfo = ctx.createOscillator();
                const lfoGain = ctx.createGain();
                lfo.frequency.value = 15 + Math.random() * 10;
                lfoGain.gain.value = freq * 0.15;
                lfo.connect(lfoGain);
                lfoGain.connect(osc.frequency);
                lfo.start(ctx.currentTime);
                lfo.stop(ctx.currentTime + preset.duration + 0.01);
            }
        } catch (e) {}
    }

    /* ══════════════════════════════════
       木质音色 — 木块/木琴质感
       噪音冲击（短） + 低频正弦共振（较长衰减） + 中频泛音
    ══════════════════════════════════ */
    function playWoodenTick() {
        try {
            const ctx = getCtx();
            const now = ctx.currentTime;

            // 冲击噪声：模拟敲击瞬态（带通 800-2000Hz）
            const noiseLen = Math.floor(ctx.sampleRate * 0.008);
            const noiseBuf = ctx.createBuffer(1, noiseLen, ctx.sampleRate);
            const noiseData = noiseBuf.getChannelData(0);
            for (let i = 0; i < noiseLen; i++) noiseData[i] = (Math.random() * 2 - 1);
            const noiseSrc = ctx.createBufferSource();
            noiseSrc.buffer = noiseBuf;
            const noiseGain = ctx.createGain();
            noiseGain.gain.setValueAtTime(0.20, now);
            noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.008);
            const noiseFilt = ctx.createBiquadFilter();
            noiseFilt.type = 'bandpass';
            noiseFilt.frequency.value = 1200 + Math.random() * 600;
            noiseFilt.Q.value = 1.5;
            noiseSrc.connect(noiseFilt);
            noiseFilt.connect(noiseGain);
            noiseGain.connect(masterGain);
            noiseSrc.start(now);

            // 基频共振：木块腔体共鸣 ~350-500Hz
            const baseFreq = 350 + Math.random() * 150;
            const osc1 = ctx.createOscillator();
            const gain1 = ctx.createGain();
            osc1.type = 'sine';
            osc1.frequency.setValueAtTime(baseFreq, now);
            osc1.frequency.exponentialRampToValueAtTime(baseFreq * 0.85, now + 0.05);
            gain1.gain.setValueAtTime(0.16, now);
            gain1.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
            osc1.connect(gain1);
            gain1.connect(masterGain);
            osc1.start(now);
            osc1.stop(now + 0.07);

            // 二次泛音：增加木质感 ~900-1200Hz
            const osc2 = ctx.createOscillator();
            const gain2 = ctx.createGain();
            osc2.type = 'sine';
            osc2.frequency.setValueAtTime(baseFreq * 2.5, now);
            osc2.frequency.exponentialRampToValueAtTime(baseFreq * 2.2, now + 0.03);
            gain2.gain.setValueAtTime(0.06, now);
            gain2.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
            osc2.connect(gain2);
            gain2.connect(masterGain);
            osc2.start(now);
            osc2.stop(now + 0.04);
        } catch (e) {}
    }

    /* ══════════════════════════════════
       分区边界检测 — 每经过一个分区触发一次
    ══════════════════════════════════ */
    function checkTick(angle, segments, volumeScale = 1.0) {
        if (muted || !segments || !segments.length) return;

        // 归一化角度到 [0, 2π)
        const normAngle = ((angle % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);
        // 指针位置 = -angle 归一化
        const pointerAngle = ((Math.PI * 2 - normAngle) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);

        // 找到指针当前所在的分区
        let newSegIndex = -1;
        for (let i = 0; i < segments.length; i++) {
            let s = segments[i].startAngle % (Math.PI * 2);
            let e = segments[i].endAngle % (Math.PI * 2);
            if (s < 0) s += Math.PI * 2;
            if (e < 0) e += Math.PI * 2;
            if (s < e) {
                if (pointerAngle >= s && pointerAngle < e) { newSegIndex = i; break; }
            } else {
                if (pointerAngle >= s || pointerAngle < e) { newSegIndex = i; break; }
            }
        }

        // 分区变化时触发
        if (newSegIndex !== -1 && newSegIndex !== currentSegIndex) {
            currentSegIndex = newSegIndex;
            playTickSound(volumeScale);
        }
    }

    function resetTickState() {
        currentSegIndex = -1;
    }

    /* ══════════════════════════════════
       其他音效
    ══════════════════════════════════ */
    function playSpinStart() {
        if (muted) return;
        try {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(300, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(600, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.25, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.3);
        } catch (e) {}
    }

    function playResult() {
        if (muted) return;
        try {
            const ctx = getCtx();
            const notes = [523.25, 659.25, 783.99, 1046.50];
            notes.forEach((freq, i) => {
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.type = 'sine';
                const t = ctx.currentTime + i * 0.12;
                osc.frequency.setValueAtTime(freq, t);
                gain.gain.setValueAtTime(0.2, t);
                gain.gain.exponentialRampToValueAtTime(0.001, t + 0.4);
                osc.connect(gain);
                gain.connect(masterGain);
                osc.start(t);
                osc.stop(t + 0.45);
            });
        } catch (e) {}
    }

    function playQuickStop() {
        if (muted) return;
        try {
            const ctx = getCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(500, ctx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(200, ctx.currentTime + 0.15);
            gain.gain.setValueAtTime(0.2, ctx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2);
            osc.connect(gain);
            gain.connect(masterGain);
            osc.start(ctx.currentTime);
            osc.stop(ctx.currentTime + 0.25);
        } catch (e) {}
    }

    /* ══════════════════════════════════
       设置
    ══════════════════════════════════ */
    function setVolume(v) {
        volume = Math.max(0, Math.min(1, v));
        applyVolume();
    }
    function getVolume() { return volume; }
    function setMuted(m) {
        muted = !!m;
        applyVolume();
    }
    function isMuted() { return muted; }
    function setTickTimbre(t) { tickTimbre = t || 'crisp'; }
    function getTickTimbre() { return tickTimbre; }
    function getTickPresets() { return TICK_PRESETS; }

    function loadFromSettings() {
        const s = AppStorage.loadSettings();
        volume = s.sfxVolume !== undefined ? s.sfxVolume : 0.5;
        muted = s.sfxMuted !== undefined ? s.sfxMuted : false;
        tickTimbre = s.sfxTickTimbre || 'crisp';
        applyVolume();
    }

    return {
        playSpinStart, playResult, playQuickStop,
        checkTick, resetTickState, previewTick: () => playTickSound(1.0),
        setVolume, getVolume, setMuted, isMuted,
        setTickTimbre, getTickTimbre, getTickPresets,
        loadFromSettings,
    };
})();
