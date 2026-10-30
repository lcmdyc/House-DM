// js/npc.js — NPC侧栏 + NPC资料库 + NPC详情
// 依赖：data.js  （D, uid, esc, saveData, rname, room）
// 依赖：core.js  （selNpcId, edit, save, toast, copyText, addLog, roomSel, switchTab, switchLibTab）
// 依赖：wheel.js （onWheelAdj, adjNpcAttr）
// 依赖：map.js   （renderMap）
// 依赖：side.js  （renderSide）

// ── 数据结构 ─────────────────────────────────────────────────
function newNpc() {
  return {
    id: uid(), name: '新NPC', category: 'npc', disposition: '中立',
    color: '#b27cd8', roomId: '', desc: '', dmNote: '',
    attrs:   [{ id: uid(), name: 'HP', val: '10' }, { id: uid(), name: 'AC', val: '10' }],
    dialogs: [{ id: uid(), trigger: '初次见面', line: '', used: false }]
  };
}

function duplicateNpc(id) {
  const src = D.npcs.find(x => x.id === id); if (!src) return;

  const baseName = src.name.replace(/ [A-Z]$/, '');
  const siblings = D.npcs.filter(n =>
    n.id !== src.id && n.name.replace(/ [A-Z]$/, '') === baseName
  ).length;
  const suffix = String.fromCharCode(65 + siblings);

  const copy = JSON.parse(JSON.stringify(src));
  copy.id     = uid();
  copy.name   = baseName + ' ' + suffix;
  copy.roomId = '';
  copy.attrs.forEach(a => a.id = uid());
  copy.dialogs.forEach(d => { d.id = uid(); d.used = false; });

  const idx = D.npcs.findIndex(x => x.id === id);
  D.npcs.splice(idx + 1, 0, copy);
  selNpcId = copy.id;
  saveData(D); renderNpcLib(); renderNpcStrip();
  toast(`📋 已复制为「${copy.name}」`);
}

// ── 魔术字 ───────────────────────────────────────────────────
function playerMagicKey(i) { return `p${i + 1}`; }
function resolveDialogLine(line) {
  return line.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const idx = D.players.findIndex((_, i) => playerMagicKey(i) === key || pname(i) === key);
    return idx >= 0 ? pname(idx) : match;
  });
}

// ── NPC 工作台侧栏 ───────────────────────────────────────────
function renderNpcStrip() {
  const s = document.getElementById('npcStrip'); if (!s || !D) return;
  if (!Array.isArray(D.ui.npcVisible)) D.ui.npcVisible = [];
  const visible = D.npcs.filter(n => D.ui.npcVisible.includes(n.id));
  const cards = visible.map(n => {
    const attrsHtml = n.attrs.slice(0, 6).map(a =>
      `<span class="nc-attr-chip${+a.val === 0 ? ' z' : ''}"
        title="${esc(a.name)}（滚轮增减）"
        onwheel="onWheelAdj(event,'npc','${n.id}','${a.id}')">
        <i>${esc(a.name)}</i><b>${esc(a.val)}</b>
      </span>`
    ).join('');
    return `<div class="nc${n.dead ? ' dead' : ''}"
      style="border-left-color:${n.color || '#b27cd8'}"
      onclick="goNpcDetail('${n.id}')">
      <div class="pn">${esc(n.name)} ${n.dead ? '<span class="dead-badge">💀 已死亡</span>' : ''}</div>
      <div class="cn">${n.category === 'monster' ? '👹 怪物' : n.category === 'npc' ? '🧑 NPC' : '◆ 其他'} · ${esc(n.disposition)}</div>
      <select class="prm" onclick="event.stopPropagation()" onchange="npcSetRoom('${n.id}',this.value)">
        <option value="">📍 未定位</option>
        ${D.rooms.map(r =>
          `<option value="${r.id}"${r.id === n.roomId ? ' selected' : ''}>${esc(r.name || '未命名')} (${r.x},${r.y})</option>`
        ).join('')}
      </select>
      ${n.attrs.length ? `<div class="as">${attrsHtml}</div>` : ''}
    </div>`;
  }).join('');
  s.innerHTML = `<div class="sthead"><span style="margin-right:auto">👾 NPC</span>
    <button title="设置显示哪些NPC" onclick="openNpcStripCfg()">⚙</button></div>
    ${visible.length ? cards : '<p class="hint npc-strip-empty">点击 ⚙ 选择要显示的NPC</p>'}`;
}

function goNpcDetail(id) {
  selNpcId = id;
  switchTab('library');
  switchLibTab('npc');
}

function openNpcStripCfg() {
  const box = document.getElementById('npcStripCfgBox'); if (!box) return;
  box.innerHTML = D.npcs.length
    ? D.npcs.map(n => {
        const checked = D.ui.npcVisible.includes(n.id);
        return `<label class="npc-vis-row">
          <input type="checkbox" ${checked ? 'checked' : ''} onchange="npcVisToggle('${n.id}',this.checked)" class="npc-vis-chk">
          <span class="npc-vis-label" style="border-left-color:${n.color || '#b27cd8'}">
            ${esc(n.name)}<small class="npc-vis-type">${n.category === 'monster' ? '怪物' : 'NPC'}</small>
          </span></label>`;
      }).join('')
    : '<p class="hint npc-cfg-empty">还没有NPC，请先在资料库中新增。</p>';
  document.getElementById('npcStripDlg').showModal();
}

function npcVisToggle(id, checked) {
  if (checked) { if (!D.ui.npcVisible.includes(id)) D.ui.npcVisible.push(id); }
  else { D.ui.npcVisible = D.ui.npcVisible.filter(x => x !== id); }
  saveData(D); renderNpcStrip();
}
function npcStripCheckAll(val) {
  D.ui.npcVisible = val ? D.npcs.map(n => n.id) : [];
  saveData(D); renderNpcStrip(); openNpcStripCfg();
}

// ── NPC 资料库列表 ───────────────────────────────────────────
function renderNpcLib() {
  const q   = (document.getElementById('npcLibQ')   || {}).value || '';
  const cat = (document.getElementById('npcLibCat') || {}).value || '';
  const list = D.npcs.filter(n => {
    if (cat && n.category !== cat) return false;
    if (q && !n.name.includes(q) && !(n.desc || '').includes(q)) return false;
    return true;
  });
  const el = document.getElementById('npcLibList'); if (!el) return;
  el.innerHTML = list.length
    ? list.map(n => {
        const cls   = n.category === 'monster' ? 'npc-card monster' : 'npc-card';
        const badge = n.category === 'npc' ? 'NPC' : n.category === 'monster' ? '怪物' : '其他';
        return `<div class="${cls}${selNpcId === n.id ? ' sel' : ''}" onclick="selectNpc('${n.id}')">
          <div class="nc-name">${esc(n.name)}</div>
          <div class="nc-meta">
            <span class="nc-badge">${badge}</span>
            <span>${esc(n.disposition)}</span>
            ${n.roomId ? `<span>📍${esc(rname(n.roomId))}</span>` : ''}
          </div>
          <button class="npc-dup-btn" title="复制此NPC"
            onclick="event.stopPropagation();duplicateNpc('${n.id}')">⧉</button>
        </div>`;
      }).join('')
    : '<p class="hint npc-lib-empty">暂无NPC/怪物，点击左上角新增</p>';
  renderNpcDetail();
}

function selectNpc(id) { selNpcId = id; renderNpcLib(); }

function addNpcToLib() {
  const n = newNpc();
  D.npcs.push(n);
  selNpcId = n.id;
  saveData(D); renderNpcLib(); renderNpcStrip();
}

function deleteNpc(id) {
  if (!confirm('确认删除此NPC/怪物？')) return;
  D.npcs = D.npcs.filter(n => n.id !== id);
  D.ui.npcVisible = D.ui.npcVisible.filter(i => i !== id);
  if (selNpcId === id) selNpcId = D.npcs.length ? D.npcs[D.npcs.length - 1].id : null;
  saveData(D); renderNpcLib(); renderNpcStrip(); renderMap();
}

// ── NPC 详情 ─────────────────────────────────────────────────
function renderNpcDetail() {
  const el = document.getElementById('npcLibDetail'); if (!el) return;
  const n = D.npcs.find(x => x.id === selNpcId);
  if (!n) { el.innerHTML = '<div class="npc-detail-empty">← 从左侧选择一个 NPC/怪物</div>'; return; }

  const roomOpts = `<option value="">📍 未定位</option>` +
    D.rooms.map(r =>
      `<option value="${r.id}"${r.id === n.roomId ? ' selected' : ''}>${esc(r.name || '未命名')} (${r.x},${r.y})</option>`
    ).join('');

  const attrsHtml = n.attrs.map((a, i) =>
    `<div class="npc-attr-row">
      <input class="attr-name" value="${esc(a.name)}" placeholder="属性名"
        oninput="npcAttrEdit('${n.id}',${i},'name',this.value)">
      <button onclick="npcAttrAdj('${n.id}',${i},-1)">－</button>
      <input class="attr-val" value="${esc(a.val)}" placeholder="值"
        title="${esc(a.name)}（滚轮增减）"
        onwheel="onWheelAdj(event,'npc','${n.id}','${a.id}')"
        oninput="npcAttrEdit('${n.id}',${i},'val',this.value)">
      <button onclick="npcAttrAdj('${n.id}',${i},1)">＋</button>
      <button onclick="npcAttrDel('${n.id}',${i})">✕</button>
    </div>`
  ).join('');

  const dialogsHtml = (n.dialogs || []).map((d, i) => {
    if (!edit) {
      const resolved = resolveDialogLine(d.line);
      return `<div class="item compact npc-dialog-copy${d.used ? ' used' : ''}"
        onclick="copyNpcDialog('${n.id}',${i})">
        <div class="row">
          <span class="tag static npc">${esc(d.trigger) || '对话'}</span>
          <div class="memo">
            <span class="cd ${d.line.trim() ? '' : 'emp'}">${d.line.trim() ? esc(resolved) : '（暂无台词）'}</span>
          </div>
          <button class="dlg-used-btn${d.used ? ' on' : ''}"
            title="${d.used ? '已使用，点击撤销' : '标记为已使用'}"
            onclick="event.stopPropagation();npcDialogToggleUsed('${n.id}',${i})">
            ${d.used ? '✅' : '○'}
          </button>
          <span class="copyi">📋</span>
        </div>
      </div>`;
    }
    return `<div class="npc-dialog-row${d.used ? ' used' : ''}">
      <div class="npc-dialog-inner">
        <input value="${esc(d.trigger)}" placeholder="触发条件" class="npc-dialog-trigger"
          oninput="npcDialogEdit('${n.id}',${i},'trigger',this.value)">
        <textarea placeholder="台词内容…支持魔术字 {{玩家名}}"
          oninput="npcDialogEdit('${n.id}',${i},'line',this.value)">${esc(d.line)}</textarea>
      </div>
      <button class="dlg-used-btn${d.used ? ' on' : ''}"
        title="${d.used ? '已使用，点击撤销' : '标记为已使用'}"
        onclick="npcDialogToggleUsed('${n.id}',${i})">
        ${d.used ? '✅' : '○'}
      </button>
      <button onclick="npcDialogDel('${n.id}',${i})">✕</button>
    </div>`;
  }).join('');

  el.innerHTML = `<div class="npc-detail-form">
    <div class="npc-detail-header">
      <h3>${esc(n.name)}</h3>
      <button onclick="duplicateNpc('${n.id}')" title="复制此NPC生成副本">⧉ 复制</button>
      <button onclick="copyNpcDesc('${n.id}')">📋 复制描述</button>
      <button class="danger" onclick="deleteNpc('${n.id}')">🗑 删除</button>
    </div>
    <div class="npc-row">
      <div class="npc-field"><label>名称</label>
        <input value="${esc(n.name)}" oninput="npcEdit('${n.id}','name',this.value)"></div>
      <div class="npc-field"><label>类型</label>
        <select onchange="npcEdit('${n.id}','category',this.value)">
          <option value="npc"${n.category === 'npc' ? ' selected' : ''}>NPC</option>
          <option value="monster"${n.category === 'monster' ? ' selected' : ''}>怪物</option>
          <option value="other"${n.category === 'other' ? ' selected' : ''}>其他</option>
        </select></div>
      <div class="npc-field"><label>立场</label>
        <select onchange="npcEdit('${n.id}','disposition',this.value)">
          <option${n.disposition === '友好' ? ' selected' : ''}>友好</option>
          <option${n.disposition === '中立' ? ' selected' : ''}>中立</option>
          <option${n.disposition === '敌对' ? ' selected' : ''}>敌对</option>
        </select></div>
    </div>
    <div class="npc-row">
      <div class="npc-field"><label>标记颜色</label>
        <input type="color" value="${n.color || '#b27cd8'}"
          oninput="npcEdit('${n.id}','color',this.value)" class="npc-color-input"></div>
      <div class="npc-field npc-field-wide"><label>当前所在房间</label>
        <select onchange="npcSetRoom('${n.id}',this.value)">${roomOpts}</select></div>
    </div>
    <div class="npc-field"><label>外观与描述</label>
      <textarea rows="4" placeholder="外貌、气质、玩家可见描述…"
        oninput="npcEdit('${n.id}','desc',this.value)">${esc(n.desc)}</textarea></div>
    <div class="npc-field"><label>DM 备注（玩家不可见）</label>
      <textarea rows="3" placeholder="秘密动机、隐藏信息…"
        oninput="npcEdit('${n.id}','dmNote',this.value)">${esc(n.dmNote)}</textarea></div>
    <div class="npc-field"><label>属性</label>
      <div class="npc-attrs">${attrsHtml}</div>
      <button class="npc-add-btn" onclick="npcAttrAdd('${n.id}')">＋ 添加属性</button></div>
    <div class="npc-field"><label>预设对话</label>
      <div class="npc-dialogs">${dialogsHtml}</div>
      <button class="npc-add-btn" onclick="npcDialogAdd('${n.id}')">＋ 添加对话</button></div>
  </div>`;
}

// ── NPC 字段编辑 ─────────────────────────────────────────────
function npcEdit(id, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n[field] = val;
  saveData(D);
  if (field === 'name') {
    const card = document.querySelector(`#npcLibList .npc-card[onclick*="${id}"] .nc-name`);
    if (card) card.textContent = val;
    renderNpcStrip();
  }
  if (field === 'category' || field === 'disposition') renderNpcLib();
  if (field === 'color') renderNpcStrip();
}

function npcSetRoom(id, rid) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  const old = n.roomId;
  n.roomId = rid;
  addLog('move', `[NPC]${n.name}：${rname(old)} → ${rname(rid)}`, n.color || '#b27cd8');
  saveData(D); renderNpcStrip(); renderMap(); renderNpcDetail();
}

function npcAttrEdit(id, idx, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs[idx][field] = val; saveData(D); renderNpcStrip();
}

function npcAttrAdj(id, idx, delta) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  const a = n.attrs[idx]; if (!a) return;
  adjNpcAttr(id, a.id, delta);
}

function npcAttrAdd(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs.push({ id: uid(), name: '新属性', val: '0' });
  saveData(D); renderNpcDetail(); renderNpcStrip();
}
function npcAttrDel(id, idx) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs.splice(idx, 1); saveData(D); renderNpcDetail(); renderNpcStrip();
}

function npcDialogEdit(id, idx, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs[idx][field] = val; saveData(D);
}
function npcDialogAdd(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs.push({ id: uid(), trigger: '', line: '', used: false });
  saveData(D); renderNpcDetail();
}
function npcDialogDel(id, idx) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs.splice(idx, 1); saveData(D); renderNpcDetail();
}
function npcDialogToggleUsed(id, idx) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  const d = n.dialogs[idx]; if (!d) return;
  d.used = !d.used;
  saveData(D); renderNpcDetail();
  toast(d.used ? '✅ 已标记为已使用' : '○ 已取消使用标记');
}

function copyNpcDesc(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  if (!n.desc.trim()) { toast('该NPC还没有描述'); return; }
  copyText(n.desc).then(ok => toast(ok ? '📋 已复制描述' : '复制失败'));
}
function copyNpcDialog(npcId, idx) {
  const n = D.npcs.find(x => x.id === npcId); if (!n) return;
  const d = n.dialogs[idx]; if (!d) return;
  if (!d.line.trim()) { toast('这条对话没有台词'); return; }
  const resolved = resolveDialogLine(d.line);
  copyText(resolved).then(ok => toast(ok ? '📋 已复制台词' : '复制失败'));
}

function toggleNpcDead(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dead = !n.dead;
  saveData(D); renderSide(); renderNpcStrip();
  toast(n.dead ? `💀 ${n.name} 已标记死亡` : `✅ ${n.name} 已取消死亡标记`);
}