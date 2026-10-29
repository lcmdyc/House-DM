// js/app.js

let sel = null;
let selEntity = null;
let edit = true;
let poolQ = '', poolT = '';
let bgSel = 0;
let dayView = D.curDay;
let logF = 'all';

function save() {
  saveData(D);
  renderStrip();
}

const newItem = () => ({ id: uid(), type: 'item', name: '', desc: '', cond: '', owners: [], consumed: false });
const chipHtml = i => `<i class="chip" style="background:${pcolor(i)}" title="${esc(pname(i))}">${esc([...pname(i)][0] || '?')}</i>`;

function findItem(id) {
  let l = D.pool.find(i => i.id === id); if (l) return { item: l, list: D.pool, rid: '' };
  for (const r of D.rooms) { const it = r.items.find(i => i.id === id); if (it) return { item: it, list: r.items, rid: r.id }; }
  return null;
}
const getItem = id => findItem(id).item;

// ===== 提示与剪贴板 =====
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1600);
}

function copyText(text) {
  const fallback = () => {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.style.cssText = 'position:fixed;opacity:0';
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch (_) {}
    ta.remove();
    return ok;
  };
  if (navigator.clipboard && window.isSecureContext) {
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  }
  return Promise.resolve(fallback());
}

function copyDesc(id) {
  const i = getItem(id);
  if (!i.desc.trim()) { toast('这张卡没有描述'); return; }
  copyText(i.desc).then(ok => toast(ok ? '📋 已复制描述' : '复制失败，请手动复制'));
}

function copyRoomDesc() {
  const r = room(sel); if (!r) return;
  if (!r.desc.trim()) { toast('这个房间还没有描述'); return; }
  copyText(r.desc).then(ok => toast(ok ? '📋 已复制房间描述' : '复制失败，请手动复制'));
}

function copyEntityDesc() {
  if (!selEntity || !selEntity.desc.trim()) { toast('该实体还没有外观与台词'); return; }
  copyText(selEntity.desc).then(ok => toast(ok ? '📋 已复制外观台词' : '复制失败，请手动复制'));
}

function copyEntityAction(idx) {
  if (!selEntity || !selEntity.actions[idx]) return;
  const act = selEntity.actions[idx];
  const txt = act.effect.trim() || act.trigger.trim();
  if (!txt) { toast('该行为没有可复制的后果'); return; }
  copyText(txt).then(ok => toast(ok ? `📋 已复制触发 #${idx + 1} 后果` : '复制失败，请手动复制'));
}

// ===== 日志系统 =====
function addLog(type, text, color = '') {
  D.log.push({ id: uid(), ts: Date.now(), day: D.curDay + 1, type, text, color });
  if (D.log.length > 2000) D.log.splice(0, D.log.length - 2000);
  if (document.getElementById('logDlg').open) renderLog();
}

const LOG_TYPES = [['all', '全部'], ['item', '📦 物品'], ['attr', '📊 属性'], ['move', '🚶 移动'], ['day', '🚩 日程']];
const logTime = ts => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const logFiltered = () => D.log.filter(e => logF === 'all' || e.type === logF);

function openLog() { renderLog(); document.getElementById('logDlg').showModal(); }
function renderLog() {
  document.getElementById('logTabs').innerHTML = LOG_TYPES.map(([k, l]) =>
    `<button class="${logF === k ? 'on' : ''}" onclick="logF='${k}';renderLog()">${l}</button>`).join('');
  const list = logFiltered().slice().reverse();
  document.getElementById('logList').innerHTML = list.length ? list.map(e =>
    `<div class="lg ${e.type}"><span class="ld">Day ${e.day}</span><span class="lt">${logTime(e.ts)}</span>
      <span class="lx">${e.color ? `<i class="cdot" style="background:${e.color}"></i>` : ''}${esc(e.text)}</span></div>`).join('')
    : '<p class="hint">暂无记录。给玩家分配物资、改属性、换房间时会自动记录。</p>';
}

function copyLog() {
  const t = logFiltered().map(e => `[${dayLabel(e.day - 1)} ${logTime(e.ts)}] ${e.text}`).join('\n');
  if (!t) { toast('没有可复制的记录'); return; }
  copyText(t).then(ok => ok ? toast('📋 已复制日志') : prompt('请手动复制：', t));
}

function clearLog() {
  if (!confirm('清空全部日志？此操作无法撤销。')) return;
  D.log = []; save(); renderLog();
}

// ===== 玩家属性视窗与位置 =====
function roomSel(cur) {
  return `<option value="">📍 未定位</option>` + D.rooms.map(r =>
    `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`).join('');
}

function setPlayerRoom(i, rid) {
  const old = D.bg[i].roomId || '';
  if (old === rid) return;
  D.bg[i].roomId = rid;
  addLog('move', `${pname(i)}：${rname(old)} → ${rname(rid)}`, pcolor(i));
  save(); renderMap(); renderSide();
}

function renderStrip() {
  const s = document.getElementById('strip'); if (!s || !D) return;
  s.classList.toggle('hide', !D.ui.strip);
  document.getElementById('stripOpen').style.display = D.ui.strip ? 'none' : 'block';
  if (!D.ui.strip) return;
  const attrs = D.cardCfg.attrs.filter(a => a.show);
  const cards = D.players.map((p, i) => {
    const b = D.bg[i]; if (!b) return '';
    const cn = D.ui.showChar && b.card.info.name ? `<div class="cn">${esc(b.card.info.name)}</div>` : '';
    const as = attrs.map(a => {
      const v = +b.card.vals[a.id] || 0;
      return `<span class="${v ? '' : 'z'}"><i>${esc(a.name)}</i><b>${v}</b></span>`;
    }).join('');
    return `<div class="pc" style="border-left-color:${b.color}" title="点击查看 ${esc(pname(i))} 的背景和车卡" onclick="bgSel=${i};openBg()">
      <div class="pn">${esc(pname(i))}</div>${cn}
      <select class="prm" title="所在房间" onclick="event.stopPropagation()" onchange="setPlayerRoom(${i},this.value)">${roomSel(b.roomId)}</select>
      ${attrs.length ? `<div class="as">${as}</div>` : ''}
    </div>`;
  }).join('');
  s.innerHTML = `<div class="sthead"><span style="margin-right:auto">👥 玩家属性</span>
      <button title="设置显示哪些属性" onclick="openStripCfg()">⚙</button>
      <button title="收起" onclick="setStrip(false)">◀</button></div>
    ${attrs.length ? '' : '<div class="hint">没有选择任何属性，点 ⚙ 设置</div>'}${cards}`;
}

function setStrip(v) { D.ui.strip = v; save(); }
function openStripCfg() { renderStripCfg(); document.getElementById('stripDlg').showModal(); }
function renderStripCfg() {
  document.getElementById('stripCfgBox').innerHTML =
    `<label class="chkrow"><input type="checkbox" ${D.ui.showChar ? 'checked' : ''} onchange="D.ui.showChar=this.checked;save()"><span>显示角色姓名（车卡里填写的）</span></label>` +
    D.cardCfg.attrs.map(a => `<label class="chkrow"><input type="checkbox" ${a.show ? 'checked' : ''} onchange="attrShow('${a.id}',this.checked)"><span>${esc(a.name) || '（未命名）'}</span></label>`).join('');
}
function attrShow(id, v) { D.cardCfg.attrs.find(a => a.id === id).show = v; save(); }
function stripAll(v) { D.cardCfg.attrs.forEach(a => a.show = v); save(); renderStripCfg(); }

// ===== 地图平移、缩放与居中 =====
const wrap = document.getElementById('mapWrap'), grid = document.getElementById('grid');
const CELL_W = 130 + 14, CELL_H = 100 + 14;
let pan = { x: 0, y: 0 }, lastMin = null;

function applyPan() {
  grid.style.transform = `translate(${pan.x}px,${pan.y}px)`;
  wrap.style.backgroundPosition = `${pan.x}px ${pan.y}px`;
}

function centerView() {
  pan.x = Math.round((wrap.clientWidth - grid.offsetWidth) / 2);
  pan.y = Math.round((wrap.clientHeight - grid.offsetHeight) / 2);
  applyPan();
}

let drag = null, moved = false;
wrap.addEventListener('pointerdown', e => {
  if (e.button !== 0 || e.target.closest('.add,#centerBtn,#stripOpen')) return;
  drag = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
  moved = false;
});
window.addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
  if (!moved && Math.hypot(dx, dy) < 5) return;
  moved = true; wrap.classList.add('dragging');
  pan.x = drag.px + dx; pan.y = drag.py + dy; applyPan();
});
window.addEventListener('pointerup', () => { drag = null; wrap.classList.remove('dragging'); });
window.addEventListener('pointercancel', () => { drag = null; wrap.classList.remove('dragging'); });
wrap.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
wrap.addEventListener('wheel', e => {
  e.preventDefault();
  pan.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
  pan.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
  applyPan();
}, { passive: false });

// ===== 地图渲染 =====
function doorTitle(s, d) { const l = SIDES.find(x => x[0] === s)[1]; return `${l}：${DOOR_T[d.t]}${d.note ? '：' + d.note : ''}`; }
function doorsHtml(r) {
  return SIDES.filter(([s]) => r.doors[s]).map(([s]) => {
    const d = r.doors[s];
    return `<i class="dr ${d.t} ${s}" title="${esc(doorTitle(s, d))}">${doorSym(d.t, s)}</i>`;
  }).join('');
}

function renderMap() {
  if (!D.rooms.length) {
    grid.style.display = 'block';
    grid.innerHTML = '<div class="empty"><p>地图还是空的</p><button class="primary" onclick="addFirst()">＋ 创建第一个房间</button></div>';
    lastMin = null; centerView(); return;
  }
  grid.style.display = 'grid';
  const xs = D.rooms.map(r => r.x), ys = D.rooms.map(r => r.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
  grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1},130px)`;
  let h = '';
  for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
    const r = at(x, y);
    if (!r) { h += '<div class="cell"></div>'; continue; }
    const total = r.items.length, got = r.items.filter(isGot).length;
    const here = playersIn(r.id);
    const nEntity = r.entities ? r.entities.length : 0;
    const btn = (cls, dx, dy) => at(x + dx, y + dy) ? '' : `<button class="add ${cls}" title="向此方向新增房间" onclick="event.stopPropagation();addRoom('${r.id}',${dx},${dy})">+</button>`;
    h += `<div class="cell">
      <div class="room ${sel === r.id ? 'sel' : ''}" onclick="select('${r.id}')">
        <div class="name">${esc(r.name) || '未命名'}</div>
        <div class="pl">${here.map(chipHtml).join('')}</div>
        <div class="stat">
          <span>${nEntity ? `🎭${nEntity}` : ''}</span>
          <span>${total ? `📦 ${got}/${total}` : '—'}</span>
        </div>
      </div>
      ${doorsHtml(r)}
      ${btn('t', 0, -1)}${btn('bm', 0, 1)}${btn('l', -1, 0)}${btn('r', 1, 0)}
    </div>`;
  }
  grid.innerHTML = h;
  if (!lastMin) { lastMin = { x: minX, y: minY }; centerView(); }
  else {
    pan.x -= (lastMin.x - minX) * CELL_W; pan.y -= (lastMin.y - minY) * CELL_H;
    lastMin = { x: minX, y: minY }; applyPan();
  }
}

function addFirst() { const r = blankRoom(0, 0, '入口'); D.rooms.push(r); save(); select(r.id); centerView(); }
function addRoom(id, dx, dy) {
  const r = room(id); if (at(r.x + dx, r.y + dy)) return;
  const n = blankRoom(r.x + dx, r.y + dy);
  r.doors[sideOf(dx, dy)] = { t: 'door', note: '' };
  n.doors[OPP[sideOf(dx, dy)]] = { t: 'door', note: '' };
  D.rooms.push(n); save(); select(n.id);
}

function delRoom(id) {
  const r = room(id);
  if (!confirm('确定删除该房间？' + (r.items.length ? '\n房间内的物资不会丢失，会回到「未分配」物资池。' : '') + (playersIn(id).length ? '\n房间里的玩家会变成「未定位」。' : ''))) return;
  D.pool.push(...r.items);
  D.bg.forEach(b => { if (b.roomId === id) b.roomId = ''; });
  D.rooms = D.rooms.filter(x => x.id !== id);
  if (sel === id) closeSide();
  save(); renderMap();
}

function select(id) {
  sel = id;
  selEntity = null;
  renderMap();
  renderSide();
  renderEntitySide();
}

function closeSide() {
  sel = null;
  selEntity = null;
  renderMap();
  renderSide();
  renderEntitySide();
}

function toggleMode() {
  edit = !edit;
  document.body.classList.toggle('edit', edit);
  const b = document.getElementById('modeBtn');
  b.classList.toggle('on', edit);
  b.textContent = edit ? '✏️ 编辑模式' : '🎮 带团模式';
  renderSide();
  renderEntitySide();
}

// ===== 门配置 =====
function setDoor(s, t) {
  const r = room(sel);
  if (!t) delete r.doors[s];
  else r.doors[s] = { t, note: (r.doors[s] && r.doors[s].note) || '' };
  save(); renderMap(); renderSide();
}
function setDoorNote(s, v) { const d = room(sel).doors[s]; if (d) { d.note = v; save(); } }
function doorLock(s) {
  const d = room(sel).doors[s]; if (!d) return;
  d.t = d.t === 'lock' ? 'door' : 'lock';
  save(); renderMap(); renderSide();
  toast(d.t === 'lock' ? '🔒 已上锁' : '🔓 已开锁');
}

function doorsCard(r) {
  if (edit) {
    const rows = SIDES.map(([s, l, dx, dy]) => {
      const d = r.doors[s], n = at(r.x + dx, r.y + dy);
      return `<div class="drow"><b>${l}</b>
        <select onchange="setDoor('${s}',this.value)"><option value="">▭ 墙（无门）</option>${Object.entries(DOOR_T).map(([k, v]) => `<option value="${k}" ${d && d.t === k ? 'selected' : ''}>${v}</option>`).join('')}</select>
        ${d ? `<input type="text" value="${esc(d.note)}" placeholder="备注，如：通往地窖" oninput="setDoorNote('${s}',this.value)">`
            : `<span class="hint">${n ? '邻接：' + esc(n.name || '未命名') : '无邻接房间'}</span>`}</div>`;
    }).join('');
    return `<div class="card"><h3>🚪 门与通道 <span class="hint">不必连接房间 · 单向门以本房间为参照</span></h3>${rows}</div>`;
  }
  const list = SIDES.filter(([s]) => r.doors[s]).map(([s, l, dx, dy]) => {
    const d = r.doors[s], n = at(r.x + dx, r.y + dy);
    const dest = ` ${d.t === 'in' ? '←' : '→'} ${n ? esc(n.name || '未命名') : '外部'}`;
    return `<div class="drow"><i class="dr ${d.t}">${doorSym(d.t, s)}</i>
      <span style="flex:1">${l} · ${DOOR_T[d.t]}${dest}${d.note ? `<span class="hint">　${esc(d.note)}</span>` : ''}</span>
      ${d.t === 'door' || d.t === 'lock' ? `<button onclick="doorLock('${s}')">${d.t === 'lock' ? '🔓 开锁' : '🔒 上锁'}</button>` : ''}</div>`;
  }).join('');
  return `<div class="card"><h3>🚪 门与通道</h3>${list || '<span class="hint">这个房间没有门（封闭空间）</span>'}</div>`;
}

// ===== 侧栏：房间描述与实体列表 =====
function descCard(r) {
  if (edit) {
    return `<div class="card"><h3>📖 房间描述 <span class="hint">可念给玩家</span></h3>
    <textarea oninput="upd('desc',this.value)" placeholder="写下对这个房间的描述…">${esc(r.desc)}</textarea></div>`;
  }
  return `<div class="item compact rd" title="点击复制房间描述" onclick="copyRoomDesc()">
    <div class="row">
      <span class="tag static" style="background:var(--accent)">房间</span>
      <div class="memo"><b>${esc(r.name) || '未命名'}</b>
        <span class="cd ${r.desc.trim() ? '' : 'emp'}">${r.desc.trim() ? esc(r.desc) : '（还没有描述，切到编辑模式填写）'}</span></div>
      <span class="copyi">📋</span>
    </div>
  </div>`;
}

// ===== 强化版手柄拖拽重排 =====
let dragType = null;
let dragSourceId = null;

function handleHandleDragStart(e, type, id) {
  dragType = type;
  dragSourceId = id;
  e.stopPropagation();
  e.dataTransfer.effectAllowed = 'move';
  e.dataTransfer.setData('text/plain', id);
  const card = e.target.closest('.item');
  if (card) {
    setTimeout(() => card.classList.add('dragging'), 0);
  }
}

function handleCardDragOver(e) {
  e.preventDefault();
  e.dataTransfer.dropEffect = 'move';
  const card = e.currentTarget;
  if (!card || card.dataset.id === dragSourceId) return;
  const rect = card.getBoundingClientRect();
  const midY = rect.top + rect.height / 2;
  if (e.clientY < midY) {
    card.classList.add('drag-over-top');
    card.classList.remove('drag-over-bottom');
  } else {
    card.classList.add('drag-over-bottom');
    card.classList.remove('drag-over-top');
  }
}

function handleCardDragLeave(e) {
  const card = e.currentTarget;
  if (card) card.classList.remove('drag-over-top', 'drag-over-bottom');
}

function handleCardDragEnd(e) {
  document.querySelectorAll('.item').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));
  dragType = null;
  dragSourceId = null;
}

function handleCardDrop(e, type, targetId) {
  e.preventDefault();
  e.stopPropagation();
  const card = e.currentTarget;
  const isTop = card && card.classList.contains('drag-over-top');
  document.querySelectorAll('.item').forEach(c => c.classList.remove('drag-over-top', 'drag-over-bottom', 'dragging'));

  if (dragType !== type || !dragSourceId || dragSourceId === targetId) return;
  const r = room(sel); if (!r) return;
  const list = type === 'item' ? r.items : r.entities;

  const fromIdx = list.findIndex(x => x.id === dragSourceId);
  if (fromIdx === -1) return;
  const [moved] = list.splice(fromIdx, 1);

  let toIdx = list.findIndex(x => x.id === targetId);
  if (toIdx === -1) { list.push(moved); }
  else {
    if (!isTop) toIdx += 1;
    list.splice(toIdx, 0, moved);
  }

  save(); renderSide();
}

function entityListCard(r) {
  const list = (r.entities || []).map(en => {
    const isCur = selEntity && selEntity.id === en.id;
    return `<div class="item compact npc ${isCur ? 'sel' : ''}" style="${isCur ? 'outline:2px solid var(--accent)' : ''}"
      data-id="${en.id}"
      ${edit ? `ondragover="handleCardDragOver(event)" ondragleave="handleCardDragLeave(event)" ondrop="handleCardDrop(event,'entity','${en.id}')"` : ''}
      onclick="openEntity('${en.id}')">
      <div class="row">
        ${edit ? `<span class="drag-handle" title="按住拖拽排序" draggable="true" ondragstart="handleHandleDragStart(event,'entity','${en.id}')" ondragend="handleCardDragEnd(event)" onclick="event.stopPropagation()">⠿</span>` : ''}
        <span class="tag static npc">${esc(en.disposition || '中立')}</span>
        <div class="memo">
          <b>${esc(en.name) || '未命名实体'}</b>
          <span class="cd">${esc(en.category.toUpperCase())} · ${en.attrs.map(a => `${a.name}:${a.val}`).slice(0, 3).join(' / ') || '无属性'}</span>
        </div>
        <span style="font-size:12px;color:var(--accent)">详情 ❯</span>
      </div>
    </div>`;
  }).join('');

  return `<div class="card">
    <h3>🎭 固定场景 / 实体 / 遭遇 (${(r.entities || []).length})
      ${edit ? '<button class="primary" onclick="createEntity()">＋ 新建实体</button>' : ''}
    </h3>
    <div class="hint" style="margin-bottom:6px">${edit ? '按住左侧 ⠿ 手柄可上下拖拽排序。' : ''}点击展开独立属性与后果侧栏。</div>
    ${list || '<p class="hint">当前房间无固定实体/怪物</p>'}
  </div>`;
}

function renderSide() {
  const s = document.getElementById('side');
  const r = room(sel);
  if (!r) { s.classList.remove('open'); s.innerHTML = ''; return; }
  s.classList.add('open');
  const keep = s.scrollTop;
  const listItems = edit ? r.items : [...r.items.filter(i => !i.consumed), ...r.items.filter(i => i.consumed)];
  const here = playersIn(r.id);
  s.innerHTML = `
  <div class="sidehead">
    <input type="text" value="${esc(r.name)}" placeholder="房间名" oninput="upd('name',this.value)">
    ${edit ? `<button class="danger" onclick="delRoom('${r.id}')">删除</button>` : ''}
    <button onclick="closeSide()">✕</button>
  </div>
  <div class="card"><h3>📍 此处玩家 <span class="hint">在左侧玩家栏或「👥 玩家」里改位置</span></h3>
    <div class="here">${here.length ? here.map(i => `<span>${chipHtml(i)}${esc(pname(i))}</span>`).join('') : '<span class="hint">暂无玩家</span>'}</div></div>
  ${descCard(r)}
  ${entityListCard(r)}
  ${doorsCard(r)}
  <div class="card"><h3>🔒 DM 专属内容 <span class="hint">仅 DM 可见</span></h3>
    <textarea oninput="upd('dm',this.value)" placeholder="陷阱、NPC、隐藏机关、遭遇、注意事项…">${esc(r.dm)}</textarea></div>
  <div class="card"><h3>🎒 物资池
      ${edit ? '<button class="primary" onclick="addItem()">＋ 添加物资</button>' : '<span class="hint">点击卡片复制描述</span>'}</h3>
    <label class="s">整体判定条件 / 备注</label>
    <textarea style="min-height:50px" oninput="upd('poolNote',this.value)" placeholder="如：搜索检定 DC12；每人限搜一次…">${esc(r.poolNote)}</textarea>
    <div id="items">${listItems.map(edit ? itemHtml : itemCompact).join('') || '<p class="hint">暂无物资</p>'}</div>
  </div>`;
  s.scrollTop = keep;
}

// ===== 三级实体/遭遇侧栏 =====
function openEntity(id) {
  const r = room(sel); if (!r) return;
  selEntity = (r.entities || []).find(e => e.id === id);
  renderSide();
  renderEntitySide();
}
function closeEntitySide() {
  selEntity = null;
  renderSide();
  renderEntitySide();
}
function createEntity() {
  const r = room(sel); if (!r) return;
  const en = newEntity();
  r.entities.push(en);
  selEntity = en;
  save(); renderMap(); renderSide(); renderEntitySide();
}
function deleteCurEntity() {
  if (!confirm('确定删除该实体？此操作不可撤销。')) return;
  const r = room(sel); if (!r || !selEntity) return;
  r.entities = r.entities.filter(e => e.id !== selEntity.id);
  selEntity = null;
  save(); renderMap(); renderSide(); renderEntitySide();
}

function entityDescBox(en) {
  if (edit) {
    return `<div class="card">
      <h3>📖 外观与台词 / 呈现设定</h3>
      <textarea placeholder="念给玩家的外观、声音或初始动作…" oninput="selEntity.desc=this.value;save()">${esc(en.desc)}</textarea>
    </div>`;
  }
  return `<div class="item compact en-copy" title="点击复制外观与台词" onclick="copyEntityDesc()">
    <div class="row">
      <span class="tag static npc">台词/描述</span>
      <div class="memo">
        <b>${esc(en.name)} 的呈现</b>
        <span class="cd ${en.desc.trim() ? '' : 'emp'}">${en.desc.trim() ? esc(en.desc) : '（暂无描述，切到编辑模式填写）'}</span>
      </div>
      <span class="copyi">📋</span>
    </div>
  </div>`;
}

function entityActionsBox(en) {
  if (edit) {
    const actsHtml = en.actions.map((act, idx) => `
      <div class="act-item">
        <div class="act-head">
          <span style="font-size:12px;color:var(--accent);font-weight:bold">触发 #${idx + 1}</span>
          <input type="text" value="${esc(act.trigger)}" placeholder="触发时机/行为" oninput="selEntity.actions[${idx}].trigger=this.value;save()">
          <button class="danger" style="padding:2px 6px" onclick="selEntity.actions.splice(${idx},1);save();renderEntitySide()">✕</button>
        </div>
        <label class="s">结果 / 连锁反应 / 惩罚：</label>
        <textarea style="min-height:50px" placeholder="详细后果、反应或掉落…" oninput="selEntity.actions[${idx}].effect=this.value;save()">${esc(act.effect)}</textarea>
      </div>
    `).join('');
    return `<div class="card">
      <h3>⚡ 触发行为与后果判定
        <button class="primary" onclick="selEntity.actions.push({trigger:'',effect:''});save();renderEntitySide()">＋ 添加行为</button>
      </h3>
      <div class="hint" style="margin-bottom:6px">玩家做出不同交互时的具体判定与后果</div>
      ${actsHtml || '<p class="hint">暂未配置触发后果</p>'}
    </div>`;
  }
  const actsCompact = en.actions.map((act, idx) => `
    <div class="item compact en-copy act" title="点击复制该触发后果" onclick="copyEntityAction(${idx})">
      <div class="row">
        <span class="tag static" style="background:#e07b5e;color:#fff">触发 #${idx + 1}</span>
        <div class="memo">
          <b>${esc(act.trigger) || '（未设定时机）'}</b>
          <span class="cd ${act.effect.trim() ? '' : 'emp'}">${act.effect.trim() ? esc(act.effect) : '（暂无反应后果，切到编辑模式填写）'}</span>
        </div>
        <span class="copyi">📋</span>
      </div>
    </div>
  `).join('');
  return `<div class="card" style="margin-top:10px">
    <h3>⚡ 触发后果与反应 <span class="hint">点击卡片复制后果</span></h3>
    ${actsCompact || '<p class="hint">未配置任何触发行为</p>'}
  </div>`;
}

function renderEntitySide() {
  const es = document.getElementById('entitySide');
  if (!sel || !selEntity) { es.classList.remove('open'); es.innerHTML = ''; return; }
  es.classList.add('open');
  const en = selEntity;

  const attrsHtml = en.attrs.map((a, idx) => `
    <div style="display:flex;gap:6px;align-items:center;margin-bottom:6px">
      <input type="text" style="width:100px;flex:none" value="${esc(a.name)}" placeholder="属性名" ${!edit ? 'disabled' : ''} oninput="selEntity.attrs[${idx}].name=this.value;save()">
      <input type="text" style="flex:1" value="${esc(a.val)}" placeholder="值" oninput="selEntity.attrs[${idx}].val=this.value;save()">
      ${edit ? `<button class="danger" onclick="selEntity.attrs.splice(${idx},1);save();renderEntitySide()">✕</button>` : ''}
    </div>
  `).join('');

  es.innerHTML = `
    <div class="sidehead">
      <b style="color:var(--accent);font-size:15px">🎭 场景实体详情</b>
      <div class="spacer"></div>
      ${edit ? `<button class="danger" onclick="deleteCurEntity()">删除实体</button>` : ''}
      <button onclick="closeEntitySide()">✕</button>
    </div>

    <div class="card">
      <div style="display:flex;gap:6px;margin-bottom:8px">
        <input type="text" value="${esc(en.name)}" placeholder="实体名称" ${!edit ? 'disabled' : ''} oninput="selEntity.name=this.value;save();renderSide();renderMap()">
        <select style="width:110px;flex:none" ${!edit ? 'disabled' : ''} onchange="selEntity.category=this.value;save();renderSide()">
          <option value="npc" ${en.category === 'npc' ? 'selected' : ''}>NPC</option>
          <option value="monster" ${en.category === 'monster' ? 'selected' : ''}>怪物</option>
          <option value="trap" ${en.category === 'trap' ? 'selected' : ''}>陷阱/机关</option>
          <option value="object" ${en.category === 'object' ? 'selected' : ''}>交互物件</option>
        </select>
      </div>
      <div style="display:flex;gap:6px;align-items:center">
        <span style="font-size:12px;color:var(--mute);flex:none">初始态度：</span>
        <input type="text" value="${esc(en.disposition)}" placeholder="态度" oninput="selEntity.disposition=this.value;save();renderSide()">
      </div>
    </div>

    ${entityDescBox(en)}

    <div class="card">
      <h3>📊 属性与参数设定
        ${edit ? `<button onclick="selEntity.attrs.push({name:'新属性',val:''});save();renderEntitySide()">＋ 属性</button>` : ''}
      </h3>
      <div class="hint" style="margin-bottom:6px">如血量、护甲、豁免、攻击加值等</div>
      ${attrsHtml || '<p class="hint">暂无属性</p>'}
    </div>

    ${entityActionsBox(en)}

    <div class="card">
      <h3>🔒 DM 幕后备注</h3>
      <textarea placeholder="战术策略、动机、弱点…" oninput="selEntity.dmNote=this.value;save()">${esc(en.dmNote)}</textarea>
    </div>
  `;
}

function upd(k, v) { const r = room(sel); r[k] = v; save(); if (k === 'name') { renderMap(); if (!edit) renderSide(); } }

// ===== 物资卡片（带小字描述与手柄拖拽重排）=====
function pbtnsHtml(i) {
  return D.players.map((p, idx) => {
    const on = i.owners.includes(idx), c = pcolor(idx);
    const st = on ? `background:${c};border-color:${c};color:#111` : `border-color:${c}88`;
    return `<button class="pbtn ${on ? 'on' : ''}" style="${st}" onclick="toggleOwner('${i.id}',${idx})">${esc(pname(idx))}</button>`;
  }).join('');
}

function itemHtml(i) {
  const t = i.type === 'clue';
  return `<div class="item ${t ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}"
    data-id="${i.id}"
    ondragover="handleCardDragOver(event)"
    ondragleave="handleCardDragLeave(event)"
    ondrop="handleCardDrop(event,'item','${i.id}')">
    <div class="row">
      <span class="drag-handle" title="按住拖拽排序" draggable="true" ondragstart="handleHandleDragStart(event,'item','${i.id}')" ondragend="handleCardDragEnd(event)" onclick="event.stopPropagation()">⠿</span>
      <button class="tag ${i.type}" title="点击切换类型" onclick="itemType('${i.id}')">${t ? '线索' : '道具'}</button>
      <input type="text" value="${esc(i.name)}" placeholder="物资名称" oninput="itemUpd('${i.id}','name',this.value)">
      <button class="danger" onclick="delItem('${i.id}')">🗑</button>
    </div>
    <label class="s">描述</label>
    <textarea style="min-height:48px" oninput="itemUpd('${i.id}','desc',this.value)">${esc(i.desc)}</textarea>
    <label class="s">获取条件</label>
    <textarea style="min-height:40px" oninput="itemUpd('${i.id}','cond',this.value)" placeholder="如：侦查 DC15">${esc(i.cond)}</textarea>
    <div class="status">
      ${pbtnsHtml(i)}
      <button class="cbtn ${i.consumed ? 'on' : ''}" onclick="toggleConsumed('${i.id}')">${i.consumed ? '已消耗' : '消耗'}</button>
    </div>
  </div>`;
}

function itemCompact(i) {
  const t = i.type === 'clue';
  return `<div class="item compact ${t ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}" title="点击复制描述" onclick="copyDesc('${i.id}')">
    <div class="row">
      <span class="tag static ${i.type}">${t ? '线索' : '道具'}</span>
      <div class="memo">
        <b>${esc(i.name) || '（未命名）'}</b>
        ${i.cond ? `<span class="cd">条件: ${esc(i.cond)}</span>` : ''}
        ${i.desc ? `<span class="desc-p">${esc(i.desc)}</span>` : ''}
      </div>
      <span class="copyi">📋</span>
    </div>
    <div class="status" onclick="event.stopPropagation()">
      ${pbtnsHtml(i)}
      <button class="cbtn ${i.consumed ? 'on' : ''}" onclick="toggleConsumed('${i.id}')">${i.consumed ? '已消耗' : '消耗'}</button>
    </div>
  </div>`;
}

function addItem() { room(sel).items.push(newItem()); save(); renderSide(); renderMap(); }
function delItem(id) { const r = room(sel); r.items = r.items.filter(i => i.id !== id); save(); renderSide(); renderMap(); }
function itemType(id) { const i = getItem(id); i.type = i.type === 'clue' ? 'item' : 'clue'; save(); renderSide(); }
function itemUpd(id, k, v) { getItem(id)[k] = v; save(); }

function toggleOwner(id, idx) {
  const f = findItem(id), i = f.item;
  const had = i.owners.includes(idx);
  i.owners = had ? i.owners.filter(x => x !== idx) : [...i.owners, idx].sort((a, b) => a - b);
  addLog('item', `${pname(idx)} ${had ? '失去 / 交还' : '获得'}「${i.name || '未命名'}」（${i.type === 'clue' ? '线索' : '道具'}，来自 ${f.rid ? rname(f.rid) : '未分配'}）`, pcolor(idx));
  save(); renderSide(); renderMap();
}

function toggleConsumed(id) {
  const i = getItem(id); i.consumed = !i.consumed;
  addLog('item', `「${i.name || '未命名'}」${i.consumed ? '已消耗' : '恢复为未消耗'}`);
  save(); renderSide(); renderMap();
}

// ===== 日程（支持标题自定义）=====
const dayDlg = document.getElementById('dayDlg');
function updateDayBar() {
  const curTitle = dayLabel(D.curDay);
  document.getElementById('dayBtn').textContent = '📅 ' + curTitle;
  document.getElementById('endDayBtn').textContent = curTitle + ' 结束 ▶';
}
function openDays() { dayView = D.curDay; renderDays(); dayDlg.showModal(); }
function renderDays() {
  if (dayView >= D.days.length) dayView = D.days.length - 1;
  const nav = document.getElementById('dayNav');
  nav.innerHTML = D.days.map((d, i) => {
    const n = d.events.length, dn = d.events.filter(e => e.done).length;
    return `<button class="${i === dayView ? 'on' : ''} ${i === D.curDay ? 'cur' : ''}" onclick="dayView=${i};renderDays()">
      <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${esc(dayLabel(i))}</span>
      <span class="dtag">${i === D.curDay ? '🚩' : d.ended ? '✔' : ''}${n ? ` ${dn}/${n}` : ''}</span></button>`;
  }).join('') + `<button onclick="addDay()">＋ 新增一天</button>`;
  
  const d = D.days[dayView], isCur = dayView === D.curDay;
  const keep = document.getElementById('dayMain').scrollTop;
  const evs = d.events.map(e => `<div class="ev ${e.done ? 'done' : ''}">
      <div class="r1">
        <input type="checkbox" title="标记为已完成" ${e.done ? 'checked' : ''} onchange="evDone('${e.id}',this.checked)">
        <input type="text" class="tm" value="${esc(e.time)}" placeholder="时间" oninput="evUpd('${e.id}','time',this.value)">
        <input type="text" class="tt" value="${esc(e.title)}" placeholder="事件标题" oninput="evUpd('${e.id}','title',this.value)">
        <button onclick="evMove('${e.id}',-1)" title="上移">↑</button>
        <button onclick="evMove('${e.id}',1)" title="下移">↓</button>
        <button class="danger" onclick="evDel('${e.id}')">🗑</button>
      </div>
      <textarea placeholder="事件详情…" oninput="evUpd('${e.id}','detail',this.value)">${esc(e.detail)}</textarea>
    </div>`).join('') || '<p class="hint">这一天还没有事件，点击下方「＋ 添加事件」</p>';
  
  document.getElementById('dayMain').innerHTML = `
    <div class="dayhead">
      <input type="text" class="nm" style="width:220px;border-bottom:1px solid var(--accent);border-radius:4px"
        value="${esc(dayLabel(dayView))}"
        placeholder="名目 (如 Day 1 / 序幕)"
        title="点击直接修改此天名称"
        oninput="setDayTitle(${dayView},this.value)">
      ${isCur ? '<span class="badge2 cur">当前日</span>' : d.ended ? '<span class="badge2">已结束</span>' : '<span class="badge2">未开始</span>'}
      ${isCur ? `<button class="primary" onclick="endDay()">${esc(dayLabel(dayView))} 结束 ▶</button>` : `<button onclick="setCur(${dayView})">设为当前日</button>`}
      ${D.days.length > 1 ? `<button class="danger" onclick="delDay()">删除这一天</button>` : ''}
    </div>
    ${evs}
    <button class="primary" onclick="evAdd()">＋ 添加事件</button>`;
  document.getElementById('dayMain').scrollTop = keep;
  updateDayBar();
}

function setDayTitle(i, val) {
  D.days[i].title = val.trim() || `Day ${i + 1}`;
  save();
  updateDayBar();
  const navBtns = document.getElementById('dayNav').querySelectorAll('button');
  if (navBtns[i]) {
    const s = navBtns[i].querySelector('span');
    if (s) s.textContent = dayLabel(i);
  }
}

const evGet = id => D.days[dayView].events.find(e => e.id === id);
function evAdd() { D.days[dayView].events.push({ id: uid(), time: '', title: '', detail: '', done: false }); save(); renderDays(); }
function evDel(id) { const d = D.days[dayView]; d.events = d.events.filter(e => e.id !== id); save(); renderDays(); }
function evUpd(id, k, v) { evGet(id)[k] = v; save(); }
function evDone(id, v) { evGet(id).done = v; save(); renderDays(); }
function evMove(id, dir) {
  const a = D.days[dayView].events, i = a.findIndex(e => e.id === id), j = i + dir;
  if (j < 0 || j >= a.length) return;
  [a[i], a[j]] = [a[j], a[i]]; save(); renderDays();
}
function addDay() { D.days.push(newDay(D.days.length)); dayView = D.days.length - 1; save(); renderDays(); }
function delDay() {
  const d = D.days[dayView];
  if (!confirm(`删除「${dayLabel(dayView)}」？`)) return;
  D.days.splice(dayView, 1);
  if (dayView < D.curDay) D.curDay--;
  else if (dayView === D.curDay) D.curDay = Math.min(D.curDay, D.days.length - 1);
  dayView = Math.min(dayView, D.days.length - 1);
  save(); renderDays();
}
function setCur(i) { D.curDay = i; D.days[i].ended = false; dayView = i; save(); renderDays(); toast('当前进度：' + dayLabel(i)); }
function endDay() {
  const i = D.curDay, d = D.days[i];
  const undone = d.events.filter(e => !e.done);
  if (!confirm(`确认结束「${dayLabel(i)}」？` + (undone.length ? `\n还有 ${undone.length} 个事件未完成。` : ''))) return;
  let carry = false;
  if (undone.length) carry = confirm(`把这 ${undone.length} 个未完成事件顺延到下一天？\n\n确定 = 顺延　取消 = 保留`);
  addLog('day', `—— ${dayLabel(i)} 结束 ——`);
  d.ended = true;
  if (i === D.days.length - 1) D.days.push(newDay(D.days.length));
  const next = D.days[i + 1];
  if (carry) { d.events = d.events.filter(e => e.done); next.events.unshift(...undone); }
  D.curDay = i + 1; dayView = D.curDay; save();
  if (dayDlg.open) renderDays(); else updateDayBar();
  toast(`「${dayLabel(i)}」已结束，进入「${dayLabel(D.curDay)}」`);
}

// ===== 玩家管理 =====
function updatePlayerBar() { document.getElementById('playersBtn').textContent = `👥 玩家(${D.players.length})`; }
function openPlayers() { renderPlayers(); document.getElementById('playersDlg').showModal(); }
function renderPlayers() {
  document.getElementById('plCount').textContent = `共 ${D.players.length} 人`;
  document.getElementById('playersBox').innerHTML = D.players.map((p, i) =>
    `<div class="prow"><span>${i + 1}</span>
      <input type="color" value="${D.bg[i].color}" title="代表色" oninput="D.bg[${i}].color=this.value;save();renderMap();renderSide()">
      <input type="text" value="${esc(p)}" placeholder="玩家${i + 1}" oninput="D.players[${i}]=this.value;save();renderMap()">
      <select title="所在房间" onchange="setPlayerRoom(${i},this.value)">${roomSel(D.bg[i].roomId)}</select>
      <button class="danger" title="删除该玩家" onclick="delPlayer(${i})" ${D.players.length <= 1 ? 'disabled style="opacity:.3;cursor:not-allowed"' : ''}>🗑</button>
    </div>`).join('');
}
function addPlayer() {
  const n = D.players.length;
  D.players.push('玩家' + (n + 1));
  D.bg.push(blankBg(n));
  save(); renderPlayers(); updatePlayerBar(); renderSide();
  const b = document.getElementById('playersBox'); b.scrollTop = b.scrollHeight;
  const ins = b.querySelectorAll('input[type=text]'); if (ins.length) ins[ins.length - 1].select();
}
function delPlayer(i) {
  if (D.players.length <= 1) { toast('至少保留 1 名玩家'); return; }
  if (!confirm(`删除「${pname(i)}」？已分配物资将回到未分配池。`)) return;
  D.players.splice(i, 1);
  D.bg.splice(i, 1);
  const fix = it => { it.owners = it.owners.filter(o => o !== i).map(o => o > i ? o - 1 : o); };
  D.rooms.forEach(r => r.items.forEach(fix));
  D.pool.forEach(fix);
  if (bgSel > i) bgSel--;
  if (bgSel >= D.players.length) bgSel = D.players.length - 1;
  save(); renderPlayers(); updatePlayerBar(); renderSide(); renderMap();
}
function closePlayers() { document.getElementById('playersDlg').close(); renderSide(); }

// ===== 玩家背景与车卡 =====
const bgDlg = document.getElementById('bgDlg');
bgDlg.addEventListener('close', () => { renderSide(); });
function openBg() { if (bgSel >= D.players.length) bgSel = 0; renderBg(); if (!bgDlg.open) bgDlg.showModal(); }
function renderBg() {
  const keep = document.getElementById('bgMain').scrollTop;
  document.getElementById('bgNav').innerHTML = D.players.map((p, i) =>
    `<button id="bgn${i}" class="${i === bgSel ? 'on' : ''}" style="border-left:4px solid ${pcolor(i)}" onclick="bgSel=${i};renderBg()">${i + 1}. ${esc(pname(i))}</button>`).join('');
  const b = D.bg[bgSel], c = b.card, cfg = D.cardCfg;
  const sk = b.skills.map(s => `<div class="item ${s.type}">
      <div class="row">
        <button class="tag ${s.type}" title="点击切换：技能 / 道具" onclick="skType('${s.id}')">${s.type === 'skill' ? '技能' : '道具'}</button>
        <input type="text" value="${esc(s.name)}" placeholder="名称" oninput="skUpd('${s.id}','name',this.value)">
        <button class="danger" onclick="skDel('${s.id}')">🗑</button>
      </div>
      <textarea style="min-height:44px;margin-top:6px" placeholder="效果 / 限制…" oninput="skUpd('${s.id}','desc',this.value)">${esc(s.desc)}</textarea>
    </div>`).join('') || '<p class="hint">暂无，点击右上角添加</p>';
  const gl = b.goals.map(g => `<div class="goal ${g.done ? 'done' : ''}">
      <input type="checkbox" title="标记为已达成" ${g.done ? 'checked' : ''} onchange="goalDone('${g.id}',this.checked)">
      <textarea placeholder="例如：找到失踪的弟弟…" oninput="goalUpd('${g.id}',this.value)">${esc(g.text)}</textarea>
      <button class="danger" onclick="goalDel('${g.id}')">🗑</button>
    </div>`).join('') || '<p class="hint">暂无，点击右上角添加</p>';
  const used = cardUsed(c), remain = cfg.points - used;
  const info = INFO_FIELDS.map(([k, l]) =>
    `<label class="cf"><span>${l}</span><input type="text" value="${esc(c.info[k])}" oninput="D.bg[bgSel].card.info.${k}=this.value;save()"></label>`).join('');
  const attrs = cfg.attrs.map(a => `<div class="attr">
      <input type="text" class="an" value="${esc(a.name)}" title="属性名（所有玩家共用）" oninput="attrName('${a.id}',this.value)">
      <button onclick="attrStep('${a.id}',-1)">−</button>
      <input type="number" class="av" min="0" value="${+c.vals[a.id] || 0}" onchange="attrSet('${a.id}',this.value)">
      <button onclick="attrStep('${a.id}',1)">＋</button>
      <button class="x danger" title="删除此属性（所有玩家）" onclick="attrDel('${a.id}')">✕</button>
    </div>`).join('');
  document.getElementById('bgMain').innerHTML = `
    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px">
      <input type="color" value="${b.color}" title="代表色" oninput="D.bg[bgSel].color=this.value;save();renderMap()" onchange="renderBg()">
      <input type="text" class="nm" style="margin:0" value="${esc(D.players[bgSel])}" placeholder="角色 / 玩家名" oninput="D.players[bgSel]=this.value;save();renderMap();document.getElementById('bgn'+bgSel).textContent=(bgSel+1)+'. '+pname(bgSel)">
      <select style="width:160px;flex:none" title="所在房间" onchange="setPlayerRoom(bgSel,this.value)">${roomSel(b.roomId)}</select>
    </div>
    <div class="divider"><b>📜 模组预设</b><span>由作者设定</span></div>
    <div class="card"><h3>🪪 身份描述</h3>
      <textarea style="min-height:110px" oninput="D.bg[bgSel].identity=this.value;save()" placeholder="身份与背景…">${esc(b.identity)}</textarea></div>
    <div class="card"><h3>🧰 技能 / 道具 <button class="primary" onclick="skAdd()">＋ 添加</button></h3>${sk}</div>
    <div class="card"><h3>🎯 角色目的 <button class="primary" onclick="goalAdd()">＋ 添加</button></h3>${gl}</div>
    <div class="divider"><b>📝 玩家车卡</b><span>由玩家自己填写</span></div>
    <div class="card"><h3>基础信息</h3><div class="cgrid">${info}</div></div>
    <div class="card"><h3>📊 属性分配 <button onclick="attrAdd()">＋ 新属性</button></h3>
      <div class="ptsbar">
        <span>可分配属性点数</span><input type="number" min="0" value="${cfg.points}" onchange="cfgPoints(this.value)"><span>点</span>
        <span class="mini">已用 ${used}</span>
        <span class="remain ${remain < 0 ? 'over' : remain === 0 ? 'zero' : 'ok'}">剩余 ${remain}</span>
      </div>
      <div class="cgrid">${attrs}</div>
    </div>
    <div class="card"><h3>🎒 随身物品</h3>
      <textarea oninput="D.bg[bgSel].card.items=this.value;save()" placeholder="自带物品…">${esc(c.items)}</textarea></div>
    <div class="card"><h3>🎭 其他背景</h3>
      <textarea style="min-height:110px" oninput="D.bg[bgSel].card.other=this.value;save()" placeholder="外貌性格…">${esc(c.other)}</textarea></div>
    <div style="text-align:right"><button onclick="copyBg()">📋 复制为文本（发给玩家）</button></div>`;
  document.getElementById('bgMain').scrollTop = keep;
}

const bgSk = id => D.bg[bgSel].skills.find(s => s.id === id);
const bgGl = id => D.bg[bgSel].goals.find(g => g.id === id);
function skAdd() { D.bg[bgSel].skills.push({ id: uid(), type: 'skill', name: '', desc: '' }); save(); renderBg(); }
function skDel(id) { const b = D.bg[bgSel]; b.skills = b.skills.filter(s => s.id !== id); save(); renderBg(); }
function skType(id) { const s = bgSk(id); s.type = s.type === 'skill' ? 'item' : 'skill'; save(); renderBg(); }
function skUpd(id, k, v) { bgSk(id)[k] = v; save(); }
function goalAdd() { D.bg[bgSel].goals.push({ id: uid(), text: '', done: false }); save(); renderBg(); }
function goalDel(id) { const b = D.bg[bgSel]; b.goals = b.goals.filter(g => g.id !== id); save(); renderBg(); }
function goalUpd(id, v) { bgGl(id).text = v; save(); }
function goalDone(id, v) { bgGl(id).done = v; save(); renderBg(); }

function attrSet(id, v) {
  const c = D.bg[bgSel].card;
  v = Math.max(0, Math.floor(+v) || 0);
  const old = +c.vals[id] || 0;
  const others = cardUsed(c) - old;
  const max = Math.max(0, D.cardCfg.points - others);
  if (v > max) { v = max; toast('属性点不够了'); }
  c.vals[id] = v;
  if (v !== old) {
    const a = D.cardCfg.attrs.find(a => a.id === id);
    addLog('attr', `${pname(bgSel)} 的「${a.name}」 ${old} → ${v}（${v > old ? '+' : ''}${v - old}）`, pcolor(bgSel));
  }
  save(); renderBg();
}
function attrStep(id, d) { attrSet(id, (+D.bg[bgSel].card.vals[id] || 0) + d); }
function attrName(id, v) { D.cardCfg.attrs.find(a => a.id === id).name = v; save(); }
function attrAdd() { D.cardCfg.attrs.push({ id: uid(), name: '新属性', show: true }); save(); renderBg(); }
function attrDel(id) {
  if (!confirm('删除这个属性？所有玩家的该项数值都会清除。')) return;
  D.cardCfg.attrs = D.cardCfg.attrs.filter(a => a.id !== id);
  D.bg.forEach(b => delete b.card.vals[id]); save(); renderBg();
}
function cfgPoints(v) { D.cardCfg.points = Math.max(0, Math.floor(+v) || 0); save(); renderBg(); }

function copyBg() {
  const b = D.bg[bgSel], c = b.card, cfg = D.cardCfg;
  const t = `【${pname(bgSel)}】\n\n■ 身份\n${b.identity || '（无）'}\n\n■ 技能 / 道具\n` +
    (b.skills.length ? b.skills.map(s => `· [${s.type === 'skill' ? '技能' : '道具'}] ${s.name}：${s.desc}`).join('\n') : '（无）') +
    `\n\n■ 目的\n` + (b.goals.length ? b.goals.map((g, i) => `${i + 1}. ${g.text}`).join('\n') : '（无）') +
    `\n\n■ 基础信息\n` + INFO_FIELDS.map(([k, l]) => `${l}：${c.info[k] || '-'}`).join('　') +
    `\n\n■ 属性（共 ${cfg.points} 点，剩余 ${cfg.points - cardUsed(c)}）\n` + cfg.attrs.map(a => `${a.name} ${+c.vals[a.id] || 0}`).join('　') +
    `\n\n■ 随身物品\n${c.items || '（无）'}\n\n■ 其他背景\n${c.other || '（无）'}`;
  copyText(t).then(ok => ok ? toast('📋 已复制') : prompt('请手动复制：', t));
}

// ===== 物资总览池 =====
function openSummary() { renderPool(); document.getElementById('sumDlg').showModal(); }
function roomOpts(cur) {
  return `<option value="">📥 未分配</option>` + D.rooms.map(r =>
    `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`).join('');
}
function poolRow(i, rid) {
  const st = i.consumed ? '已消耗' : i.owners.length ? '已给 ' + i.owners.map(n => esc(pname(n))).join('、') : '';
  return `<div class="prow2 ${i.type === 'clue' ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}">
    <div class="l1">
      <button class="tag ${i.type}" onclick="poolType('${i.id}')" title="点击切换类型">${i.type === 'clue' ? '线索' : '道具'}</button>
      <input type="text" value="${esc(i.name)}" placeholder="物资名称" oninput="poolUpd('${i.id}','name',this.value)">
      ${st ? `<span class="mini">${st}</span>` : ''}
      <select onchange="moveItem('${i.id}',this.value)" title="分配到房间">${roomOpts(rid)}</select>
      <button class="danger" onclick="poolDel('${i.id}')">🗑</button>
    </div>
    <div class="l2">
      <input type="text" value="${esc(i.desc)}" placeholder="描述" oninput="poolUpd('${i.id}','desc',this.value)">
      <input type="text" value="${esc(i.cond)}" placeholder="获取条件" oninput="poolUpd('${i.id}','cond',this.value)">
    </div>
  </div>`;
}
function renderPool() {
  const q = poolQ.trim().toLowerCase();
  const ok = i => (!poolT || i.type === poolT) && (!q || [i.name, i.desc, i.cond].some(s => String(s || '').toLowerCase().includes(q)));
  const groups = [{ rid: '', name: '📥 未分配', list: D.pool, un: true }, ...D.rooms.map(r => ({ rid: r.id, name: '🚪 ' + (r.name || '未命名'), list: r.items }))];
  let total = 0, h = '';
  groups.forEach(g => {
    const shown = g.list.filter(ok); total += g.list.length;
    if (!shown.length && !g.un) return;
    h += `<div class="sec ${g.un ? 'un' : ''}"><span>${esc(g.name)}（${g.list.length}）</span></div>`;
    h += shown.length ? shown.map(i => poolRow(i, g.rid)).join('') : '<p class="hint" style="margin:2px 0 6px">暂无</p>';
  });
  document.getElementById('poolList').innerHTML = total ? h : h + '<p class="hint">还没有任何物资。点击右上「＋ 新物资」先创建一批，再分配到房间。</p>';
}
function addPoolItem() {
  D.pool.push(newItem()); save(); poolQ = ''; poolT = '';
  document.getElementById('poolQ').value = ''; document.getElementById('poolT').value = '';
  renderPool(); document.getElementById('poolList').scrollTop = 0;
}
function moveItem(id, to) {
  const f = findItem(id); if (!f) return;
  f.list.splice(f.list.indexOf(f.item), 1);
  (to === '' ? D.pool : room(to).items).push(f.item);
  save(); renderMap(); renderSide(); renderPool();
}
function poolUpd(id, k, v) { findItem(id).item[k] = v; save(); renderSide(); }
function poolType(id) { const i = getItem(id); i.type = i.type === 'clue' ? 'item' : 'clue'; save(); renderSide(); renderPool(); }
function poolDel(id) {
  if (!confirm('确定删除这件物资？')) return;
  const f = findItem(id); f.list.splice(f.list.indexOf(f.item), 1);
  save(); renderMap(); renderSide(); renderPool();
}

// ===== 导出手册控制器 =====
let hbMode = 'dm';
const hbOpts = () => ({
  dm: document.getElementById('hbDM').checked,
  pl: document.getElementById('hbPl').checked,
  st: document.getElementById('hbSt').checked,
  dup: document.getElementById('hbDup').checked,
  bg: document.getElementById('hpBg').checked,
  fill: document.getElementById('hpFill').checked,
  split: document.getElementById('hpSplit').checked
});
const hbBuild = () => hbMode === 'dm' ? hbHtml(hbOpts()) : hpHtml(hbOpts());

function setHbMode(m) {
  hbMode = m;
  document.getElementById('hbTabDm').classList.toggle('on', m === 'dm');
  document.getElementById('hbTabPl').classList.toggle('on', m === 'pl');
  document.getElementById('hbOptDm').style.display = m === 'dm' ? 'flex' : 'none';
  document.getElementById('hbOptPl').style.display = m === 'pl' ? 'flex' : 'none';
  refreshHandbook();
}
function openHandbook() { setHbMode(hbMode); document.getElementById('hbDlg').showModal(); }
function refreshHandbook() { document.getElementById('hbFrame').srcdoc = hbBuild(); }
function printHandbook() {
  const f = document.getElementById('hbFrame');
  try { f.contentWindow.focus(); f.contentWindow.print(); }
  catch (e) { toast('无法直接打印，请先「下载 HTML」后用浏览器打开再打印'); }
}
function downloadHandbook() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([hbBuild()], { type: 'text/html' }));
  a.download = (D.title || 'module') + (hbMode === 'dm' ? '-DM手册.html' : '-玩家发放版.html'); a.click();
}

// ===== 备份导出与导入 =====
document.getElementById('modTitle').value = D.title;
document.getElementById('modTitle').oninput = e => { D.title = e.target.value; save(); document.title = D.title + ' · DM 工具'; };

function exportData() {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(new Blob([JSON.stringify(D, null, 2)], { type: 'application/json' }));
  a.download = (D.title || 'module') + '.json'; a.click();
}

function importData(e) {
  const f = e.target.files[0]; if (!f) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result); if (!Array.isArray(d.rooms)) throw 0;
      D = migrate(d); sel = null; selEntity = null; save(); lastMin = null; bgSel = 0; dayView = D.curDay;
      document.getElementById('modTitle').value = D.title || '';
      renderMap(); renderSide(); renderEntitySide(); updateDayBar(); updatePlayerBar();
    } catch (_) { alert('文件格式不正确'); }
  };
  rd.readAsText(f); e.target.value = '';
}

function resetAll() {
  if (!confirm('将清空全部内容（建议先导出备份），确定吗？')) return;
  D = migrate(DEFAULT_DATA ? JSON.parse(JSON.stringify(DEFAULT_DATA)) : blankData());
  sel = null; selEntity = null; save(); lastMin = null; bgSel = 0; dayView = D.curDay;
  document.getElementById('modTitle').value = D.title;
  renderMap(); renderSide(); renderEntitySide(); updateDayBar(); updatePlayerBar();
}

// ===== 全局重绘钩子（供 P2P 联机同步调用）=====
function renderAllViews() {
  document.getElementById('modTitle').value = D.title || '';
  renderStrip();
  renderMap();
  renderSide();
  renderEntitySide();
  updateDayBar();
  updatePlayerBar();
  if (document.getElementById('bgDlg').open) renderBg();
  if (document.getElementById('dayDlg').open) renderDays();
  if (document.getElementById('sumDlg').open) renderPool();
  if (document.getElementById('logDlg').open) renderLog();
}

// ===== 页面启动初始化 =====
renderStrip();
renderMap();
updateDayBar();
updatePlayerBar();

// 启动 P2P 网络信道
if (typeof initP2PSync === 'function') {
  initP2PSync();
}
