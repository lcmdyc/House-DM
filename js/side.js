// js/side.js — 房间侧栏 + 实体侧栏 + 物资卡片 + 拖拽重排 (ES6 Module)
import { D, room, rname, pname, pcolor, esc, newEntity } from './data.js';
import { uiState, save, toast, copyText, addLog, newItem, findItem, getItem } from './core.js';

// ════════════════════════════════════════════════════════════
// 1. 复制辅助
// ════════════════════════════════════════════════════════════
export function copyDesc(id) {
  const i = getItem(id);
  if (!i.desc.trim()) { toast('这张卡没有描述'); return; }
  copyText(i.desc).then(ok => toast(ok ? '📋 已复制描述' : '复制失败'));
}
export function copyRoomDesc() {
  const r = room(uiState.sel); if (!r) return;
  if (!r.desc.trim()) { toast('房间还没有描述'); return; }
  copyText(r.desc).then(ok => toast(ok ? '📋 已复制房间描述' : '复制失败'));
}
export function copyEntityDesc() {
  if (!uiState.selEntity || !uiState.selEntity.desc.trim()) { toast('该实体还没有外观与台词'); return; }
  copyText(uiState.selEntity.desc).then(ok => toast(ok ? '📋 已复制外观台词' : '复制失败'));
}
export function copyEntityAction(idx) {
  if (!uiState.selEntity || !uiState.selEntity.actions[idx]) return;
  const act = uiState.selEntity.actions[idx];
  const txt = act.effect.trim() || act.trigger.trim();
  if (!txt) { toast('该行为没有可复制的后果'); return; }
  copyText(txt).then(ok => toast(ok ? `📋 已复制触发 #${idx + 1} 后果` : '复制失败'));
}

// ════════════════════════════════════════════════════════════
// 2. 拖拽重排
// ════════════════════════════════════════════════════════════
export function handleHandleDragStart(e, type, id) {
  uiState.dragType = type;
  uiState.dragSourceId = String(id);
  e.stopPropagation();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', String(id));
  const card = e.target.closest('.item');
  if (card) setTimeout(() => card.classList.add('dragging'), 0);
}
export function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  if (!card || card.dataset.id === String(uiState.dragSourceId)) return;
  const mid = card.getBoundingClientRect().top + card.getBoundingClientRect().height / 2;
  if (e.clientY < mid) {
    card.classList.add('drag-over-top');
    card.classList.remove('drag-over-bottom');
  } else {
    card.classList.add('drag-over-bottom');
    card.classList.remove('drag-over-top');
  }
}
export function handleCardDragLeave(e) {
  const card = e.currentTarget;
  if (card) card.classList.remove('drag-over-top', 'drag-over-bottom');
}
export function handleCardDragEnd(e) {
  document.querySelectorAll('.item').forEach(c =>
    c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
  uiState.dragType = null;
  uiState.dragSourceId = null;
}
export function handleCardDrop(e, type, targetId) {
  e.preventDefault();
  e.stopPropagation();
  const card = e.currentTarget;
  const isTop = card && card.classList.contains('drag-over-top');
  document.querySelectorAll('.item').forEach(c =>
    c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
  targetId = String(targetId);
  
  if (uiState.dragType !== type || !uiState.dragSourceId || uiState.dragSourceId === targetId) return;

  if (type === 'day' || type === 'event') {
    if (window.handleScheduleDrop) window.handleScheduleDrop(e, type, targetId, isTop);
    return;
  }

  const r = room(uiState.sel); if (!r) return;
  const list = type === 'item' ? r.items : r.entities;
  const fromIdx = list.findIndex(x => String(x.id) === uiState.dragSourceId);
  if (fromIdx === -1) return;
  
  const [moved] = list.splice(fromIdx, 1);
  let toIdx = list.findIndex(x => String(x.id) === targetId);
  if (toIdx === -1) list.push(moved);
  else { if (!isTop) toIdx++; list.splice(toIdx, 0, moved); }
  
  save();
  renderSide();
}

// ════════════════════════════════════════════════════════════
// 3. 实体列表与角色列表 (HTML 生成)
// ════════════════════════════════════════════════════════════
function entityListCard(r) {
  const list = (r.entities || []).map(en => {
    const isCur = uiState.selEntity && uiState.selEntity.id === en.id;
    return `<div class="item compact npc${isCur ? ' entity-sel' : ''}"
      data-id="${en.id}"
      ${uiState.edit ? `ondragover="handleCardDragOver(event)" ondragleave="handleCardDragLeave(event)" ondrop="handleCardDrop(event,'entity','${en.id}')"` : ''}
      onclick="openEntity('${en.id}')">
      <div class="row">
        ${uiState.edit ? `<span class="drag-handle" draggable="true" ondragstart="handleHandleDragStart(event,'entity','${en.id}')" ondragend="handleCardDragEnd(event)" onclick="event.stopPropagation()">⠿</span>` : ''}
        <span class="tag static npc">${esc(en.disposition || '中立')}</span>
        <div class="memo"><b>${esc(en.name) || '未命名实体'}</b>
          <span class="cd">${esc(en.category.toUpperCase())} · ${en.attrs.map(a => `${a.name}:${a.val}`).slice(0, 3).join(' / ') || '无属性'}</span>
        </div>
        <span class="entity-arrow">详情 ❯</span>
      </div></div>`;
  }).join('');
  return `<div class="card"><h3>🎭 实体/遭遇 (${(r.entities || []).length})
    ${uiState.edit ? '<button class="primary" onclick="createEntity()">＋ 新建实体</button>' : ''}</h3>
    ${list || '<p class="hint">当前房间无固定实体</p>'}</div>`;
}

export function setPlayerRoomFromRoom(pIdx, rid) {
  const old = D.bg[pIdx].roomId || '';
  if (old === rid) {
    D.bg[pIdx].roomId = '';
    addLog('move', `${pname(pIdx)}：${rname(rid)} → 未定位`, pcolor(pIdx));
  } else {
    D.bg[pIdx].roomId = rid;
    addLog('move', `${pname(pIdx)}：${rname(old)} → ${rname(rid)}`, pcolor(pIdx));
  }
  save(); 
  renderSide();
}

// 新增：NPC 快捷移动逻辑
export function setNpcRoomFromRoom(npcId, rid) {
  const npc = D.npcs.find(n => n.id === npcId);
  if (!npc) return;
  const old = npc.roomId || '';
  if (old === rid) {
    npc.roomId = '';
    addLog('move', `${npc.name}：${rname(rid)} → 未定位`, npc.color || '#b27cd8');
  } else {
    npc.roomId = rid;
    addLog('move', `${npc.name}：${rname(old)} → ${rname(rid)}`, npc.color || '#b27cd8');
  }
  save(); 
  renderSide();
}

export function togglePlayerDead(i) {
  D.bg[i].dead = !D.bg[i].dead;
  save(); 
  renderSide();
  toast(D.bg[i].dead ? `💀 ${pname(i)} 已标记死亡` : `✅ ${pname(i)} 已取消死亡标记`);
}

function roomCharsHtml(rid) {
  const playerBtns = (D.players || []).map((_, i) => {
    const inThis  = D.bg[i].roomId === rid;
    const inOther = !inThis && D.bg[i].roomId !== '';
    const otherName = inOther ? rname(D.bg[i].roomId) : '';
    const title = inThis
      ? `${pname(i)}（点击移出房间）`
      : inOther
        ? `${pname(i)}（当前在：${otherName}，点击移入此房间）`
        : `${pname(i)}（未定位，点击移入此房间）`;
    const deadMark = D.bg[i].dead
      ? `<span class="dead-mark" title="已死亡" onclick="event.stopPropagation();togglePlayerDead(${i})">💀</span>`
      : `<span class="dead-mark-off" title="标记死亡" onclick="event.stopPropagation();togglePlayerDead(${i})">·</span>`;
    return `<button class="pbtn${inThis ? ' on' : ''}${inOther ? ' pbtn-away' : ''}${D.bg[i].dead ? ' dead' : ''}"
      style="border-color:${pcolor(i)};${inThis ? `background:${pcolor(i)};color:#111;` : inOther ? `border-color:${pcolor(i)}55;color:var(--mute);` : `border-color:${pcolor(i)}88;`}"
      title="${esc(title)}" onclick="setPlayerRoomFromRoom(${i},'${rid}')">
      <i class="cdot" style="background:${inOther ? pcolor(i) + '66' : pcolor(i)}"></i>${esc(pname(i))}${deadMark}</button>`;
  }).join('');

  const npcBtns = (D.npcs || []).map(n => {
    const inThis  = n.roomId === rid;
    const inOther = !inThis && n.roomId && n.roomId !== '';
    const otherName = inOther ? rname(n.roomId) : '';
    const title = inThis
      ? `${n.name}（点击移出房间）`
      : inOther
        ? `${n.name}（当前在：${otherName}，点击移入此房间）`
        : `${n.name}（未定位，点击移入此房间）`;
    const deadMark = n.dead
      ? `<span class="dead-mark" title="已死亡" onclick="event.stopPropagation();window.toggleNpcDead('${n.id}')">💀</span>`
      : `<span class="dead-mark-off" title="标记死亡" onclick="event.stopPropagation();window.toggleNpcDead('${n.id}')">·</span>`;
    const c = n.color || '#b27cd8';
    return `<button class="pbtn npc-char-btn${inThis ? ' on' : ''}${inOther ? ' pbtn-away' : ''}${n.dead ? ' dead' : ''}"
      style="border-color:${c};${inThis ? `background:${c};color:#111;` : inOther ? `border-color:${c}55;color:var(--mute);` : `border-color:${c}88;`}"
      title="${esc(title)}" onclick="setNpcRoomFromRoom('${n.id}','${rid}')">
      <i class="cdot" style="background:${inOther ? c + '66' : c}"></i>${esc(n.name)}${deadMark}</button>`;
  }).join('');

  if (!playerBtns && !npcBtns) return '<span class="hint players-empty">暂无角色</span>';

  return `
    <div style="display: flex; flex-direction: column; gap: 8px;">
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span class="sec" style="margin:0; padding:3px 8px; font-size:11px; flex-shrink:0;">玩家</span>
        <div class="status players-status" style="margin:0; padding:0;">
          ${playerBtns || '<span class="hint players-empty">无玩家</span>'}
        </div>
      </div>
      <div style="display: flex; gap: 8px; align-items: flex-start;">
        <span class="sec" style="margin:0; padding:3px 8px; font-size:11px; flex-shrink:0;">NPC</span>
        <div class="status players-status" style="margin:0; padding:0;">
          ${npcBtns || '<span class="hint players-empty">无NPC</span>'}
        </div>
      </div>
    </div>
  `;
}

function descCard(r) {
  if (uiState.edit) return `<div class="card"><h3>📖 房间描述</h3>
    <textarea oninput="upd('desc',this.value)" placeholder="写下对这个房间的描述…">${esc(r.desc)}</textarea></div>`;
  return `<div class="item compact rd" onclick="copyRoomDesc()">
    <div class="row"><span class="tag static" style="background:var(--accent);color:#fff">房间</span>
      <div class="memo"><b>${esc(r.name) || '未命名'}</b>
        <span class="cd ${r.desc.trim() ? '' : 'emp'}">${r.desc.trim() ? esc(r.desc) : '（暂无描述）'}</span>
      </div><span class="copyi">📋</span></div></div>`;
}

// ════════════════════════════════════════════════════════════
// 4. 房间侧栏主渲染
// ════════════════════════════════════════════════════════════
export function renderSide() {
  const s = document.getElementById('side');
  const r = room(uiState.sel);
  if (!r) { s.classList.remove('open'); s.innerHTML = ''; return; }
  s.classList.add('open');
  const keep = s.scrollTop;
  const listItems = uiState.edit
    ? r.items
    : [...r.items.filter(i => !i.consumed), ...r.items.filter(i => i.consumed)];
  
  s.innerHTML = `
    <div class="sidehead">
      <input type="text" value="${esc(r.name)}" placeholder="房间名" oninput="upd('name',this.value)">
      ${uiState.edit ? `<button class="danger" onclick="window.delRoom('${r.id}')">删除</button>` : ''}
      <button onclick="closeSide()">✕</button>
    </div>
    <div class="card"><h3>📍 此处角色</h3>
      ${roomCharsHtml(r.id)}
    </div>
    ${descCard(r)}
    ${entityListCard(r)}
    ${window.doorsCard ? window.doorsCard(r) : ''}
    <div class="card"><h3>🔒 DM 专属内容</h3>
      <textarea oninput="upd('dm',this.value)" placeholder="陷阱、NPC、隐藏机关…">${esc(r.dm)}</textarea></div>
    <div class="card"><h3>🎒 物资池
      ${uiState.edit ? '<button class="primary" onclick="addItem()">＋ 添加物资</button>' : '<span class="hint">点击卡片复制描述</span>'}</h3>
      <label class="s">整体判定条件</label>
      <textarea class="pool-note" oninput="upd('poolNote',this.value)" placeholder="如：搜索检定 DC12…">${esc(r.poolNote)}</textarea>
      <div id="items">${listItems.map(uiState.edit ? itemHtml : itemCompact).join('') || '<p class="hint">暂无物资</p>'}</div>
    </div>`;
  s.scrollTop = keep;
}

export function closeSide() {
  uiState.sel = null;
  renderSide();
  save(); // 触发地图取消选中高亮
}

export function upd(k, v) {
  const r = room(uiState.sel);
  if (r) r[k] = v;
  save();
  if (k === 'name' && !uiState.edit) renderSide();
}

// ════════════════════════════════════════════════════════════
// 5. 物资卡片操作
// ════════════════════════════════════════════════════════════
function pbtnsHtml(i) {
  return (D.players || []).map((p, idx) => {
    const on = i.owners.includes(idx), c = pcolor(idx);
    const st = on ? `background:${c};border-color:${c};color:#111` : `border-color:${c}88`;
    return `<button class="pbtn ${on ? 'on' : ''}" style="${st}" onclick="toggleOwner('${i.id}',${idx})">${esc(pname(idx))}</button>`;
  }).join('');
}

function itemHtml(i) {
  const t = i.type === 'clue';
  return `<div class="item ${t ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}" data-id="${i.id}"
    ondragover="handleCardDragOver(event)" ondragleave="handleCardDragLeave(event)" ondrop="handleCardDrop(event,'item','${i.id}')">
    <div class="row">
      <span class="drag-handle" draggable="true" ondragstart="handleHandleDragStart(event,'item','${i.id}')" ondragend="handleCardDragEnd(event)" onclick="event.stopPropagation()">⠿</span>
      <button class="tag ${i.type}" onclick="itemType('${i.id}')">${t ? '线索' : '道具'}</button>
      <input type="text" value="${esc(i.name)}" placeholder="物资名称" oninput="itemUpd('${i.id}','name',this.value)">
      <button class="danger" onclick="delItem('${i.id}')">🗑</button>
    </div>
    <label class="s">描述</label>
    <textarea class="item-desc" oninput="itemUpd('${i.id}','desc',this.value)">${esc(i.desc)}</textarea>
    <label class="s">获取条件</label>
    <textarea class="item-cond" oninput="itemUpd('${i.id}','cond',this.value)" placeholder="如：侦查 DC15">${esc(i.cond)}</textarea>
    <div class="status">${pbtnsHtml(i)}
      <button class="cbtn ${i.consumed ? 'on' : ''}" onclick="toggleConsumed('${i.id}')">${i.consumed ? '已消耗' : '消耗'}</button>
    </div></div>`;
}

function itemCompact(i) {
  const t = i.type === 'clue';
  return `<div class="item compact ${t ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}" onclick="copyDesc('${i.id}')">
    <div class="row"><span class="tag static ${i.type}">${t ? '线索' : '道具'}</span>
      <div class="memo"><b>${esc(i.name) || '（未命名）'}</b>
        ${i.cond ? `<span class="cd">条件: ${esc(i.cond)}</span>` : ''}
        ${i.desc ? `<span class="desc-p">${esc(i.desc)}</span>` : ''}
      </div><span class="copyi">📋</span></div>
    <div class="status" onclick="event.stopPropagation()">${pbtnsHtml(i)}
      <button class="cbtn ${i.consumed ? 'on' : ''}" onclick="toggleConsumed('${i.id}')">${i.consumed ? '已消耗' : '消耗'}</button>
    </div></div>`;
}

export function addItem()  { room(uiState.sel).items.push(newItem()); save(); renderSide(); }
export function delItem(id) { const r = room(uiState.sel); r.items = r.items.filter(i => i.id !== id); save(); renderSide(); }
export function itemType(id) { const i = getItem(id); i.type = i.type === 'clue' ? 'item' : 'clue'; save(); renderSide(); }
export function itemUpd(id, k, v) { getItem(id)[k] = v; save(); }

export function toggleOwner(id, idx) {
  const f = findItem(id), i = f.item;
  const had = i.owners.includes(idx);
  i.owners = had ? i.owners.filter(x => x !== idx) : [...i.owners, idx].sort((a, b) => a - b);
  addLog('item', `${pname(idx)} ${had ? '失去' : '获得'}「${i.name || '未命名'}」`, pcolor(idx));
  save(); renderSide();
}

export function toggleConsumed(id) {
  const i = getItem(id);
  i.consumed = !i.consumed;
  addLog('item', `「${i.name || '未命名'}」${i.consumed ? '已消耗' : '恢复未消耗'}`);
  save(); renderSide();
}

// ════════════════════════════════════════════════════════════
// 6. 实体侧栏 (Entity Side)
// ════════════════════════════════════════════════════════════
export function openEntity(id) {
  const r = room(uiState.sel); if (!r) return;
  uiState.selEntity = (r.entities || []).find(e => e.id === id);
  renderSide(); renderEntitySide();
}
export function closeEntitySide() { uiState.selEntity = null; renderSide(); renderEntitySide(); }
export function createEntity() {
  const r = room(uiState.sel); if (!r) return;
  const en = newEntity();
  r.entities.push(en);
  uiState.selEntity = en;
  save(); renderSide(); renderEntitySide();
}
export function deleteCurEntity() {
  if (!confirm('确定删除该实体？')) return;
  const r = room(uiState.sel); if (!r || !uiState.selEntity) return;
  r.entities = r.entities.filter(e => e.id !== uiState.selEntity.id);
  uiState.selEntity = null;
  save(); renderSide(); renderEntitySide();
}

function entityDescBox(en) {
  if (uiState.edit) return `<div class="card"><h3>📖 外观与台词</h3>
    <textarea placeholder="念给玩家的外观…" oninput="uiState.selEntity.desc=this.value;save()">${esc(en.desc)}</textarea></div>`;
  return `<div class="item compact en-copy" onclick="copyEntityDesc()">
    <div class="row"><span class="tag static npc">台词/描述</span>
      <div class="memo"><b>${esc(en.name)} 的呈现</b>
        <span class="cd ${en.desc.trim() ? '' : 'emp'}">${en.desc.trim() ? esc(en.desc) : '（暂无描述）'}</span>
      </div><span class="copyi">📋</span></div></div>`;
}

function entityActionsBox(en) {
  if (uiState.edit) {
    const actsHtml = (en.actions || []).map((act, idx) => `
      <div class="act-item"><div class="act-head">
        <span class="act-idx">触发 #${idx + 1}</span>
        <input type="text" value="${esc(act.trigger)}" placeholder="触发时机" oninput="uiState.selEntity.actions[${idx}].trigger=this.value;save()">
        <button class="danger act-del" onclick="uiState.selEntity.actions.splice(${idx},1);save();renderEntitySide()">✕</button>
      </div>
      <label class="s">后果：</label>
      <textarea class="act-effect" oninput="uiState.selEntity.actions[${idx}].effect=this.value;save()">${esc(act.effect)}</textarea></div>`).join('');
    return `<div class="card"><h3>⚡ 触发行为
      <button class="primary" onclick="uiState.selEntity.actions.push({trigger:'',effect:''});save();renderEntitySide()">＋ 添加行为</button></h3>
      ${actsHtml || '<p class="hint">暂未配置</p>'}</div>`;
  }
  const actsCompact = (en.actions || []).map((act, idx) => `
    <div class="item compact en-copy act" onclick="copyEntityAction(${idx})">
      <div class="row"><span class="tag static act-tag">触发 #${idx + 1}</span>
        <div class="memo"><b>${esc(act.trigger) || '（未设定）'}</b>
          <span class="cd ${act.effect.trim() ? '' : 'emp'}">${act.effect.trim() ? esc(act.effect) : '（暂无后果）'}</span>
        </div><span class="copyi">📋</span></div></div>`).join('');
  return `<div class="card entity-actions-card"><h3>⚡ 触发后果</h3>${actsCompact || '<p class="hint">未配置</p>'}</div>`;
}

export function renderEntitySide() {
  const es = document.getElementById('entitySide');
  if (!uiState.sel || !uiState.selEntity) { es.classList.remove('open'); es.innerHTML = ''; return; }
  es.classList.add('open');
  const en = uiState.selEntity;
  const attrsHtml = (en.attrs || []).map((a, idx) => `
    <div class="entity-attr-row">
      <input type="text" class="entity-attr-name" value="${esc(a.name)}" placeholder="属性名" ${!uiState.edit ? 'disabled' : ''} oninput="uiState.selEntity.attrs[${idx}].name=this.value;save()">
      <input type="text" class="entity-attr-val"  value="${esc(a.val)}"  placeholder="值" oninput="uiState.selEntity.attrs[${idx}].val=this.value;save()">
      ${uiState.edit ? `<button class="danger" onclick="uiState.selEntity.attrs.splice(${idx},1);save();renderEntitySide()">✕</button>` : ''}
    </div>`).join('');
  es.innerHTML = `
    <div class="sidehead">
      <b class="entity-side-title">🎭 实体详情</b><div class="spacer"></div>
      ${uiState.edit ? `<button class="danger" onclick="deleteCurEntity()">删除实体</button>` : ''}
      <button onclick="closeEntitySide()">✕</button>
    </div>
    <div class="card">
      <div class="entity-name-row">
        <input type="text" value="${esc(en.name)}" placeholder="实体名称" ${!uiState.edit ? 'disabled' : ''} oninput="uiState.selEntity.name=this.value;save();renderSide()">
        <select class="entity-cat-sel" ${!uiState.edit ? 'disabled' : ''} onchange="uiState.selEntity.category=this.value;save();renderSide()">
          <option value="npc"     ${en.category === 'npc'     ? 'selected' : ''}>NPC</option>
          <option value="monster" ${en.category === 'monster' ? 'selected' : ''}>怪物</option>
          <option value="trap"    ${en.category === 'trap'    ? 'selected' : ''}>陷阱/机关</option>
          <option value="object"  ${en.category === 'object'  ? 'selected' : ''}>交互物件</option>
        </select>
      </div>
      <div class="entity-disp-row">
        <span class="entity-disp-label">初始态度：</span>
        <input type="text" value="${esc(en.disposition)}" placeholder="态度" oninput="uiState.selEntity.disposition=this.value;save();renderSide()">
      </div>
    </div>
    ${entityDescBox(en)}
    <div class="card"><h3>📊 属性
      ${uiState.edit ? `<button onclick="uiState.selEntity.attrs.push({name:'新属性',val:''});save();renderEntitySide()">＋ 属性</button>` : ''}
    </h3>${attrsHtml || '<p class="hint">暂无属性</p>'}</div>
    ${entityActionsBox(en)}
    <div class="card"><h3>🔒 DM 备注</h3>
      <textarea placeholder="战术策略、动机…" oninput="uiState.selEntity.dmNote=this.value;save()">${esc(en.dmNote)}</textarea></div>`;
}

// ════════════════════════════════════════════════════════════
// 7. 挂载全局方法 (供 HTML 内联事件调用)
// ════════════════════════════════════════════════════════════
Object.assign(window, {
  copyDesc, copyRoomDesc, copyEntityDesc, copyEntityAction,
  handleHandleDragStart, handleCardDragOver, handleCardDragLeave, handleCardDragEnd, handleCardDrop,
  setPlayerRoomFromRoom, setNpcRoomFromRoom, togglePlayerDead,
  upd, addItem, delItem, itemType, itemUpd, toggleOwner, toggleConsumed,
  openEntity, closeEntitySide, createEntity, deleteCurEntity,
  renderSide, renderEntitySide, closeSide, uiState
});
