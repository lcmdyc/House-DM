// js/npc.js — NPC侧栏 + NPC资料库 + NPC详情 (ES6 Module)
import { D, uid, esc, rname, pname } from './data.js';
// 💡 修复：引入了 parseText
import { uiState, save, toast, copyText, addLog, roomSel, switchTab, switchLibTab, getAllItems, toggleItemOwner, parseText } from './core.js';
import { renderAttrChips } from './attr.js';
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
    gender: '', skills: [], goals: [], textAttrs: [],
    attrs: [{ id: uid(), name: 'HP', val: '10', show: true }, { id: uid(), name: 'AC', val: '10', show: true }]
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
  const idx = D.npcs.findIndex(x => x.id === id);
  D.npcs.splice(idx + 1, 0, copy);
  uiState.selNpcId = copy.id;
  save(); toast(`📋 已复制为「${copy.name}」`);
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
      onToggleDead: `toggleNpcDead('${n.id}')`
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
  
  const nIdx = D.npcs.findIndex(x => x.id === uiState.selNpcId);
  if (nIdx === -1) { el.innerHTML = '<div class="npc-detail-empty">← 从左侧选择一个 NPC/怪物</div>'; return; }
  const n = D.npcs[nIdx];

  if (n.textAttrs && n.textAttrs.some(t => t.label === '性别' || t.label === '姓名')) {
    n.textAttrs = n.textAttrs.filter(t => t.label !== '性别' && t.label !== '姓名');
  }

  const isEdit = uiState.edit;
  
  // 💡 修复：在这里使用 parseText(esc(val))，这样显示的是解析后的名字，this.innerText 复制的也是纯文本名字
  const copyHtml = (val, fallback = '暂无') => `<div class="u-copy-text" onclick="copyText(this.innerText).then(ok=>toast(ok?'📋 已复制':'复制失败'))">${val ? parseText(esc(val)) : `<span class="hint">${fallback}</span>`}</div>`;
  const copyListHtml = (arr, fallback = '暂无') => arr.length ? `<div class="u-copy-text" onclick="copyText(this.innerText).then(ok=>toast(ok?'📋 已复制':'复制失败'))">${parseText(esc(arr.join(' / ')))}</div>` : `<div class="hint" style="font-size:12px">${fallback}</div>`;

  el.innerHTML = `
    <div class="u-panel">
      <div class="u-col-left">
        <div class="u-card">
          <div class="u-card-title"><span>👤 基础信息</span></div>
          <div class="u-grid-2">
            <div class="u-field"><label>姓名</label><input class="u-input" value="${esc(n.name)}" onchange="npcEdit('${n.id}','name',this.value);window.dispatchEvent(new Event('trpg-ui-update'))" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>性别</label><input class="u-input" value="${esc(n.gender)}" onchange="npcEdit('${n.id}','gender',this.value)" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>身份类型</label>
              <select class="u-select" onchange="npcEdit('${n.id}','category',this.value);window.dispatchEvent(new Event('trpg-ui-update'))" ${isEdit?'':'disabled'}>
                <option value="npc" ${n.category==='npc'?'selected':''}>NPC</option>
                <option value="monster" ${n.category==='monster'?'selected':''}>怪物</option>
                <option value="other" ${n.category==='other'?'selected':''}>其他</option>
              </select>
            </div>
            <div class="u-field"><label>立场</label><input class="u-input" value="${esc(n.disposition)}" onchange="npcEdit('${n.id}','disposition',this.value);window.dispatchEvent(new Event('trpg-ui-update'))" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>标记颜色</label><input class="u-input" type="color" value="${esc(n.color)}" onchange="npcEdit('${n.id}','color',this.value);window.dispatchEvent(new Event('trpg-ui-update'))" style="height:35px;padding:2px" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>当前所在房间</label><select class="u-select" onchange="npcSetRoom('${n.id}',this.value)">${roomSel(n.roomId)}</select></div>
          </div>
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📋 模组预设</span><span class="hint">由作者设定</span></div>
          <div class="u-field"><label>身份背景/描述</label>
            ${isEdit ? `<textarea class="u-textarea" onchange="npcEdit('${n.id}','desc',this.value)">${esc(n.desc)}</textarea>` : copyHtml(n.desc)}
          </div>
          <div class="u-field"><label>技能/道具 ${isEdit ? `<button class="u-btn-sm" onclick="D.npcs[${nIdx}].skills.push('');save();renderNpcDetail()">+ 添加</button>` : ''}</label>
            ${isEdit 
              ? n.skills.map((s, idx) => `<div class="u-row"><input class="u-input" value="${esc(s)}" onchange="D.npcs[${nIdx}].skills[${idx}]=this.value;save()"><button class="u-del-btn" onclick="D.npcs[${nIdx}].skills.splice(${idx},1);save();renderNpcDetail()">✕</button></div>`).join('')
              : copyListHtml(n.skills)
            }
          </div>
          <div class="u-field"><label>角色目的 ${isEdit ? `<button class="u-btn-sm" onclick="D.npcs[${nIdx}].goals.push('');save();renderNpcDetail()">+ 添加</button>` : ''}</label>
            ${isEdit 
              ? n.goals.map((g, idx) => `<div class="u-row"><input class="u-input" value="${esc(g)}" onchange="D.npcs[${nIdx}].goals[${idx}]=this.value;save()"><button class="u-del-btn" onclick="D.npcs[${nIdx}].goals.splice(${idx},1);save();renderNpcDetail()">✕</button></div>`).join('')
              : copyListHtml(n.goals)
            }
          </div>
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📊 数值属性</span>${isEdit ? `<button class="u-btn-sm" onclick="npcAttrAdd('${n.id}');renderNpcDetail()">+ 添加</button>` : ''}</div>
          ${(n.attrs || []).map((a, idx) => `
            <div class="u-row">
              <input class="u-input" value="${esc(a.name)}" onchange="npcAttrEdit('${n.id}',${idx},'name',this.value)" style="flex:1" ${isEdit?'':'disabled'}>
              <div class="u-num-ctrl">
                <button onclick="window.onWheelAdj({isUp:false},'npc','${n.id}','${a.id}')">-</button>
                <input value="${+a.val || 0}" onwheel="window.onWheelAdj(event,'npc','${n.id}','${a.id}')" onchange="npcAttrEdit('${n.id}',${idx},'val',this.value)">
                <button onclick="window.onWheelAdj({isUp:true},'npc','${n.id}','${a.id}')">+</button>
              </div>
              ${isEdit ? `<button class="u-del-btn" onclick="npcAttrDel('${n.id}',${idx});renderNpcDetail()">✕</button>` : '<button class="u-del-btn" style="visibility:hidden">✕</button>'}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="u-col-right">
        <div class="u-card">
          <div class="u-card-title"><span>🔒 DM 备注</span><span class="hint">不计入导出</span></div>
          ${isEdit 
            ? `<textarea class="u-textarea" placeholder="DM 专属备注..." onchange="npcEdit('${n.id}','dmNote',this.value)">${esc(n.dmNote)}</textarea>`
            : copyHtml(n.dmNote, '暂无备注')
          }
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📝 文本属性</span>${isEdit ? `<button class="u-btn-sm" onclick="D.npcs[${nIdx}].textAttrs.push({label:'',val:''});save();renderNpcDetail()">+ 添加</button>` : ''}</div>
          <div style="display:flex; flex-direction:column;">
            ${(n.textAttrs || []).map((t, idx) => `
              ${isEdit ? `
                <div class="u-text-attr-row">
                  <input class="u-input" placeholder="类目" value="${esc(t.label)}" onchange="D.npcs[${nIdx}].textAttrs[${idx}].label=this.value;save()" style="width:70px; font-weight:bold; padding:4px 6px;">
                  <textarea class="u-textarea" placeholder="内容..." onchange="D.npcs[${nIdx}].textAttrs[${idx}].val=this.value;save()" style="flex:1; min-height:28px; padding:4px 6px;">${esc(t.val || '')}</textarea>
                  <button class="u-del-btn" onclick="D.npcs[${nIdx}].textAttrs.splice(${idx},1);save();renderNpcDetail()">✕</button>
                </div>
              ` : `
                <div class="u-field" style="margin-bottom:8px;">
                  <label>${esc(t.label)}</label>
                  ${copyHtml(t.val)}
                </div>
              `}
            `).join('')}
          </div>
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>🎒 线索/道具栏</span></div>
          ${isEdit ? `
          <select class="u-select" onchange="if(this.value){ toggleItemOwner(this.value, '${n.id}'); this.value=''; renderNpcDetail(); }">
            <option value="">+ 分配现有物资给TA...</option>
            ${getAllItems().map(it => `<option value="${it.id}">${esc(it.name)}</option>`).join('')}
          </select>` : ''}
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
            ${getAllItems().filter(it => it.owners.includes(n.id)).map(it => `
              <div class="u-item-row" style="flex-direction:column; align-items:stretch; gap:6px; ${it.consumed ? 'opacity:0.6;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:bold; color:var(--${it.type==='clue'?'clue':'item'})">
                    ${esc(it.name)} ${it.consumed ? '<span style="font-size:11px;color:var(--mute);font-weight:normal;">(已消耗)</span>' : ''}
                  </span>
                  <div style="display:flex; gap:6px;">
                    <button class="u-btn-sm" onclick="window.toggleConsumed('${it.id}')">${it.consumed ? '恢复' : '消耗'}</button>
                    ${isEdit ? `<button class="u-btn-sm" onclick="toggleItemOwner('${it.id}', '${n.id}');">移除</button>` : ''}
                  </div>
                </div>
                ${it.desc ? `<div style="font-size:12px; color:var(--mute); background:rgba(0,0,0,0.15); padding:6px 8px; border-radius:4px; white-space:pre-wrap; word-break:break-word;">${parseText(esc(it.desc))}</div>` : ''}
              </div>
            `).join('')}
          </div>
        </div>
      </div>
    </div>
  `;
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

export function toggleNpcDead(id) { 
  const n = D.npcs.find(x => x.id === id); if (!n) return; 
  n.dead = !n.dead; 
  save(); 
  toast(n.dead ? `💀 ${n.name} 已标记死亡` : `✅ ${n.name} 已取消死亡标记`); 
  window.dispatchEvent(new Event('trpg-ui-update'));
}

Object.assign(window, {
  goNpcDetail, openNpcStripCfg, npcVisToggle, npcStripCheckAll, selectNpc, addNpcToLib, deleteNpc, duplicateNpc,
  npcEdit, npcSetRoom, npcAttrEdit, npcAttrAdd, npcAttrDel, toggleNpcDead, renderNpcLib
});
