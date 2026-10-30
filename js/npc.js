// js/npc.js — NPC侧栏 + NPC资料库 + NPC详情 (ES6 Module)
import { D, uid, esc, rname, pname } from './data.js';
import { uiState, save, toast, copyText, addLog, roomSel, switchTab, switchLibTab } from './core.js';
import { renderAttrChips, renderAttrEditRows } from './attr.js';
import { renderEntityCard } from './card.js';

window.addEventListener('trpg-ui-update', () => {
  renderNpcStrip();
  if (document.getElementById('libTabNpc')?.classList.contains('on')) renderNpcLib();
});

window.addEventListener('trpg-data-loaded', renderNpcStrip);
window.addEventListener('trpg-lib-tab-changed', (e) => { if (e.detail.sub === 'npc') renderNpcLib(); });

export function newNpc() {
  return {
    id: uid(), name: '新NPC', category: 'npc', disposition: '中立', color: '#b27cd8', roomId: '', desc: '', dmNote: '',
    attrs: [{ id: uid(), name: 'HP', val: '10', show: true }, { id: uid(), name: 'AC', val: '10', show: true }],
    dialogs: [{ id: uid(), trigger: '初次见面', line: '', used: false }]
  };
}

export function duplicateNpc(id) {
  const src = D.npcs.find(x => x.id === id); if (!src) return;
  const baseName = src.name.replace(/ [A-Z]$/, '');
  const siblings = D.npcs.filter(n => n.id !== src.id && n.name.replace(/ [A-Z]$/, '') === baseName).length;
  const suffix = String.fromCharCode(65 + siblings);
  const copy = JSON.parse(JSON.stringify(src));
  copy.id = uid(); copy.name = baseName + ' ' + suffix; copy.roomId = '';
  copy.attrs.forEach(a => a.id = uid());
  copy.dialogs.forEach(d => { d.id = uid(); d.used = false; });
  const idx = D.npcs.findIndex(x => x.id === id);
  D.npcs.splice(idx + 1, 0, copy);
  uiState.selNpcId = copy.id;
  save(); toast(`📋 已复制为「${copy.name}」`);
}

function playerMagicKey(i) { return `p${i + 1}`; }
function resolveDialogLine(line) {
  return line.replace(/\{\{([^}]+)\}\}/g, (match, key) => {
    const idx = D.players.findIndex((_, i) => playerMagicKey(i) === key || pname(i) === key);
    return idx >= 0 ? pname(idx) : match;
  });
}

export function renderNpcStrip() {
  const s = document.getElementById('npcStrip'); if (!s || !D) return;
  if (!Array.isArray(D.ui.npcVisible)) D.ui.npcVisible = [];
  const visible = D.npcs.filter(n => D.ui.npcVisible.includes(n.id));
  const cards = visible.map(n => {
    const attrsHtml = renderAttrChips('npc', n.id, n.attrs);
    return `<div class="nc${n.dead ? ' dead' : ''}" style="border-left-color:${n.color || '#b27cd8'}" onclick="goNpcDetail('${n.id}')">
      <div class="pn">${esc(n.name)} ${n.dead ? '<span class="dead-badge">💀 已死亡</span>' : ''}</div>
      <div class="cn">${n.category === 'monster' ? '👹 怪物' : n.category === 'npc' ? '🧑 NPC' : '◆ 其他'} · ${esc(n.disposition)}</div>
      <select class="prm" onclick="event.stopPropagation()" onchange="npcSetRoom('${n.id}',this.value)">
        <option value="">📍 未定位</option>
        ${D.rooms.map(r => `<option value="${r.id}"${r.id === n.roomId ? ' selected' : ''}>${esc(r.name || '未命名')} (${r.x},${r.y})</option>`).join('')}
      </select>
      ${attrsHtml ? `<div class="as">${attrsHtml}</div>` : ''}
    </div>`;
  }).join('');
  s.innerHTML = `<div class="sthead"><span style="margin-right:auto">👾 NPC</span><button title="设置显示哪些NPC" onclick="openNpcStripCfg()">⚙</button></div>${visible.length ? cards : '<p class="hint npc-strip-empty">点击 ⚙ 选择要显示的NPC</p>'}`;
}

export function goNpcDetail(id) { uiState.selNpcId = id; switchTab('library'); switchLibTab('npc'); }

export function openNpcStripCfg() {
  const box = document.getElementById('npcStripCfgBox'); if (!box) return;
  box.innerHTML = D.npcs.length ? D.npcs.map(n => {
    const checked = D.ui.npcVisible.includes(n.id);
    return `<label class="npc-vis-row"><input type="checkbox" ${checked ? 'checked' : ''} onchange="npcVisToggle('${n.id}',this.checked)" class="npc-vis-chk"><span class="npc-vis-label" style="border-left-color:${n.color || '#b27cd8'}">${esc(n.name)}<small class="npc-vis-type">${n.category === 'monster' ? '怪物' : 'NPC'}</small></span></label>`;
  }).join('') : '<p class="hint npc-cfg-empty">还没有NPC，请先在资料库中新增。</p>';
  document.getElementById('npcStripDlg').showModal();
}

export function npcVisToggle(id, checked) {
  if (checked) { if (!D.ui.npcVisible.includes(id)) D.ui.npcVisible.push(id); }
  else { D.ui.npcVisible = D.ui.npcVisible.filter(x => x !== id); }
  save();
}

export function npcStripCheckAll(val) { D.ui.npcVisible = val ? D.npcs.map(n => n.id) : []; save(); openNpcStripCfg(); }

export function renderNpcLib() {
  const q = (document.getElementById('npcLibQ') || {}).value || '';
  const cat = (document.getElementById('npcLibCat') || {}).value || '';
  const list = D.npcs.filter(n => {
    if (cat && n.category !== cat) return false;
    if (q && !n.name.includes(q) && !(n.desc || '').includes(q)) return false;
    return true;
  });
  
  const el = document.getElementById('npcLibList'); 
  const detailEl = document.getElementById('npcLibDetail');
  if (!el || !detailEl) return;
  
  if (el.parentElement) {
    el.parentElement.style.display = 'flex';
    el.parentElement.style.flexDirection = 'row';
    el.parentElement.style.height = '100%';
    el.parentElement.style.overflow = 'hidden';
  }
  
  el.style.width = '220px';
  el.style.flexShrink = '0';
  el.style.overflowY = 'auto';
  el.style.padding = '10px';
  el.style.borderRight = '1px solid var(--border)';
  
  detailEl.style.flex = '1';
  detailEl.style.overflowY = 'auto';
  detailEl.style.padding = '10px 20px';
  
  el.innerHTML = list.length ? list.map(n => {
    const badge = n.category === 'npc' ? 'NPC' : n.category === 'monster' ? '怪物' : '其他';
    return renderEntityCard({
      id: n.id,
      dragType: 'npc',
      name: n.name,
      color: n.color || '#b27cd8',
      badge: badge,
      disposition: n.disposition,
      roomId: n.roomId,
      isDead: n.dead,
      isSelected: uiState.selNpcId === n.id,
      rooms: D.rooms,
      onSelect: `selectNpc('${n.id}')`,
      onRoomChange: `npcSetRoom('${n.id}',this.value)`,
      onDuplicate: `duplicateNpc('${n.id}')`,
      onDelete: `deleteNpc('${n.id}')`,
      onToggleDead: `toggleNpcDead('${n.id}')` // 传入死亡切换事件
    });
  }).join('') : '<p class="hint npc-lib-empty">暂无NPC/怪物，点击左上角新增</p>';
    
  renderNpcDetail();
}

export function selectNpc(id) { uiState.selNpcId = id; renderNpcLib(); }
export function addNpcToLib() { const n = newNpc(); D.npcs.push(n); uiState.selNpcId = n.id; save(); }

export function deleteNpc(id) {
  if (!confirm('确认删除此NPC/怪物？')) return;
  D.npcs = D.npcs.filter(n => n.id !== id);
  D.ui.npcVisible = D.ui.npcVisible.filter(i => i !== id);
  if (uiState.selNpcId === id) uiState.selNpcId = D.npcs.length ? D.npcs[D.npcs.length - 1].id : null;
  save();
}

export function renderNpcDetail() {
  const el = document.getElementById('npcLibDetail'); if (!el) return;
  const n = D.npcs.find(x => x.id === uiState.selNpcId);
  if (!n) { el.innerHTML = '<div class="npc-detail-empty">← 从左侧选择一个 NPC/怪物</div>'; return; }

  const roomOpts = `<option value="">📍 未定位</option>` + D.rooms.map(r => `<option value="${r.id}"${r.id === n.roomId ? ' selected' : ''}>${esc(r.name || '未命名')} (${r.x},${r.y})</option>`).join('');
  const attrsHtml = renderAttrEditRows('npc', n.id, n.attrs, 'npcAttrEdit', 'npcAttrDel');

  const dialogsHtml = (n.dialogs || []).map((d, i) => {
    if (!uiState.edit) {
      const resolved = resolveDialogLine(d.line);
      return `<div class="item compact npc-dialog-copy${d.used ? ' used' : ''}" onclick="copyNpcDialog('${n.id}',${i})"><div class="row"><span class="tag static npc">${esc(d.trigger) || '对话'}</span><div class="memo"><span class="cd ${d.line.trim() ? '' : 'emp'}">${d.line.trim() ? esc(resolved) : '（暂无台词）'}</span></div><button class="dlg-used-btn${d.used ? ' on' : ''}" title="${d.used ? '已使用，点击撤销' : '标记为已使用'}" onclick="event.stopPropagation();npcDialogToggleUsed('${n.id}',${i})">${d.used ? '✅' : '○'}</button><span class="copyi">📋</span></div></div>`;
    }
    return `<div class="npc-dialog-row${d.used ? ' used' : ''}"><div class="npc-dialog-inner"><input value="${esc(d.trigger)}" placeholder="触发条件" class="npc-dialog-trigger" onchange="npcDialogEdit('${n.id}',${i},'trigger',this.value)"><textarea placeholder="台词内容…支持魔术字 {{玩家名}}" onchange="npcDialogEdit('${n.id}',${i},'line',this.value)">${esc(d.line)}</textarea></div><button class="dlg-used-btn${d.used ? ' on' : ''}" title="${d.used ? '已使用，点击撤销' : '标记为已使用'}" onclick="npcDialogToggleUsed('${n.id}',${i})">${d.used ? '✅' : '○'}</button><button onclick="npcDialogDel('${n.id}',${i})">✕</button></div>`;
  }).join('');

  el.innerHTML = `<div class="npc-detail-form">
    <div class="npc-detail-header">
      <h3>${esc(n.name)}</h3>
      <button onclick="duplicateNpc('${n.id}')" title="复制此NPC生成副本">⧉ 复制</button>
      <button onclick="copyNpcDesc('${n.id}')">📋 复制描述</button>
    </div>
    <div class="npc-row">
      <div class="npc-field"><label>名称</label>
        <input value="${esc(n.name)}" onchange="npcEdit('${n.id}','name',this.value); window.dispatchEvent(new Event('trpg-ui-update'))">
      </div>
      <div class="npc-field"><label>类型</label>
        <select onchange="npcEdit('${n.id}','category',this.value); window.dispatchEvent(new Event('trpg-ui-update'))">
          <option value="npc"${n.category === 'npc' ? ' selected' : ''}>NPC</option>
          <option value="monster"${n.category === 'monster' ? ' selected' : ''}>怪物</option>
          <option value="other"${n.category === 'other' ? ' selected' : ''}>其他</option>
        </select>
      </div>
      <div class="npc-field"><label>立场</label>
        <select onchange="npcEdit('${n.id}','disposition',this.value); window.dispatchEvent(new Event('trpg-ui-update'))">
          <option${n.disposition === '友好' ? ' selected' : ''}>友好</option>
          <option${n.disposition === '中立' ? ' selected' : ''}>中立</option>
          <option${n.disposition === '敌对' ? ' selected' : ''}>敌对</option>
        </select>
      </div>
    </div>
    <div class="npc-row">
      <div class="npc-field"><label>标记颜色</label>
        <input type="color" value="${n.color || '#b27cd8'}" onchange="npcEdit('${n.id}','color',this.value); window.dispatchEvent(new Event('trpg-ui-update'))" class="npc-color-input">
      </div>
      <div class="npc-field npc-field-wide"><label>当前所在房间</label>
        <select onchange="npcSetRoom('${n.id}',this.value)">${roomOpts}</select>
      </div>
    </div>
    <div class="npc-field"><label>外观与描述</label>
      <textarea rows="4" placeholder="外貌、气质、玩家可见描述…" onchange="npcEdit('${n.id}','desc',this.value)">${esc(n.desc)}</textarea>
    </div>
    <div class="npc-field"><label>DM 备注（玩家不可见）</label>
      <textarea rows="3" placeholder="秘密动机、隐藏信息…" onchange="npcEdit('${n.id}','dmNote',this.value)">${esc(n.dmNote)}</textarea>
    </div>
    <div class="npc-field"><label>属性</label>
      <div class="npc-attrs">${attrsHtml}</div>
      <button class="npc-add-btn" onclick="npcAttrAdd('${n.id}')">＋ 添加属性</button>
    </div>
    <div class="npc-field"><label>预设对话</label>
      <div class="npc-dialogs">${dialogsHtml}</div>
      <button class="npc-add-btn" onclick="npcDialogAdd('${n.id}')">＋ 添加对话</button>
    </div>
  </div>`;
}

export function npcEdit(id, field, val) { const n = D.npcs.find(x => x.id === id); if (!n) return; n[field] = val; save(); }

export function npcSetRoom(id, rid) {
  const n = D.npcs.find(x => x.id === id); if (!n) return;
  const old = n.roomId;
  n.roomId = rid;
  addLog('move', `[NPC]${n.name}：${rname(old)} → ${rname(rid)}`, n.color || '#b27cd8');
  save();
  window.dispatchEvent(new Event('trpg-ui-update'));
}

export function npcAttrEdit(id, idx, field, val) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.attrs[idx][field] = val; save(); }
export function npcAttrAdd(id) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.attrs.push({ id: uid(), name: '新属性', val: '0', show: true }); save(); }
export function npcAttrDel(id, idx) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.attrs.splice(idx, 1); save(); }
export function npcDialogEdit(id, idx, field, val) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.dialogs[idx][field] = val; save(); }
export function npcDialogAdd(id) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.dialogs.push({ id: uid(), trigger: '', line: '', used: false }); save(); }
export function npcDialogDel(id, idx) { const n = D.npcs.find(x => x.id === id); if (!n) return; n.dialogs.splice(idx, 1); save(); }
export function npcDialogToggleUsed(id, idx) { const n = D.npcs.find(x => x.id === id); if (!n) return; const d = n.dialogs[idx]; if (!d) return; d.used = !d.used; save(); toast(d.used ? '✅ 已标记为已使用' : '○ 已取消使用标记'); }
export function copyNpcDesc(id) { const n = D.npcs.find(x => x.id === id); if (!n) return; if (!n.desc.trim()) { toast('该NPC还没有描述'); return; } copyText(n.desc).then(ok => toast(ok ? '📋 已复制描述' : '复制失败')); }
export function copyNpcDialog(npcId, idx) { const n = D.npcs.find(x => x.id === npcId); if (!n) return; const d = n.dialogs[idx]; if (!d) return; if (!d.line.trim()) { toast('这条对话没有台词'); return; } const resolved = resolveDialogLine(d.line); copyText(resolved).then(ok => toast(ok ? '📋 已复制台词' : '复制失败')); }

export function toggleNpcDead(id) { 
  const n = D.npcs.find(x => x.id === id); if (!n) return; 
  n.dead = !n.dead; 
  save(); 
  toast(n.dead ? `💀 ${n.name} 已标记死亡` : `✅ ${n.name} 已取消死亡标记`); 
  window.dispatchEvent(new Event('trpg-ui-update')); // 触发全局刷新，卡片立刻变灰
}

Object.assign(window, {
  goNpcDetail, openNpcStripCfg, npcVisToggle, npcStripCheckAll, selectNpc, addNpcToLib, deleteNpc, duplicateNpc,
  npcEdit, npcSetRoom, npcAttrEdit, npcAttrAdd, npcAttrDel, npcDialogEdit, npcDialogAdd, npcDialogDel, npcDialogToggleUsed,
  copyNpcDesc, copyNpcDialog, toggleNpcDead, renderNpcLib
});