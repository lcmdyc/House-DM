// js/npc.js — NPC/怪物 资料库 + 工作台侧栏逻辑
// 依赖：data.js, app.js（均已先行加载）

// ─── 数据迁移：确保 D.npcs 存在 ───────────────────────────────
(function ensureNpcs() {
  if (!Array.isArray(D.npcs)) D.npcs = [];
  if (!D.ui) D.ui = {};
  if (typeof D.ui.npcStrip !== 'boolean') D.ui.npcStrip = true;
  if (!Array.isArray(D.ui.npcVisible)) D.ui.npcVisible = [];
})();

// ─── NPC 数据结构 ─────────────────────────────────────────────
function newNpc() {
  return {
    id: uid(),
    name: '新NPC',
    category: 'npc',
    disposition: '中立',
    color: '#b27cd8',
    roomId: '',
    desc: '',
    dmNote: '',
    attrs: [
      { id: uid(), name: 'HP', val: '10' },
      { id: uid(), name: 'AC', val: '10' }
    ],
    dialogs: [
      { id: uid(), trigger: '初次见面', line: '' }
    ]
  };
}

// ─── 页签切换 ─────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('pageWorkbench').style.display = tab === 'workbench' ? 'flex' : 'none';
  document.getElementById('pageLibrary').style.display   = tab === 'library'   ? 'flex' : 'none';
  document.getElementById('tabWorkbench').classList.toggle('on', tab === 'workbench');
  document.getElementById('tabLibrary').classList.toggle('on', tab === 'library');
  if (tab === 'library') {
    const active = document.querySelector('.lib-tab.on');
    if (!active) switchLibTab('bg');
    else if (active.id === 'libTabNpc') renderNpcLib();
    else renderBg();
  }
}

function switchLibTab(sub) {
  document.getElementById('libPageBg').style.display  = sub === 'bg'  ? 'flex' : 'none';
  document.getElementById('libPageNpc').style.display = sub === 'npc' ? 'flex' : 'none';
  document.getElementById('libTabBg').classList.toggle('on',  sub === 'bg');
  document.getElementById('libTabNpc').classList.toggle('on', sub === 'npc');
  if (sub === 'bg')  renderBg();
  if (sub === 'npc') renderNpcLib();
}

// ─── 资料库：NPC 列表渲染 ──────────────────────────────────────
let selNpcId = null;

function renderNpcLib() {
  const page = document.getElementById('libPageNpc');
  if (!page) return;

  const q   = (document.getElementById('npcLibQ')   || {}).value || '';
  const cat = (document.getElementById('npcLibCat') || {}).value || '';
  const list = D.npcs.filter(n => {
    if (cat && n.category !== cat) return false;
    if (q && !n.name.includes(q) && !n.desc.includes(q)) return false;
    return true;
  });

  const el = document.getElementById('npcLibList');
  if (!el) return;
  if (!list.length) {
    el.innerHTML = '<p class="hint" style="padding:12px;text-align:center">暂无NPC/怪物，点击左上角新增</p>';
  } else {
    el.innerHTML = list.map(n => {
      const badgeText = n.category === 'npc' ? 'NPC' : n.category === 'monster' ? '怪物' : '其他';
      const cls = n.category === 'monster' ? 'npc-card monster' : 'npc-card';
      return `<div class="${cls}${selNpcId===n.id?' sel':''}" onclick="selectNpc('${n.id}')">
        <div class="nc-name">${esc(n.name)}</div>
        <div class="nc-meta">
          <span class="nc-badge">${badgeText}</span>
          <span>${esc(n.disposition)}</span>
          ${n.roomId ? `<span>📍${esc(rname(n.roomId))}</span>` : ''}
        </div>
      </div>`;
    }).join('');
  }
  renderNpcDetail();
}

function selectNpc(id) {
  selNpcId = id;
  renderNpcLib();
}

function addNpcToLib() {
  const n = newNpc();
  D.npcs.push(n);
  selNpcId = n.id;
  saveData(D);
  renderNpcLib();
  renderNpcStrip();
}

function deleteNpc(id) {
  if (!confirm('确认删除此NPC/怪物？')) return;
  D.npcs = D.npcs.filter(n => n.id !== id);
  D.ui.npcVisible = D.ui.npcVisible.filter(i => i !== id);
  if (selNpcId === id) selNpcId = D.npcs.length ? D.npcs[D.npcs.length-1].id : null;
  saveData(D);
  renderNpcLib();
  renderNpcStrip();
  renderMap();
}

// ─── 资料库：NPC 详情面板 ──────────────────────────────────────
function renderNpcDetail() {
  const el = document.getElementById('npcLibDetail');
  if (!el) return;
  const n = D.npcs.find(x => x.id === selNpcId);
  if (!n) {
    el.innerHTML = '<div class="npc-detail-empty">← 从左侧选择一个 NPC/怪物</div>';
    return;
  }

  const roomOpts = `<option value="">📍 未定位</option>` +
    D.rooms.map(r => `<option value="${r.id}"${r.id===n.roomId?' selected':''}>${esc(r.name||'未命名')} (${r.x},${r.y})</option>`).join('');

  const attrsHtml = n.attrs.map((a, i) =>
    `<div class="npc-attr-row">
      <input class="attr-name" value="${esc(a.name)}" placeholder="属性名" oninput="npcAttrEdit('${n.id}',${i},'name',this.value)">
      <input class="attr-val"  value="${esc(a.val)}"  placeholder="值"    oninput="npcAttrEdit('${n.id}',${i},'val',this.value)">
      <button onclick="npcAttrDel('${n.id}',${i})">✕</button>
    </div>`).join('');

  const dialogsHtml = n.dialogs.map((d, i) =>
    `<div class="npc-dialog-row">
      <div style="display:flex;flex-direction:column;gap:4px;flex:1">
        <input value="${esc(d.trigger)}" placeholder="触发条件（如：初次见面）" style="background:transparent;border:none;border-bottom:1px solid var(--line);color:var(--mute);font-size:11px;padding:0 0 2px;width:100%" oninput="npcDialogEdit('${n.id}',${i},'trigger',this.value)">
        <textarea placeholder="台词内容…" oninput="npcDialogEdit('${n.id}',${i},'line',this.value)">${esc(d.line)}</textarea>
      </div>
      <button onclick="npcDialogDel('${n.id}',${i})">✕</button>
    </div>`).join('');

  el.innerHTML = `
    <div class="npc-detail-form">
      <div class="npc-detail-header">
        <h3>${esc(n.name)}</h3>
        <button onclick="copyNpcDesc('${n.id}')">📋 复制描述</button>
        <button class="danger" onclick="deleteNpc('${n.id}')">🗑 删除</button>
      </div>

      <div class="npc-row">
        <div class="npc-field">
          <label>名称</label>
          <input value="${esc(n.name)}" oninput="npcEdit('${n.id}','name',this.value)">
        </div>
        <div class="npc-field">
          <label>类型</label>
          <select onchange="npcEdit('${n.id}','category',this.value)">
            <option value="npc"${n.category==='npc'?' selected':''}>NPC</option>
            <option value="monster"${n.category==='monster'?' selected':''}>怪物</option>
            <option value="other"${n.category==='other'?' selected':''}>其他</option>
          </select>
        </div>
        <div class="npc-field">
          <label>立场</label>
          <select onchange="npcEdit('${n.id}','disposition',this.value)">
            <option${n.disposition==='友好'?' selected':''}>友好</option>
            <option${n.disposition==='中立'?' selected':''}>中立</option>
            <option${n.disposition==='敌对'?' selected':''}>敌对</option>
          </select>
        </div>
      </div>

      <div class="npc-row">
        <div class="npc-field">
          <label>标记颜色</label>
          <input type="color" value="${n.color||'#b27cd8'}" oninput="npcEdit('${n.id}','color',this.value)" style="height:34px;padding:2px 4px;cursor:pointer">
        </div>
        <div class="npc-field" style="flex:2">
          <label>当前所在房间</label>
          <select onchange="npcSetRoom('${n.id}',this.value)">${roomOpts}</select>
        </div>
      </div>

      <div class="npc-field">
        <label>外观与描述</label>
        <textarea rows="4" placeholder="外貌、气质、玩家可见描述…" oninput="npcEdit('${n.id}','desc',this.value)">${esc(n.desc)}</textarea>
      </div>

      <div class="npc-field">
        <label>DM 备注（玩家不可见）</label>
        <textarea rows="3" placeholder="秘密动机、隐藏信息…" oninput="npcEdit('${n.id}','dmNote',this.value)">${esc(n.dmNote)}</textarea>
      </div>

      <div class="npc-field">
        <label>属性</label>
        <div class="npc-attrs">${attrsHtml}</div>
        <button style="margin-top:6px;align-self:flex-start" onclick="npcAttrAdd('${n.id}')">＋ 添加属性</button>
      </div>

      <div class="npc-field">
        <label>预设对话</label>
        <div class="npc-dialogs">${dialogsHtml}</div>
        <button style="margin-top:6px;align-self:flex-start" onclick="npcDialogAdd('${n.id}')">＋ 添加对话</button>
      </div>
    </div>`;
}

// ─── NPC 字段编辑 ──────────────────────────────────────────────
function npcEdit(id, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n[field] = val;
  saveData(D);
  if (field === 'name' || field === 'category' || field === 'disposition') renderNpcLib();
  if (field === 'color') renderNpcStrip();
}

function npcSetRoom(id, rid) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  const old = n.roomId;
  n.roomId = rid;
  addLog('move', `[NPC]${n.name}：${rname(old)} → ${rname(rid)}`, n.color || '#b27cd8');
  saveData(D);
  renderNpcStrip();
  renderMap();
  renderNpcDetail();
}

function npcAttrEdit(id, idx, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs[idx][field] = val;
  saveData(D);
  renderNpcStrip();
}
function npcAttrAdd(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs.push({ id: uid(), name: '新属性', val: '0' });
  saveData(D); renderNpcDetail(); renderNpcStrip();
}
function npcAttrDel(id, idx) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.attrs.splice(idx, 1);
  saveData(D); renderNpcDetail(); renderNpcStrip();
}

function npcDialogEdit(id, idx, field, val) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs[idx][field] = val;
  saveData(D);
}
function npcDialogAdd(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs.push({ id: uid(), trigger: '', line: '' });
  saveData(D); renderNpcDetail();
}
function npcDialogDel(id, idx) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  n.dialogs.splice(idx, 1);
  saveData(D); renderNpcDetail();
}

function copyNpcDesc(id) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  if (!n.desc.trim()) { toast('该NPC还没有描述'); return; }
  copyText(n.desc).then(ok => toast(ok ? '📋 已复制描述' : '复制失败'));
}

// ─── 工作台：NPC 侧栏 ──────────────────────────────────────────
function setNpcStrip(show) {
  D.ui.npcStrip = show;
  saveData(D);
  renderNpcStrip();
  setTimeout(() => {
    if (typeof applyPan === 'function') applyPan();
  }, 220); // 比 transition 的 0.2s 稍长
}


function renderNpcStrip() {
  const s = document.getElementById('npcStrip'); if (!s || !D) return;
  s.classList.toggle('hide', !D.ui.npcStrip);
  const openBtn = document.getElementById('npcStripOpen');
  if (openBtn) openBtn.style.display = D.ui.npcStrip ? 'none' : 'block';
  if (!D.ui.npcStrip) return;

  // 只显示被勾选的 NPC
  const visible = D.npcs.filter(n => D.ui.npcVisible.includes(n.id));

  const cards = visible.map(n => {
    const attrsHtml = n.attrs.slice(0,4).map(a =>
      `<span class="${+a.val===0?'z':''}" title="${esc(a.name)}">
        <i>${esc(a.name)}</i><b>${esc(a.val)}</b>
      </span>`).join('');
    return `<div class="nc" style="border-left-color:${n.color||'#b27cd8'}"
                 onclick="goNpcDetail('${n.id}')">
      <div class="pn">${esc(n.name)}</div>
      <div class="cn">${n.category==='monster'?'👹 怪物':n.category==='npc'?'🧑 NPC':'◆ 其他'} · ${esc(n.disposition)}</div>
      <select class="prm" onclick="event.stopPropagation()" onchange="npcSetRoom('${n.id}',this.value)">
        <option value="">📍 未定位</option>
        ${D.rooms.map(r=>`<option value="${r.id}"${r.id===n.roomId?' selected':''}>${esc(r.name||'未命名')} (${r.x},${r.y})</option>`).join('')}
      </select>
      ${n.attrs.length ? `<div class="as">${attrsHtml}</div>` : ''}
    </div>`;
  }).join('');

  s.innerHTML = `
    <div class="sthead">
      <span style="margin-right:auto">👾 NPC</span>
      <button title="设置显示哪些NPC" onclick="openNpcStripCfg()">⚙</button>
      <button title="收起" onclick="setNpcStrip(false)">◀</button>
    </div>
    ${visible.length ? cards :
      `<p class="hint" style="font-size:11px;text-align:center;margin-top:8px">
        点击 ⚙ 选择要显示的NPC
      </p>`}`;
}

function goNpcDetail(id) {
  selNpcId = id;
  switchTab('library');
  switchLibTab('npc');
}

// ─── NPC 侧栏勾选设置 ──────────────────────────────────────────
function openNpcStripCfg() {
  const box = document.getElementById('npcStripCfgBox');
  if (!box) return;
  box.innerHTML = D.npcs.length
    ? D.npcs.map(n => {
        const checked = D.ui.npcVisible.includes(n.id);
        return `<label style="display:flex;align-items:center;gap:8px;padding:5px 0;cursor:pointer">
          <input type="checkbox" ${checked?'checked':''} onchange="npcVisToggle('${n.id}',this.checked)"
            style="accent-color:var(--npc)">
          <span style="border-left:3px solid ${n.color||'#b27cd8'};padding-left:6px">
            ${esc(n.name)}
            <small style="color:var(--mute);margin-left:4px">${n.category==='monster'?'怪物':'NPC'}</small>
          </span>
        </label>`;
      }).join('')
    : '<p class="hint" style="padding:8px">还没有NPC，请先在资料库中新增。</p>';
  document.getElementById('npcStripDlg').showModal();
}

function npcVisToggle(id, checked) {
  if (checked) {
    if (!D.ui.npcVisible.includes(id)) D.ui.npcVisible.push(id);
  } else {
    D.ui.npcVisible = D.ui.npcVisible.filter(x => x !== id);
  }
  saveData(D);
  renderNpcStrip();
}

function npcStripCheckAll(val) {
  D.ui.npcVisible = val ? D.npcs.map(n => n.id) : [];
  saveData(D);
  renderNpcStrip();
  openNpcStripCfg();
}

// ─── 地图：NPC 头像注入（有 roomId 的 NPC 自动显示在地图上）────
function injectNpcChips() {
  const visible = D.npcs.filter(n => n.roomId);
  const byRoom = {};
  visible.forEach(n => {
    if (!byRoom[n.roomId]) byRoom[n.roomId] = [];
    byRoom[n.roomId].push(n);
  });
  Object.entries(byRoom).forEach(([rid, npcs]) => {
    const cell = document.querySelector(`.cell[data-rid="${rid}"]`);
    if (!cell) return;
    let container = cell.querySelector('.room-npcs');
    if (!container) {
      container = document.createElement('div');
      container.className = 'room-npcs';
      container.style.cssText = 'position:absolute;bottom:4px;left:4px;display:flex;flex-wrap:wrap;gap:2px;z-index:3;pointer-events:none';
      cell.appendChild(container);
    }
    container.innerHTML = npcs.map(n =>
      `<i class="npc-chip" style="background:${n.color||'#b27cd8'}" title="${esc(n.name)}">${esc([...n.name][0]||'?')}</i>`
    ).join('');
  });
  document.querySelectorAll('.room-npcs').forEach(c => {
    const cell = c.closest('.cell');
    if (!cell) return;
    const rid = cell.dataset.rid;
    if (!byRoom[rid]) c.innerHTML = '';
  });
}

// ─── 初始化 ────────────────────────────────────────────────────
renderNpcStrip();
