// js/map.js — 地图渲染 + 平移拖拽 + 门配置
// 依赖：data.js（D, uid, esc, saveData, room, at, sideOf, SIDES, OPP, DOOR_T, doorSym, blankRoom, playersIn）
// 依赖：core.js（sel, selEntity, edit, pan, lastMin, save, chipHtml, toast）
// 依赖：side.js（renderSide, renderEntitySide, closeSide）— 运行时调用，无需提前加载

const CELL_W = 130 + 14;
const CELL_H = 100 + 14;

// ── DOM 引用（函数内获取，避免顶层执行时 DOM 未就绪）────────
const getWrap = () => document.getElementById('mapWrap');
const getGrid = () => document.getElementById('grid');

// ── 平移 ─────────────────────────────────────────────────────
function applyPan() {
  const wrap = getWrap(), grid = getGrid();
  grid.style.transform = `translate(${pan.x}px,${pan.y}px)`;
  wrap.style.backgroundPosition = `${pan.x}px ${pan.y}px`;
}

function centerView() {
  const wrap = getWrap(), grid = getGrid();
  pan.x = Math.round((wrap.clientWidth  - grid.offsetWidth)  / 2);
  pan.y = Math.round((wrap.clientHeight - grid.offsetHeight) / 2);
  applyPan();
}

// ── 拖拽平移事件（由 app.js 启动时调用 initMapEvents）───────
function initMapEvents() {
  const wrap = getWrap();
  let drag = null, moved = false;

  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.add,#centerBtn,.empty')) return;
    drag = { sx: e.clientX, sy: e.clientY, px: pan.x, py: pan.y };
    moved = false;
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    wrap.classList.add('dragging');
    pan.x = drag.px + dx;
    pan.y = drag.py + dy;
    applyPan();
  });
  window.addEventListener('pointerup', () => {
    drag = null; wrap.classList.remove('dragging');
  });
  window.addEventListener('pointercancel', () => {
    drag = null; wrap.classList.remove('dragging');
  });
  wrap.addEventListener('click', e => {
    if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; }
  }, true);
  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    pan.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    pan.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    applyPan();
  }, { passive: false });
}

// ── 门渲染辅助 ───────────────────────────────────────────────
function doorTitle(s, d) {
  const l = SIDES.find(x => x[0] === s)[1];
  return `${l}：${DOOR_T[d.t]}${d.note ? '：' + d.note : ''}`;
}
function doorsHtml(r) {
  return SIDES.filter(([s]) => r.doors[s]).map(([s]) => {
    const d = r.doors[s];
    return `<i class="dr ${d.t} ${s}" title="${esc(doorTitle(s, d))}">${doorSym(d.t, s)}</i>`;
  }).join('');
}

// ── 地图渲染 ─────────────────────────────────────────────────
function renderMap() {
  const grid = getGrid();
  if (!D.rooms.length) {
    grid.style.display = 'block';
    grid.innerHTML = '<div class="empty"><p>地图还是空的</p><button class="primary" onclick="addFirst()">＋ 创建第一个房间</button></div>';
    lastMin = null;
    centerView();
    return;
  }
  grid.style.display = 'grid';
  const xs = D.rooms.map(r => r.x), ys = D.rooms.map(r => r.y);
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);
  grid.style.gridTemplateColumns = `repeat(${maxX - minX + 1},130px)`;

  let h = '';
  for (let y = minY; y <= maxY; y++) {
    for (let x = minX; x <= maxX; x++) {
      const r = at(x, y);
      if (!r) { h += '<div class="cell"></div>'; continue; }
      const total = r.items.length, got = r.items.filter(isGot).length;
      const here = playersIn(r.id);
      const nEntity = r.entities ? r.entities.length : 0;
      const btn = (cls, dx, dy) => at(x + dx, y + dy) ? '' :
        `<button class="add ${cls}" onclick="event.stopPropagation();addRoom('${r.id}',${dx},${dy})">+</button>`;
      const roomNpcs = D.npcs.filter(n => n.roomId === r.id);
      const npcsHtml = roomNpcs.length
        ? `<div class="room-npcs">${roomNpcs.map(n =>
            `<i class="npc-chip" style="background:${n.color || '#b27cd8'}" title="${esc(n.name)}">${esc([...n.name][0] || '?')}</i>`
          ).join('')}</div>`
        : '';
      h += `<div class="cell" data-rid="${r.id}">
        <div class="room ${sel === r.id ? 'sel' : ''}" onclick="select('${r.id}')">
          <div class="name">${esc(r.name) || '未命名'}</div>
          <div class="pl">${here.map(chipHtml).join('')}</div>
          <div class="stat"><span>${nEntity ? `🎭 ${nEntity} ` : ''}</span><span>${total ? `📦 ${got}/${total}` : '—'}</span></div>
        </div>
        ${npcsHtml}
        ${doorsHtml(r)}
        ${btn('t', 0, -1)}${btn('bm', 0, 1)}${btn('l', -1, 0)}${btn('r', 1, 0)}
      </div>`;
    }
  }
  grid.innerHTML = h;
  const newMin = { minX, minY };
  if (!lastMin || lastMin.minX !== minX || lastMin.minY !== minY) {
    centerView();
    lastMin = newMin;
  }
}

// ── 房间操作 ─────────────────────────────────────────────────
function addFirst() {
  const r = blankRoom(0, 0, '入口');
  D.rooms.push(r);
  save();
  select(r.id);
  centerView();
}

function addRoom(id, dx, dy) {
  const r = room(id);
  if (at(r.x + dx, r.y + dy)) return;
  const n = blankRoom(r.x + dx, r.y + dy);
  r.doors[sideOf(dx, dy)] = { t: 'door', note: '' };
  n.doors[OPP[sideOf(dx, dy)]] = { t: 'door', note: '' };
  D.rooms.push(n);
  save();
  select(n.id);
}

function delRoom(id) {
  const r = room(id);
  if (!confirm('确定删除该房间？' +
      (r.items.length ? '\n物资会回到未分配池。' : '') +
      (playersIn(id).length ? '\n玩家会变成未定位。' : ''))) return;
  D.pool.push(...r.items);
  D.bg.forEach(b => { if (b.roomId === id) b.roomId = ''; });
  D.rooms = D.rooms.filter(x => x.id !== id);
  if (sel === id) closeSide();
  save();
  renderMap();
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

// ── 门配置 ───────────────────────────────────────────────────
function setDoor(s, t) {
  const r = room(sel);
  if (!t) delete r.doors[s];
  else r.doors[s] = { t, note: (r.doors[s] && r.doors[s].note) || '' };
  save(); renderMap(); renderSide();
}

function setDoorNote(s, v) {
  const d = room(sel).doors[s];
  if (d) { d.note = v; save(); }
}

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
        <select onchange="setDoor('${s}',this.value)">
          <option value="">▭ 墙</option>
          ${Object.entries(DOOR_T).map(([k, v]) =>
            `<option value="${k}" ${d && d.t === k ? 'selected' : ''}>${v}</option>`).join('')}
        </select>
        ${d
          ? `<input type="text" value="${esc(d.note)}" placeholder="备注" oninput="setDoorNote('${s}',this.value)">`
          : `<span class="hint">${n ? '邻接：' + esc(n.name || '未命名') : '无邻接房间'}</span>`
        }</div>`;
    }).join('');
    return `<div class="card"><h3>🚪 门与通道</h3>${rows}</div>`;
  }
  const list = SIDES.filter(([s]) => r.doors[s]).map(([s, l, dx, dy]) => {
    const d = r.doors[s], n = at(r.x + dx, r.y + dy);
    const dest = ` ${d.t === 'in' ? '←' : '→'} ${n ? esc(n.name || '未命名') : '外部'}`;
    return `<div class="drow">
      <i class="dr ${d.t}">${doorSym(d.t, s)}</i>
      <span style="flex:1">${l} · ${DOOR_T[d.t]}${dest}${d.note ? `<span class="hint">　${esc(d.note)}</span>` : ''}</span>
      ${d.t === 'door' || d.t === 'lock'
        ? `<button onclick="doorLock('${s}')">${d.t === 'lock' ? '🔓 开锁' : '🔒 上锁'}</button>`
        : ''}
    </div>`;
  }).join('');
  return `<div class="card"><h3>🚪 门与通道</h3>${list || '<span class="hint">封闭空间</span>'}</div>`;
}