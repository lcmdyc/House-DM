// js/players.js — 玩家状态条 + 背景资料库 + 车卡系统 (ES6 Module)
import { D, uid, esc, blankBg, cardUsed, pname, pcolor, rname } from './data.js';
import { uiState, save, toast, copyText, addLog, roomSel, switchTab, switchLibTab } from './core.js';
import { renderAttrChips, renderAttrEditRows } from './attr.js';
import { renderEntityCard } from './card.js';

window.addEventListener('trpg-ui-update', () => {
  renderStrip();
  updatePlayerBar();
  if (document.getElementById('libTabBg')?.classList.contains('on')) renderBg();
  if (document.getElementById('playersDlg')?.open) renderPlayersBox();
});

window.addEventListener('trpg-data-loaded', () => {
  renderStrip();
  updatePlayerBar();
});

window.addEventListener('trpg-lib-tab-changed', (e) => {
  if (e.detail.sub === 'bg') renderBg();
});

export function renderStrip() {
  const s = document.getElementById('strip'); 
  if (!s || !D) return;

  let html = `<div class="sthead">
    <span style="margin-right:auto">👥 玩家属性</span>
    <button title="设置显示哪些属性" onclick="openStripCfg()">⚙</button>
  </div>`;

  html += D.players.map((_, i) => {
    const b = D.bg[i]; if (!b) return '';
    const dead = b.dead;
    const cardChipsHtml = renderAttrChips('player', i, D.cardCfg?.attrs || [], b.card.vals);
    const presetChipsHtml = renderAttrChips('preset', i, b.presetAttrs || []);
    const allChips = cardChipsHtml + presetChipsHtml;
    const attrsHtml = allChips ? `<div class="as">${allChips}</div>` : '';
    
    // 状态条显示逻辑：如果有角色名，显示"角色名(玩家名)"；否则只显示玩家名
    const dispName = b.card.name ? `${b.card.name} (${pname(i)})` : pname(i);

    return `<div class="pc${dead ? ' dead' : ''}" style="border-top-color:${pcolor(i)}" onclick="openBg(${i})">
      <div class="pn-row">
        <span class="pn">${esc(dispName)}${dead ? ' <span class="dead-badge">💀</span>' : ''}</span>
        <select class="prm" onclick="event.stopPropagation()" onchange="setPlayerRoom(${i},this.value)">
          ${roomSel(b.roomId)}
        </select>
      </div>
      ${attrsHtml}
    </div>`;
  }).join('');

  s.innerHTML = html;
}

export function setPlayerRoom(i, rid) {
  const old = D.bg[i].roomId || '';
  if (old === rid) return;
  D.bg[i].roomId = rid;
  addLog('move', `${pname(i)}：${rname(old)} → ${rname(rid)}`, pcolor(i));
  save(); 
  window.dispatchEvent(new Event('trpg-ui-update'));
}

export function duplicatePlayer(i) {
  const srcName = D.players[i];
  const baseName = n => n.replace(/[A-Z]$/, '');
  const base = baseName(srcName);
  const siblings = D.players.filter(n => baseName(n) === base);
  const usedLetters = siblings.map(n => n.slice(base.length)).filter(s => /^[A-Z]$/.test(s));
  
  let suffix = '';
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    if (!usedLetters.includes(letter)) { suffix = letter; break; }
  }
  const newName = base + suffix;

  const srcBg = JSON.parse(JSON.stringify(D.bg[i]));
  srcBg.roomId = '';
  srcBg.dead = false;
  if (Array.isArray(srcBg.presetAttrs)) {
    srcBg.presetAttrs = srcBg.presetAttrs.map(a => ({ ...a, id: uid() }));
  }

  const newIdx = i + 1;
  D.players.splice(newIdx, 0, newName);
  D.bg.splice(newIdx, 0, srcBg);

  const fix = idx => idx >= newIdx ? idx + 1 : idx;
  D.pool.forEach(it => { it.owners = it.owners.map(fix); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.map(fix); }));

  uiState.bgSel = newIdx;
  save();
  toast(`✅ 已复制「${srcName}」→「${newName}」`);
}

export function updatePlayerBar() {
  const btn = document.getElementById('playersBtn');
  if (btn) btn.textContent = `👥 玩家(${D.players.length})`;
}

export function openPlayers() {
  renderPlayersBox();
  document.getElementById('playersDlg').showModal();
}

export function closePlayers() { document.getElementById('playersDlg').close(); }

export function renderPlayersBox() {
  const box = document.getElementById('playersBox'); if (!box) return;
  const cnt = document.getElementById('plCount');
  if (cnt) cnt.textContent = `共 ${D.players.length} 人`;
  box.innerHTML = D.players.map((_, i) => {
    const b = D.bg[i];
    return `<div class="player-row" style="border-left:3px solid ${pcolor(i)}">
      <input type="text" value="${esc(pname(i))}" placeholder="玩家姓名" onchange="D.players[${i}]=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
      <input type="color" value="${b.color}" onchange="D.bg[${i}].color=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
      <button class="danger" onclick="removePlayer(${i})" ${D.players.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>`;
  }).join('');
}

export function addPlayer() {
  const i = D.players.length;
  D.players.push('玩家' + (i + 1));
  if (!D.bg[i]) D.bg[i] = blankBg(i);
  save();
}

export function removePlayer(i) {
  if (D.players.length <= 1) { toast('至少保留1名玩家'); return; }
  if (!confirm(`确定移除「${pname(i)}」？`)) return;
  D.players.splice(i, 1);
  D.bg.splice(i, 1);
  const total = D.players.length;
  D.pool.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); }));
  if (uiState.bgSel >= total) uiState.bgSel = total - 1;
  save();
}

export function setPlayerCount(n) {
  n = Math.max(1, +n);
  while (D.players.length < n) {
    const i = D.players.length;
    D.players.push('玩家' + (i + 1));
    if (!D.bg[i]) D.bg[i] = blankBg(i);
  }
  D.players.length = n;
  D.bg.length = n;
  const total = D.players.length;
  D.pool.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); }));
  if (uiState.bgSel >= total) uiState.bgSel = total - 1;
  save();
}

export function openBg(i) {
  uiState.bgSel = (i !== undefined) ? i : uiState.bgSel;
  switchTab('library');
  switchLibTab('bg');
}

export function renderBg() {
  const navEl  = document.getElementById('bgNav');
  const mainEl = document.getElementById('bgMain');
  if (!navEl || !mainEl) return;
  
  if (navEl.parentElement) {
    navEl.parentElement.style.display = 'flex';
    navEl.parentElement.style.flexDirection = 'row';
    navEl.parentElement.style.height = '100%';
    navEl.parentElement.style.overflow = 'hidden';
  }
  
  navEl.style.width = '220px';
  navEl.style.flexShrink = '0';
  navEl.style.overflowY = 'auto';
  navEl.style.padding = '10px';
  navEl.style.borderRight = '1px solid var(--border)';
  
  mainEl.style.flex = '1';
  mainEl.style.overflowY = 'auto';
  mainEl.style.padding = '10px 20px';
  
  if (!D.bg[uiState.bgSel]) uiState.bgSel = 0;
  const b = D.bg[uiState.bgSel];
  if (!b) return;

  navEl.innerHTML = D.players.map((_, i) => {
    const bg = D.bg[i];
    // 左侧列表显示逻辑：如果有角色名，显示"角色名(玩家名)"；否则只显示玩家名
    const dispName = bg.card.name ? `${bg.card.name} (${pname(i)})` : pname(i);
    
    return renderEntityCard({
      id: i,
      dragType: 'player',
      name: dispName,
      color: pcolor(i),
      badge: bg.ho || '玩家',
      disposition: '',
      roomId: bg.roomId,
      isDead: bg.dead,
      isSelected: uiState.bgSel === i,
      rooms: D.rooms,
      onSelect: `uiState.bgSel=${i};renderBg()`,
      onRoomChange: `setPlayerRoom(${i},this.value)`,
      onDuplicate: `duplicatePlayer(${i})`,
      onDelete: `removePlayer(${i})`,
      onToggleDead: `togglePlayerDeadLib(${i})`
    });
  }).join('');

  mainEl.innerHTML = `
    ${bgTopBar(uiState.bgSel)}
    <div class="bg-two-col" style="display:flex; gap:20px; flex-wrap:wrap; padding-bottom: 20px;">
      <div class="bg-col bg-col-preset" style="flex:1; min-width:300px;">${bgPresetSection(uiState.bgSel)}</div>
      <div class="bg-col bg-col-card" style="flex:1; min-width:300px;">${bgCardSection(uiState.bgSel)}</div>
    </div>`;
}

function bgTopBar(i) {
  const b = D.bg[i];
  return `<div class="bg-topbar" style="margin-bottom:15px;">
    <!-- 这里专门填【玩家名(皮下)】 -->
    <input class="bg-name-input" type="text" value="${esc(D.players[i])}" placeholder="玩家(皮下)称呼" title="玩家(皮下)称呼"
      onchange="D.players[${i}]=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
    
    <!-- 这里专门填【身份/HO】 -->
    <input type="text" value="${esc(b.ho || '')}" placeholder="身份(如HO1)" title="身份/HO"
      style="width:80px; background:var(--bg-dark); border:1px solid var(--border); color:var(--fg); border-radius:4px; padding:4px 6px; margin-right:6px;" 
      onchange="D.bg[${i}].ho=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
    
    <input type="color" value="${b.color}" title="标记颜色" 
      onchange="D.bg[${i}].color=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
      
    <select class="bg-room-sel" onchange="setPlayerRoom(${i},this.value)">${roomSel(b.roomId)}</select>
  </div>`;
}

export function togglePlayerDeadLib(i) {
  D.bg[i].dead = !D.bg[i].dead;
  save();
  toast(D.bg[i].dead ? `💀 ${pname(i)} 已标记死亡` : `✅ ${pname(i)} 已取消死亡标记`);
  window.dispatchEvent(new Event('trpg-ui-update'));
}

export function copyPreset(btn) {
  const card  = btn.closest('[data-copy]');
  const text  = card ? card.getAttribute('data-copy') : '';
  const label = btn.getAttribute('data-label') || '内容';
  copyText(text).then(ok => toast(ok ? `📋 已复制${label}` : '复制失败'));
}

function presetCardHead(icon, title, label) {
  if (!uiState.edit) return `<h3 class="preset-card-h3">${icon} ${title} <button class="preset-copy-btn" data-label="${label}" onclick="copyPreset(this)">📋 复制</button></h3>`;
  return `<h3>${icon} ${title}</h3>`;
}

function bgPresetSection(i) {
  return `<div class="bg-section bg-section-preset">
    <div class="bg-section-head"><span class="bg-section-icon">📋</span><span class="bg-section-title">模组预设</span><span class="bg-section-hint">由作者设定</span></div>
    ${bgIdentityCard(i)}${bgSkillsCard(i)}${bgGoalsCard(i)}${bgPresetAttrsCard(i)}${bgDmNoteCard(i)}
  </div>`;
}

function bgIdentityCard(i) {
  const val = D.bg[i].identity || '';
  if (!uiState.edit) return `<div class="card preset-readonly" data-copy="${esc(val)}">${presetCardHead('🪪', '身份描述', '身份描述')}<div class="preset-text">${val ? esc(val).replace(/\n/g, '<br>') : '<span class="hint">暂无</span>'}</div></div>`;
  return `<div class="card"><h3>🪪 身份描述</h3><textarea class="identity-ta" placeholder="角色背景、身份设定…" onchange="D.bg[${i}].identity=this.value;save()">${esc(val)}</textarea></div>`;
}

function bgSkillsCard(i) {
  const skills = D.bg[i].skills || [];
  if (!uiState.edit) return `<div class="card preset-readonly" data-copy="${esc(skills.join('\n'))}">${presetCardHead('⚔️', '技能/道具', '技能/道具')}${skills.length ? `<ul class="preset-list">${skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>` : '<p class="hint">暂无</p>'}</div>`;
  const rows = skills.map((sk, idx) => `<div class="skill-row"><input type="text" value="${esc(sk)}" placeholder="技能/道具" onchange="D.bg[${i}].skills[${idx}]=this.value;save()"><button class="danger" onclick="D.bg[${i}].skills.splice(${idx},1);save()">✕</button></div>`).join('');
  return `<div class="card"><h3>⚔️ 技能/道具 <button onclick="D.bg[${i}].skills.push('');save()">＋ 添加</button></h3>${rows || '<p class="hint">暂无</p>'}</div>`;
}

function bgGoalsCard(i) {
  const goals = D.bg[i].goals || [];
  if (!uiState.edit) return `<div class="card preset-readonly" data-copy="${esc(goals.join('\n'))}">${presetCardHead('🎯', '角色目的', '角色目的')}${goals.length ? `<ul class="preset-list">${goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>` : '<p class="hint">暂无</p>'}</div>`;
  const rows = goals.map((g, idx) => `<div class="goal-row"><input type="text" value="${esc(g)}" placeholder="目标/动机" onchange="D.bg[${i}].goals[${idx}]=this.value;save()"><button class="danger" onclick="D.bg[${i}].goals.splice(${idx},1);save()">✕</button></div>`).join('');
  return `<div class="card"><h3>🎯 角色目的 <button onclick="D.bg[${i}].goals.push('');save()">＋ 添加</button></h3>${rows || '<p class="hint">暂无</p>'}</div>`;
}

function bgPresetAttrsCard(i) {
  if (!D.bg[i].presetAttrs) D.bg[i].presetAttrs = [];
  const rows = renderAttrEditRows('preset', i, D.bg[i].presetAttrs, 'bgPresetAttrEdit', 'bgPresetAttrDel');
  return `<div class="card"><h3>📊 特殊属性 <button onclick="D.bg[${i}].presetAttrs.push({id:uid(),name:'新属性',val:0,show:true});save()">＋ 添加</button></h3><div class="attr-list">${rows}</div></div>`;
}

export function bgPresetAttrEdit(i, idx, field, val) { D.bg[i].presetAttrs[idx][field] = val; save(); }
export function bgPresetAttrDel(i, idx) { D.bg[i].presetAttrs.splice(idx, 1); save(); }

function bgDmNoteCard(i) {
  const val = D.bg[i].dmNote || '';
  return `<div class="card card-dm-note"><h3>🔒 DM 备注 <span class="bg-section-hint">不计入导出</span></h3><textarea class="dmnote-ta" placeholder="DM 专属备注，不会被复制或导出给玩家…" onchange="D.bg[${i}].dmNote=this.value;save()">${esc(val)}</textarea></div>`;
}

function bgCardSection(i) {
  return `<div class="bg-section bg-section-card">
    <div class="bg-section-head"><span class="bg-section-icon">🎴</span><span class="bg-section-title">玩家车卡</span><span class="bg-section-hint">由玩家填写</span></div>
    ${bgBasicInfoCard(i)}${bgAttrsCard(i)}${bgItemsCard(i)}${bgOtherCard(i)}
  </div>`;
}

function bgBasicInfoCard(i) {
  const fields = D.bg[i].card.infoFields || [];
  const fieldRows = fields.map((f, idx) => `<div class="custom-field-row"><input type="text" class="cf-key" value="${esc(f.key)}" placeholder="字段名" onchange="D.bg[${i}].card.infoFields[${idx}].key=this.value;save()"><input type="text" class="cf-val" value="${esc(f.val)}" placeholder="内容" onchange="D.bg[${i}].card.infoFields[${idx}].val=this.value;save()"><button class="danger" onclick="D.bg[${i}].card.infoFields.splice(${idx},1);save()">✕</button></div>`).join('');
  return `<div class="card">
    <h3>📝 基础信息 <button onclick="D.bg[${i}].card.infoFields.push({key:'',val:''});save()">＋ 添加</button></h3>
    <div class="info-name-row">
      <div class="info-field info-field-name">
        <label>角色姓名(PC)</label>
        <!-- 这里专门填【角色名(PC)】，彻底与玩家名解绑 -->
        <input type="text" value="${esc(D.bg[i].card.name || '')}" placeholder="角色在游戏中的名字" 
          onchange="D.bg[${i}].card.name=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
      </div>
    </div>
    <div class="info-custom-fields">${fieldRows || '<p class="hint">暂无其他信息，点击＋添加</p>'}</div>
  </div>`;
}

function bgAttrsCard(i) {
  const b = D.bg[i], c = b.card, cfg = D.cardCfg, used = cardUsed(c), left = cfg.points - used;
  const attrRows = cfg.attrs.filter(a => a.show).map(a => {
    const v = +c.vals[a.id] || 0;
    return `<div class="attr-row"><span class="attr-name">${esc(a.name)}</span><button onclick="window.onWheelAdj({isUp:false},'player',${i},'${a.id}')" ${v <= 0 ? 'disabled' : ''}>－</button><span class="attr-val" title="${esc(a.name)}（滚轮增减）" onwheel="window.onWheelAdj(event,'player',${i},'${a.id}')">${v}</span><button onclick="window.onWheelAdj({isUp:true},'player',${i},'${a.id}')" ${left <= 0 && v === 0 ? 'disabled' : ''}>＋</button><button class="attr-del-btn" onclick="D.bg[${i}].card.vals['${a.id}']=0;save()" title="清零">×</button></div>`;
  }).join('');
  const cfgRows = cfg.attrs.map((a, idx) => `<div class="cfg-row"><input type="text" value="${esc(a.name)}" placeholder="属性名" onchange="D.cardCfg.attrs[${idx}].name=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))"><label><input type="checkbox" ${a.show ? 'checked' : ''} onchange="D.cardCfg.attrs[${idx}].show=this.checked;save()"> 显示</label><button class="danger" onclick="delCardAttr(${idx})">✕</button></div>`).join('');
  return `<div class="card" id="bgAttrsCard_${i}"><h3>🎲 属性分配 <span class="pts-badge" style="${left < 0 ? 'color:var(--danger)' : ''}">已用 ${used}　剩余 ${left}</span> <button onclick="openCardCfg()" title="配置属性">⚙</button> <button onclick="addCardAttr()">＋ 新属性</button></h3><div class="pts-total-row"><label>可分配点数</label><input class="pts-input" type="number" min="1" max="999" value="${cfg.points}" onchange="D.cardCfg.points=+this.value||40;save()"><span>点</span></div><div class="attr-list" id="bgAttrList_${i}">${attrRows || '<p class="hint">暂无属性，点击＋新属性添加</p>'}</div><dialog id="cardCfgDlg" class="dlg"><div class="dlg-head"><b>⚙ 车卡配置</b><button onclick="document.getElementById('cardCfgDlg').close()">✕</button></div><label>总点数上限<input type="number" min="1" max="999" value="${cfg.points}" onchange="D.cardCfg.points=+this.value||40;save()"></label><div class="cfg-list">${cfgRows}</div><button onclick="addCardAttr()">＋ 添加属性</button></dialog></div>`;
}

export function openCardCfg() { document.getElementById('cardCfgDlg').showModal(); }
export function addCardAttr() { D.cardCfg.attrs.push({ id: uid(), name: '新属性', show: true }); save(); }
export function delCardAttr(idx) { const aid = D.cardCfg.attrs[idx].id; D.cardCfg.attrs.splice(idx, 1); D.bg.forEach(b => { delete b.card.vals[aid]; }); save(); }

function bgItemsCard(i) { return `<div class="card"><h3>🎒 随身物品</h3><textarea class="items-ta" placeholder="随身携带的物品…" onchange="D.bg[${i}].card.items=this.value;save()">${esc(D.bg[i].card.items || '')}</textarea></div>`; }
function bgOtherCard(i) { return `<div class="card"><h3>🐱 其他背景</h3><textarea class="other-ta" placeholder="其他背景故事、特殊能力…" onchange="D.bg[${i}].card.other=this.value;save()">${esc(D.bg[i].card.other || '')}</textarea></div>`; }

export function openStripCfg() { renderStripCfg(); document.getElementById('stripDlg').showModal(); }
export function renderStripCfg() {
  const box = document.getElementById('stripCfgBox'); if (!box) return;
  box.innerHTML = `<label class="chkrow"><input type="checkbox" ${D.ui.showChar ? 'checked' : ''} onchange="D.ui.showChar=this.checked;save()"><span>显示角色姓名</span></label>` + D.cardCfg.attrs.map(a => `<label class="chkrow"><input type="checkbox" ${a.show ? 'checked' : ''} onchange="attrShow('${a.id}',this.checked)"><span>${esc(a.name) || '（未命名）'}</span></label>`).join('');
}
export function attrShow(id, v) { const a = D.cardCfg.attrs.find(a => a.id === id); if (a) { a.show = v; save(); renderStripCfg(); } }
export function stripAll(v) { D.cardCfg.attrs.forEach(a => a.show = v); save(); renderStripCfg(); }

Object.assign(window, {
  openStripCfg, attrShow, stripAll, setPlayerRoom, duplicatePlayer,
  openPlayers, closePlayers, addPlayer, removePlayer, setPlayerCount,
  openBg, renderBg, togglePlayerDeadLib, copyPreset, 
  bgPresetAttrEdit, bgPresetAttrDel, openCardCfg, addCardAttr, delCardAttr
});