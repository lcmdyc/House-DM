// js/players.js — 玩家状态条 + 背景资料库 + 车卡系统 (ES6 Module)
import { D, uid, esc, blankBg, cardUsed, pname, pcolor, rname } from './data.js';
import { uiState, save, toast, copyText, addLog, roomSel, switchTab, switchLibTab, getAllItems, toggleItemOwner, parseText } from './core.js';
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
    
    // 💡 修复：顶部状态条也只显示纯净的角色名(或玩家名)，去除冗余括号
    const cName = b.card?.name?.trim();
    const pName = pname(i);
    const dispName = cName || pName; 

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

export function togglePlayerDeadLib(i) {
  D.bg[i].dead = !D.bg[i].dead;
  save();
  toast(D.bg[i].dead ? `💀 ${pname(i)} 已标记死亡` : `✅ ${pname(i)} 已取消死亡标记`);
  window.dispatchEvent(new Event('trpg-ui-update'));
}

export function renderBgNav() {
  const navEl = document.getElementById('bgNav');
  if (!navEl) return;
  const i = uiState.bgSel;
  navEl.innerHTML = D.players.map((_, idx) => {
    const bg = D.bg[idx];
    
    // 💡 修复：左侧列表卡片黑字只显示角色名，不再拼接 (玩家1)，因为右上角已经有身份 tag 了
    const cName = bg.card?.name?.trim();
    const pName = pname(idx);
    const dispName = cName || pName; 
    
    return renderEntityCard({
      id: idx, dragType: 'player', name: dispName, color: pcolor(idx), badge: bg.ho || '玩家',
      disposition: '', roomId: bg.roomId, isDead: bg.dead, isSelected: i === idx, rooms: D.rooms,
      onSelect: `uiState.bgSel=${idx};renderBg()`, onRoomChange: `setPlayerRoom(${idx},this.value)`,
      onDuplicate: `duplicatePlayer(${idx})`, onDelete: `removePlayer(${idx})`, onToggleDead: `togglePlayerDeadLib(${idx})`
    });
  }).join('');
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
  
  renderBgNav(); // 渲染左侧

  const i = uiState.bgSel;
  const b = D.bg[i];
  if (!b) return;

  if (b.textAttrs && b.textAttrs.some(t => t.label === '性别' || t.label === '姓名')) {
    b.textAttrs = b.textAttrs.filter(t => t.label !== '性别' && t.label !== '姓名');
  }

  const isEdit = uiState.edit;
  const copyHtml = (val, fallback = '暂无') => `<div class="u-copy-text" onclick="copyText(this.innerText).then(ok=>toast(ok?'📋 已复制':'复制失败'))">${val ? parseText(esc(val)) : `<span class="hint">${fallback}</span>`}</div>`;
  const copyListHtml = (arr, fallback = '暂无') => arr.length ? `<div class="u-copy-text" onclick="copyText(this.innerText).then(ok=>toast(ok?'📋 已复制':'复制失败'))">${parseText(esc(arr.join(' / ')))}</div>` : `<div class="hint" style="font-size:12px">${fallback}</div>`;

  mainEl.innerHTML = `
    <div class="u-panel">
      <div class="u-col-left">
        <div class="u-card">
          <div class="u-card-title"><span>👤 基础信息</span></div>
          <div class="u-grid-2">
            <div class="u-field"><label>角色姓名(PC)</label>
              <input class="u-input" value="${esc(b.card.name)}" 
                     oninput="D.bg[${i}].card.name=this.value; window.renderBgNav(); window.renderStrip();" 
                     onchange="save()" ${isEdit?'':'disabled'}>
            </div>
            <div class="u-field"><label>性别</label><input class="u-input" value="${esc(b.gender)}" onchange="D.bg[${i}].gender=this.value;save()" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>身份类型(HO)</label>
              <input class="u-input" value="${esc(b.ho)}" 
                     oninput="D.bg[${i}].ho=this.value; window.renderBgNav();" 
                     onchange="save()" ${isEdit?'':'disabled'}>
            </div>
            <div class="u-field"><label>立场</label><input class="u-input" value="${esc(b.disposition)}" onchange="D.bg[${i}].disposition=this.value;save()" ${isEdit?'':'disabled'}></div>
            <div class="u-field"><label>标记颜色</label>
              <input class="u-input" type="color" value="${esc(b.color)}" 
                     oninput="D.bg[${i}].color=this.value; window.renderBgNav(); window.renderStrip();" 
                     onchange="save()" style="height:35px;padding:2px" ${isEdit?'':'disabled'}>
            </div>
            <div class="u-field"><label>当前所在房间</label><select class="u-select" onchange="setPlayerRoom(${i},this.value)">${roomSel(b.roomId)}</select></div>
          </div>
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📋 模组预设</span><span class="hint">由作者设定</span></div>
          <div class="u-field"><label>身份背景</label>
            ${isEdit ? `<textarea class="u-textarea" onchange="D.bg[${i}].identity=this.value;save()">${esc(b.identity)}</textarea>` : copyHtml(b.identity)}
          </div>
          <div class="u-field"><label>技能/道具 ${isEdit ? `<button class="u-btn-sm" onclick="D.bg[${i}].skills.push('');save();renderBg()">+ 添加</button>` : ''}</label>
            ${isEdit 
              ? b.skills.map((s, idx) => `<div class="u-row"><input class="u-input" value="${esc(s)}" onchange="D.bg[${i}].skills[${idx}]=this.value;save()"><button class="u-del-btn" onclick="D.bg[${i}].skills.splice(${idx},1);save();renderBg()">✕</button></div>`).join('')
              : copyListHtml(b.skills)
            }
          </div>
          <div class="u-field"><label>角色目的 ${isEdit ? `<button class="u-btn-sm" onclick="D.bg[${i}].goals.push('');save();renderBg()">+ 添加</button>` : ''}</label>
            ${isEdit 
              ? b.goals.map((g, idx) => `<div class="u-row"><input class="u-input" value="${esc(g)}" onchange="D.bg[${i}].goals[${idx}]=this.value;save()"><button class="u-del-btn" onclick="D.bg[${i}].goals.splice(${idx},1);save();renderBg()">✕</button></div>`).join('')
              : copyListHtml(b.goals)
            }
          </div>
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📊 数值属性</span>${isEdit ? `<button class="u-btn-sm" onclick="if(!D.bg[${i}].presetAttrs)D.bg[${i}].presetAttrs=[];D.bg[${i}].presetAttrs.push({id:uid(),name:'新属性',val:0,show:true});save();renderBg()">+ 添加自定义属性</button>` : ''}</div>
          ${D.cardCfg.attrs.map(a => `
            <div class="u-row">
              <input class="u-input" value="${esc(a.name)}" disabled style="flex:1; opacity:0.7">
              <div class="u-num-ctrl">
                <button onclick="window.onWheelAdj({isUp:false},'player',${i},'${a.id}')">-</button>
                <input value="${+b.card.vals[a.id] || 0}" onwheel="window.onWheelAdj(event,'player',${i},'${a.id}')" onchange="D.bg[${i}].card.vals['${a.id}']=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
                <button onclick="window.onWheelAdj({isUp:true},'player',${i},'${a.id}')">+</button>
              </div>
              <button class="u-del-btn" style="visibility:hidden">✕</button>
            </div>
          `).join('')}
          ${(b.presetAttrs || []).map((a, idx) => `
            <div class="u-row">
              <input class="u-input" value="${esc(a.name)}" onchange="D.bg[${i}].presetAttrs[${idx}].name=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))" style="flex:1" ${isEdit?'':'disabled'}>
              <div class="u-num-ctrl">
                <button onclick="window.onWheelAdj({isUp:false},'preset',${i},'${a.id}')">-</button>
                <input value="${+a.val || 0}" onwheel="window.onWheelAdj(event,'preset',${i},'${a.id}')" onchange="D.bg[${i}].presetAttrs[${idx}].val=this.value;save();window.dispatchEvent(new Event('trpg-ui-update'))">
                <button onclick="window.onWheelAdj({isUp:true},'preset',${i},'${a.id}')">+</button>
              </div>
              ${isEdit ? `<button class="u-del-btn" onclick="D.bg[${i}].presetAttrs.splice(${idx},1);save();renderBg();window.dispatchEvent(new Event('trpg-ui-update'))">✕</button>` : '<button class="u-del-btn" style="visibility:hidden">✕</button>'}
            </div>
          `).join('')}
        </div>
      </div>

      <div class="u-col-right">
        <div class="u-card">
          <div class="u-card-title"><span>🔒 DM 备注</span><span class="hint">不计入导出</span></div>
          ${isEdit 
            ? `<textarea class="u-textarea" placeholder="DM 专属备注..." onchange="D.bg[${i}].dmNote=this.value;save()">${esc(b.dmNote)}</textarea>`
            : copyHtml(b.dmNote, '暂无备注')
          }
        </div>

        <div class="u-card">
          <div class="u-card-title"><span>📝 文本属性</span>${isEdit ? `<button class="u-btn-sm" onclick="D.bg[${i}].textAttrs.push({label:'',val:''});save();renderBg()">+ 添加</button>` : ''}</div>
          <div style="display:flex; flex-direction:column;">
            ${(b.textAttrs || []).map((t, idx) => `
              ${isEdit ? `
                <div class="u-text-attr-row">
                  <input class="u-input" placeholder="类目" value="${esc(t.label)}" onchange="D.bg[${i}].textAttrs[${idx}].label=this.value;save()" style="width:70px; font-weight:bold; padding:4px 6px;">
                  <textarea class="u-textarea" placeholder="内容..." onchange="D.bg[${i}].textAttrs[${idx}].val=this.value;save()" style="flex:1; min-height:28px; padding:4px 6px;">${esc(t.val || '')}</textarea>
                  <button class="u-del-btn" onclick="D.bg[${i}].textAttrs.splice(${idx},1);save();renderBg()">✕</button>
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
          <select class="u-select" onchange="if(this.value){ toggleItemOwner(this.value, ${i}); this.value=''; renderBg(); }">
            <option value="">+ 分配现有物资给TA...</option>
            ${getAllItems().map(it => `<option value="${it.id}">${esc(it.name)}</option>`).join('')}
          </select>` : ''}
          <div style="display:flex; flex-direction:column; gap:8px; margin-top:8px;">
            ${getAllItems().filter(it => it.owners.includes(i)).map(it => `
              <div class="u-item-row" style="flex-direction:column; align-items:stretch; gap:6px; ${it.consumed ? 'opacity:0.6;' : ''}">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                  <span style="font-weight:bold; color:var(--${it.type==='clue'?'clue':'item'})">
                    ${esc(it.name)} ${it.consumed ? '<span style="font-size:11px;color:var(--mute);font-weight:normal;">(已消耗)</span>' : ''}
                  </span>
                  <div style="display:flex; gap:6px;">
                    <button class="u-btn-sm" onclick="window.toggleConsumed('${it.id}')">${it.consumed ? '恢复' : '消耗'}</button>
                    ${isEdit ? `<button class="u-btn-sm" onclick="toggleItemOwner('${it.id}', ${i});">移除</button>` : ''}
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

export function openCardCfg() { document.getElementById('cardCfgDlg').showModal(); }
export function addCardAttr() { D.cardCfg.attrs.push({ id: uid(), name: '新属性', show: true }); save(); }
export function delCardAttr(idx) { const aid = D.cardCfg.attrs[idx].id; D.cardCfg.attrs.splice(idx, 1); D.bg.forEach(b => { delete b.card.vals[aid]; }); save(); }

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
  openBg, renderBg, renderBgNav, togglePlayerDeadLib,
  openCardCfg, addCardAttr, delCardAttr
});
