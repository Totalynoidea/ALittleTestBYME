/**
 * ui.js — UI 组件 v2
 * 设置面板（关闭自动保存）、转盘编辑器、嵌套预设管理、Toast
 */
const UI = (() => {
    let activeModal = null;
    const clampWeight = v => Math.max(1, Math.min(100, Math.round(v)));

    function toast(msg, type = 'info', dur = 2500) {
        const c = document.getElementById('toast-container');
        const el = document.createElement('div');
        el.className = `toast toast-${type}`; el.textContent = msg;
        c.appendChild(el);
        requestAnimationFrame(() => el.classList.add('show'));
        setTimeout(() => { el.classList.remove('show'); setTimeout(() => el.remove(), 300); }, dur);
    }

    /* ══════════════════════════════════════════
       设置面板（关闭自动保存）
    ══════════════════════════════════════════ */
    function openSettings(onChange) {
        const settings = AppStorage.loadSettings();
        const panel = document.getElementById('settings-panel');

        panel.querySelector('#set-duration').value = settings.defaultSpinDuration;
        panel.querySelector('#set-text-color').value = settings.textColor;
        panel.querySelector('#set-reset-text-color').checked = settings.resetTextColorOnThemeChange;
        panel.querySelector('#set-spin-mode').value = settings.spinMode;
        panel.querySelector('#set-allow-repeat').checked = settings.allowRepeat;
        panel.querySelector('#set-click-stop').checked = settings.clickToStop;
        panel.querySelector('#set-speed-curve').value = settings.decelerationPreset;
        panel.querySelector('#set-stroke-enabled').checked = settings.textStrokeEnabled !== false;
        panel.querySelector('#set-stroke-color').value = settings.textStrokeColor || '#000000';
        panel.querySelector('#set-stroke-width').value = settings.textStrokeWidth || 2;
        panel.querySelector('#stroke-width-val').textContent = settings.textStrokeWidth || 2;
        panel.querySelector('#set-show-help').checked = settings.showHelp !== false;
        panel.querySelector('#set-sfx-muted').checked = settings.sfxMuted || false;
        panel.querySelector('#set-sfx-volume').value = settings.sfxVolume !== undefined ? settings.sfxVolume : 0.5;
        panel.querySelector('#sfx-volume-val').textContent = Math.round((settings.sfxVolume !== undefined ? settings.sfxVolume : 0.5) * 100) + '%';

        // tick 音色下拉
        const timbreSel = panel.querySelector('#set-sfx-tick-timbre');
        timbreSel.innerHTML = '';
        const presets = SFX.getTickPresets();
        Object.entries(presets).forEach(([id, p]) => {
            const o = document.createElement('option');
            o.value = id;
            o.textContent = p.name;
            if (id === (settings.sfxTickTimbre || 'crisp')) o.selected = true;
            timbreSel.appendChild(o);
        });

        // 试听按钮
        panel.querySelector('#sfx-preview-tick').onclick = () => {
            SFX.setTickTimbre(timbreSel.value);
            SFX.previewTick();
        };

        // 音量实时显示
        panel.querySelector('#set-sfx-volume').oninput = e => {
            panel.querySelector('#sfx-volume-val').textContent = Math.round(e.target.value * 100) + '%';
        };

        // 描边宽度实时显示
        panel.querySelector('#set-stroke-width').oninput = e => {
            panel.querySelector('#stroke-width-val').textContent = e.target.value;
        };

        const schemeSel = panel.querySelector('#set-color-scheme');
        schemeSel.innerHTML = '';
        Object.entries(AppStorage.COLOR_SCHEMES).forEach(([id, s]) => {
            const o = document.createElement('option'); o.value = id; o.textContent = s.name;
            if (id === settings.colorScheme) o.selected = true;
            schemeSel.appendChild(o);
        });

        panel.classList.add('open');
        document.getElementById('panel-backdrop').classList.add('show');

        // 主题切换
        const tb = panel.querySelector('#set-theme-toggle');
        tb.textContent = settings.theme === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
        tb.onclick = () => {
            const nt = AppTheme.toggle();
            tb.textContent = nt === 'dark' ? '☀️ 浅色模式' : '🌙 深色模式';
            if (settings.resetTextColorOnThemeChange) {
                const d = AppTheme.THEME_DEFAULTS[nt]; settings.textColor = d.textColor;
                panel.querySelector('#set-text-color').value = settings.textColor;
                AppStorage.saveSettings(settings); if (onChange) onChange(settings);
            }
            toast(`已切换到${nt === 'dark' ? '深色' : '浅色'}模式`);
        };

        // 重置
        panel.querySelector('#settings-reset').onclick = () => {
            if (confirm('确定重置所有设置？')) { const f = AppStorage.resetSettings(); AppTheme.set(f.theme); closeSettings(); if (onChange) onChange(f); toast('设置已重置', 'success'); }
        };

        // 实时自动保存：每次修改立即保存
        const autoSave = () => {
            settings.defaultSpinDuration = parseFloat(panel.querySelector('#set-duration').value) || 4;
            settings.textColor = panel.querySelector('#set-text-color').value;
            settings.resetTextColorOnThemeChange = panel.querySelector('#set-reset-text-color').checked;
            settings.spinMode = panel.querySelector('#set-spin-mode').value;
            settings.allowRepeat = panel.querySelector('#set-allow-repeat').checked;
            settings.clickToStop = panel.querySelector('#set-click-stop').checked;
            settings.decelerationPreset = panel.querySelector('#set-speed-curve').value;
            settings.textStrokeEnabled = panel.querySelector('#set-stroke-enabled').checked;
            settings.textStrokeColor = panel.querySelector('#set-stroke-color').value;
            settings.textStrokeWidth = parseFloat(panel.querySelector('#set-stroke-width').value) || 2;
            settings.colorScheme = schemeSel.value;
            settings.showHelp = panel.querySelector('#set-show-help').checked;
            settings.sfxMuted = panel.querySelector('#set-sfx-muted').checked;
            settings.sfxVolume = parseFloat(panel.querySelector('#set-sfx-volume').value) || 0;
            settings.sfxTickTimbre = panel.querySelector('#set-sfx-tick-timbre').value;
            SFX.setVolume(settings.sfxVolume);
            SFX.setMuted(settings.sfxMuted);
            SFX.setTickTimbre(settings.sfxTickTimbre);
            AppStorage.saveSettings(settings);
            const hp = document.getElementById('help-panel');
            if (hp) { if (settings.showHelp) hp.classList.add('visible'); else hp.classList.remove('visible'); }
            if (onChange) onChange(settings);
        };

        // 所有输入项绑定实时保存
        ['change', 'input'].forEach(evt => {
            panel.querySelectorAll('input, select').forEach(el => {
                el.addEventListener(evt, autoSave);
            });
        });

        // 保存按钮也保留，点击等同于保存+关闭
        const closeBtn = panel.querySelector('#settings-close');
        const newClose = closeBtn.cloneNode(true);
        closeBtn.parentNode.replaceChild(newClose, closeBtn);
        newClose.addEventListener('click', () => { autoSave(); closeSettings(); });

        const saveBtn = panel.querySelector('#settings-save');
        const newSave = saveBtn.cloneNode(true);
        saveBtn.parentNode.replaceChild(newSave, saveBtn);
        newSave.addEventListener('click', () => { autoSave(); closeSettings(); });
    }

    function closeSettings() {
        document.getElementById('settings-panel').classList.remove('open');
        document.getElementById('panel-backdrop').classList.remove('show');
    }

    /* ══════════════════════════════════════════
       转盘编辑器
    ══════════════════════════════════════════ */
    function openWheelEditor(wheel, onSave, onDelete) {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-title').textContent = '编辑转盘 — ' + (wheel.name || '新转盘');
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');

        body.innerHTML = `
            <div class="editor-field">
                <label>转盘名称</label>
                <input type="text" id="editor-name" value="${esc(wheel.name || '')}" placeholder="输入转盘名称" />
            </div>
            <div class="editor-options-list" id="editor-options"></div>
            <button class="btn btn-secondary btn-sm" id="editor-add-option">+ 添加选项</button>
        `;

        const list = body.querySelector('#editor-options');
        function renderOpts() {
            list.innerHTML = '';
            wheel.options.forEach((opt, i) => {
                const row = document.createElement('div'); row.className = 'editor-option-row';
                const w = Math.min(100, Math.max(1, opt.weight || 1));
                row.innerHTML = `
                    <label class="toggle-switch"><input type="checkbox" ${opt.enabled ? 'checked' : ''} data-i="${i}" data-f="enabled" /><span class="toggle-slider"></span></label>
                    <input type="text" value="${esc(opt.text)}" placeholder="选项名称" data-i="${i}" data-f="text" class="editor-opt-text" />
                    <div class="weight-control"><span class="weight-label">权重</span>
                        <button class="btn btn-icon btn-sm weight-btn" data-i="${i}" data-dir="-1" title="减少权重">−</button>
                        <input type="number" min="1" max="100" value="${w}" data-i="${i}" data-f="weight" class="editor-opt-weight" />
                        <button class="btn btn-icon btn-sm weight-btn" data-i="${i}" data-dir="1" title="增加权重">+</button>
                    </div>
                    <input type="color" value="${opt.customColor || '#ffffff'}" data-i="${i}" data-f="customColor" class="editor-opt-color" title="自定义颜色" />
                    <button class="btn btn-icon btn-danger-icon" data-i="${i}" data-act="del" title="删除">✕</button>
                `;
                list.appendChild(row);
            });
            list.querySelectorAll('input').forEach(inp => {
                inp.addEventListener('change', e => {
                    const idx = +e.target.dataset.i, f = e.target.dataset.f;
                    if (f === 'enabled') wheel.options[idx].enabled = e.target.checked;
                    else if (f === 'text') wheel.options[idx].text = e.target.value;
                    else if (f === 'weight') wheel.options[idx].weight = clampWeight(+e.target.value);
                    else if (f === 'customColor') wheel.options[idx].customColor = e.target.value;
                });
                inp.addEventListener('input', e => { if (e.target.dataset.f === 'weight') wheel.options[+e.target.dataset.i].weight = clampWeight(+e.target.value); });
                // 移动端兼容：color picker 可能只触发 input 不触发 change
                if (inp.dataset.f === 'customColor') {
                    inp.addEventListener('input', e => { wheel.options[+e.target.dataset.i].customColor = e.target.value; });
                }
                // 滚轮调整权重
                if (inp.dataset.f === 'weight') {
                    inp.addEventListener('wheel', e => {
                        e.preventDefault();
                        const cur = +inp.value || 1;
                        inp.value = clampWeight(cur + (e.deltaY < 0 ? 1 : -1));
                        wheel.options[+inp.dataset.i].weight = +inp.value;
                    });
                }
            });
            // 权重 +/- 按钮（移动端友好）
            list.querySelectorAll('.weight-btn').forEach(btn => {
                btn.addEventListener('click', e => {
                    const idx = +btn.dataset.i, dir = +btn.dataset.dir;
                    const cur = wheel.options[idx].weight || 1;
                    const newVal = clampWeight(cur + dir);
                    wheel.options[idx].weight = newVal;
                    const weightInput = list.querySelector(`input[data-i="${idx}"][data-f="weight"]`);
                    if (weightInput) weightInput.value = newVal;
                });
            });
            list.querySelectorAll('[data-act="del"]').forEach(btn => {
                btn.addEventListener('click', e => {
                    if (wheel.options.length <= 2) { toast('至少保留两个选项', 'warn'); return; }
                    wheel.options.splice(+e.currentTarget.dataset.i, 1); renderOpts();
                });
            });
        }
        renderOpts();

        body.querySelector('#editor-add-option').addEventListener('click', () => {
            wheel.options.push({ id: AppStorage.genId(), text: '新选项', weight: 1, enabled: true, customColor: null });
            renderOpts(); list.scrollTop = list.scrollHeight;
        });

        footer.innerHTML = `<button class="btn btn-danger btn-sm" id="modal-delete" style="margin-right:auto">🗑️ 删除转盘</button><button class="btn btn-secondary" id="modal-cancel">取消</button><button class="btn btn-primary" id="modal-confirm">保存</button>`;
        footer.querySelector('#modal-cancel').onclick = closeEditor;
        footer.querySelector('#modal-confirm').onclick = () => {
            wheel.name = body.querySelector('#editor-name').value.trim() || wheel.name;
            onSave(wheel); closeEditor(); toast('转盘已更新', 'success');
        };
        if (onDelete) {
            footer.querySelector('#modal-delete').onclick = () => {
                if (confirm('确定删除该转盘？此操作不可撤销。')) { onDelete(); closeEditor(); toast('转盘已删除', 'success'); }
            };
        } else {
            footer.querySelector('#modal-delete').style.display = 'none';
        }
        modal.classList.add('open'); activeModal = 'editor';
    }

    function closeEditor() { document.getElementById('modal-overlay').classList.remove('open'); activeModal = null; }

    /* ══════════════════════════════════════════
       嵌套预设管理（v3：转盘组一级，转盘二级，支持新建组/删除转盘/编辑转盘）
    ══════════════════════════════════════════ */
    function openPresetManager(groups, currentGroupId, currentWheelId, onSelect) {
        const modal = document.getElementById('modal-overlay');
        document.getElementById('modal-title').textContent = '📁 预设管理';
        const body = document.getElementById('modal-body');
        const footer = document.getElementById('modal-footer');
        body.innerHTML = '';

        // 收集展开的组
        let expandedGroupId = currentGroupId;

        function render() {
            body.innerHTML = '';
            groups.forEach(group => {
                const isCurrent = group.id === currentGroupId;
                const isExpanded = group.id === expandedGroupId;

                const gEl = document.createElement('div'); gEl.className = 'preset-group';

                // 一级：组名
                gEl.innerHTML = `
                    <div class="preset-group-header ${isCurrent ? 'active' : ''}" data-gid="${group.id}">
                        <span class="preset-group-arrow">${isExpanded ? '▼' : '▶'}</span>
                        <span class="preset-group-name">${isCurrent ? '●' : '○'} ${esc(group.name)}</span>
                        <span class="preset-group-count">${group.wheels.length} 个转盘</span>
                        <div class="preset-group-actions">
                            <button class="btn btn-icon btn-sm" data-act="rename-g" data-id="${group.id}" title="重命名">✏️</button>
                            <button class="btn btn-icon btn-sm btn-danger-icon" data-act="del-g" data-id="${group.id}" title="删除组">🗑️</button>
                        </div>
                    </div>
                    <div class="preset-wheels" style="display:${isExpanded ? 'block' : 'none'}">
                        ${isExpanded ? group.wheels.map(w => `
                            <div class="preset-wheel-item ${w.id === currentWheelId && isCurrent ? 'active' : ''}" data-gid="${group.id}" data-wid="${w.id}">
                                <span class="preset-wheel-label">🎡 ${esc(w.name)} <span class="preset-wheel-count">(${w.options.filter(o => o.enabled).length}项)</span></span>
                                <span class="preset-wheel-actions">
                                    <button class="btn btn-icon btn-sm" data-act="edit-w" data-gid="${group.id}" data-wid="${w.id}" title="编辑">✏️</button>
                                    <button class="btn btn-icon btn-sm btn-danger-icon" data-act="del-w" data-gid="${group.id}" data-wid="${w.id}" title="删除转盘">✕</button>
                                </span>
                            </div>
                        `).join('') + `<button class="btn btn-secondary btn-sm preset-add-wheel" data-gid="${group.id}">+ 新建转盘</button>` : ''}
                    </div>
                `;
                body.appendChild(gEl);
            });

            // 绑定展开/折叠
            body.querySelectorAll('.preset-group-header').forEach(hdr => {
                hdr.addEventListener('click', e => {
                    if (e.target.closest('[data-act]')) return;
                    const gid = hdr.dataset.gid;
                    expandedGroupId = expandedGroupId === gid ? null : gid;
                    render();
                });
            });
            // 选择转盘
            body.querySelectorAll('.preset-wheel-item').forEach(item => {
                item.addEventListener('click', e => {
                    if (e.target.closest('[data-act]')) return;
                    onSelect(item.dataset.gid, item.dataset.wid); closePresetManager();
                });
            });
            // 重命名组
            body.querySelectorAll('[data-act="rename-g"]').forEach(btn => {
                btn.addEventListener('click', e => { e.stopPropagation(); const n = prompt('输入新组名：'); if (n?.trim()) { AppStorage.updateGroup(btn.dataset.id, { name: n.trim() }); groups = AppStorage.loadGroups(); onSelect(btn.dataset.id, currentWheelId); closePresetManager(); } });
            });
            // 删除组
            body.querySelectorAll('[data-act="del-g"]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    if (groups.length <= 1) { toast('至少保留一个转盘组', 'warn'); return; }
                    if (confirm('确定删除该转盘组及其所有转盘？')) {
                        const delId = btn.dataset.id;
                        const u = AppStorage.deleteGroup(delId);
                        groups = AppStorage.loadGroups();
                        // 如果删除的是当前组，跳转到第一个组
                        let newGid = currentGroupId, newWid = currentWheelId;
                        if (delId === currentGroupId) {
                            newGid = u[0].id;
                            newWid = u[0].wheels[0]?.id;
                        }
                        closePresetManager(); onSelect(newGid, newWid);
                    }
                });
            });
            // 编辑转盘
            body.querySelectorAll('[data-act="edit-w"]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const gid = btn.dataset.gid, wid = btn.dataset.wid;
                    const gs = AppStorage.loadGroups();
                    const wheel = gs.find(g => g.id === gid)?.wheels.find(w => w.id === wid);
                    if (!wheel) return;
                    openWheelEditor(AppStorage.deepClone(wheel), w => {
                        AppStorage.updateWheel(gid, wid, w);
                        groups = AppStorage.loadGroups();
                        // 如果编辑的是当前转盘，刷新
                        if (gid === currentGroupId && wid === currentWheelId) {
                            onSelect(gid, wid);
                        }
                        closePresetManager();
                        toast('转盘已更新', 'success');
                    });
                });
            });
            // 删除转盘
            body.querySelectorAll('[data-act="del-w"]').forEach(btn => {
                btn.addEventListener('click', e => {
                    e.stopPropagation();
                    const gid = btn.dataset.gid, wid = btn.dataset.wid;
                    const gs = AppStorage.loadGroups();
                    const group = gs.find(g => g.id === gid);
                    if (!group) return;
                    if (group.wheels.length <= 1) { toast('该组至少保留一个转盘', 'warn'); return; }
                    if (!confirm('确定删除该转盘？')) return;
                    AppStorage.deleteWheel(gid, wid);
                    groups = AppStorage.loadGroups();
                    // 如果删除的是当前转盘，跳转到同组其他转盘
                    let newGid = currentGroupId, newWid = currentWheelId;
                    if (gid === currentGroupId && wid === currentWheelId) {
                        const updatedGroup = groups.find(g => g.id === gid);
                        newWid = updatedGroup?.wheels[0]?.id;
                    }
                    closePresetManager(); onSelect(newGid, newWid);
                    toast('转盘已删除', 'success');
                });
            });
            // 新建转盘
            body.querySelectorAll('.preset-add-wheel').forEach(btn => {
                btn.addEventListener('click', () => { const w = AppStorage.addWheel(btn.dataset.gid); if (w) { groups = AppStorage.loadGroups(); closePresetManager(); onSelect(btn.dataset.gid, w.id); toast('已添加', 'success'); } });
            });
        }
        render();

        // 新建转盘组（修复：确保添加后关闭并刷新）
        const addGroupBtn = document.createElement('button');
        addGroupBtn.className = 'btn btn-primary btn-sm'; addGroupBtn.style.cssText = 'width:100%;margin-top:10px';
        addGroupBtn.textContent = '+ 新建转盘组';
        addGroupBtn.addEventListener('click', () => {
            const n = prompt('输入新转盘组名称：');
            if (n?.trim()) {
                const g = AppStorage.addGroup(n.trim());
                if (!g) { toast('创建失败', 'error'); return; }
                const w = AppStorage.addWheel(g.id);
                if (!w) { toast('创建默认转盘失败', 'error'); return; }
                groups = AppStorage.loadGroups();
                closePresetManager();
                onSelect(g.id, w.id);
                toast('转盘组已创建', 'success');
            }
        });
        body.appendChild(addGroupBtn);

        footer.innerHTML = `<button class="btn btn-secondary" id="modal-cancel">关闭</button><button class="btn btn-secondary" id="preset-export">导出</button><button class="btn btn-secondary" id="preset-import">导入</button>`;
        footer.querySelector('#modal-cancel').onclick = closePresetManager;
        footer.querySelector('#preset-export').onclick = () => {
            const d = AppStorage.exportAll(), b = new Blob([d], { type: 'application/json' }), u = URL.createObjectURL(b), a = document.createElement('a');
            a.href = u; a.download = 'lucky-wheel-backup-' + new Date().toISOString().slice(0, 10) + '.json'; a.click(); URL.revokeObjectURL(u); toast('已导出', 'success');
        };
        footer.querySelector('#preset-import').onclick = () => {
            const inp = document.createElement('input'); inp.type = 'file'; inp.accept = '.json';
            inp.onchange = e => { const f = e.target.files[0]; if (!f) return; const r = new FileReader(); r.onload = ev => { if (AppStorage.importAll(ev.target.result)) { toast('已导入，刷新中', 'success'); setTimeout(() => location.reload(), 800); } else toast('导入失败', 'error'); }; r.readAsText(f); };
            inp.click();
        };
        modal.classList.add('open'); activeModal = 'preset';
    }

    function closePresetManager() { document.getElementById('modal-overlay').classList.remove('open'); activeModal = null; }

    function esc(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    return { toast, openSettings, closeSettings, openWheelEditor, closeEditor, openPresetManager, closePresetManager };
})();
