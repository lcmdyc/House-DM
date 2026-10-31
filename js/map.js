// js/map.js — 地图渲染 + 平移拖拽 + 门配置 (ES6 Module)
import { D, room, at, sideOf, SIDES, OPP, DOOR_T, doorSym, blankRoom, playersIn, esc, isGot, pname, pcolor } from './data.js';
import { uiState, save, toast, chipHtml } from './core.js'; // 👈 这里补上了 chipHtml 的引入

const CELL_W = 130 + 14;
const CELL_H = 100 + 14;

// ── DOM 引用（函数内获取，避免顶层执行时 DOM 未就绪）────────
const getWrap = () => document.getElementById('mapWrap');
const getGrid = () => document.getElementById('grid');

// ════════════════════════════════════════════════════════════
// 1. 平移与缩放视图
// ════════════════════════════════════════════════════════════
function applyPan() {
  const wrap = getWrap(), grid = getGrid();
  if (!wrap || !grid) return;
  grid.style.transform = `translate(${uiState.pan.x}px,${uiState.pan.y}px)`;
  wrap.style.backgroundPosition = `${uiState.pan.x}px ${uiState.pan.y}px`;
}

export function centerView() {
  const wrap = getWrap(), grid = getGrid();
  if (!wrap || !grid) return;
  uiState.pan.x = Math.round((wrap.clientWidth  - grid.offsetWidth)  / 2);
  uiState.pan.y = Math.round((wrap.clientHeight - grid.offsetHeight) / 2);
  applyPan();
}
window.centerView = centerView;

export function initMapEvents() {
  const wrap = getWrap();
  if (!wrap) return;
  let drag = null, moved = false;

  wrap.addEventListener('pointerdown', e => {
    if (e.button !== 0 || e.target.closest('.add,#centerBtn,.empty')) return;
    drag = { sx: e.clientX, sy: e.clientY, px: uiState.pan.x, py: uiState.pan.y };
    moved = false;
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    moved = true;
    wrap.classList.add('dragging');
    uiState.pan.x = drag.px + dx;
    uiState.pan.y = drag.py + dy;
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
    uiState.pan.x -= e.shiftKey && !e.deltaX ? e.deltaY : e.deltaX;
    uiState.pan.y -= e.shiftKey && !e.deltaX ? 0 : e.deltaY;
    applyPan();
  }, { passive: false });
}
window.initMapEvents = initMapEvents;

// ════════════════════════════════════════════════════════════
// 2. 门渲染辅助
// ════════════════════════════════════════════════════════════
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

// ════════════════════════════════════════════════════════════
// 3. 地图主渲染
// ════════════════════════════════════════════════════════════
export function renderMap() {
  const grid = getGrid();
  if (!grid) return;
  if (!D.rooms.length) {
    grid.style.display = 'block';
    grid.innerHTML = '<div class="empty"><p>地图还是空的</p><button class="primary" onclick="addFirst()">＋ 创建第一个房间</button></div>';
    uiState.lastMin = null;
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
      
      const roomNpcs = (D.npcs || []).filter(n => n.roomId === r.id);
      
      const npcsHtml = roomNpcs.length
        ? `<div class="room-npcs">${roomNpcs.map(n =>
            `<i class="npc-chip" style="background:${n.color || '#b27cd8'}" title="${esc(n.name)}">${esc([...n.name][0] || '?')}</i>`
          ).join('')}</div>`
        : '';
        
      // 👈 删除了写死的 plHtml，直接在下面调用 here.map(chipHtml).join('')

      h += `<div class="cell" data-rid="${r.id}">
        <div class="room ${uiState.sel === r.id ? 'sel' : ''}" onclick="selectRoom('${r.id}')">
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
  if (!uiState.lastMin || uiState.lastMin.minX !== minX || uiState.lastMin.minY !== minY) {
    centerView();
    uiState.lastMin = newMin;
  }
}
window.renderMap = renderMap;

// 监听全局事件自动重绘
window.addEventListener('trpg-ui-update', renderMap);
window.addEventListener('trpg-data-loaded', renderMap);

// ════════════════════════════════════════════════════════════
// 4. 房间操作
// ════════════════════════════════════════════════════════════
export function addFirst() {
  const r = blankRoom(0, 0, '入口');
  D.rooms.push(r);
  save();
  selectRoom(r.id);
  centerView();
}

export function addRoom(id, dx, dy) {
  const r = room(id);
  if (at(r.x + dx, r.y + dy)) return;
  const n = blankRoom(r.x + dx, r.y + dy);
  r.doors[sideOf(dx, dy)] = { t: 'door', note: '' };
  n.doors[OPP[sideOf(dx, dy)]] = { t: 'door', note: '' };
  D.rooms.push(n);
  save();
  selectRoom(n.id);
}

export function delRoom(id) {
  const r = room(id);
  if (!confirm('确定删除该房间？' +
      (r.items.length ? '\n物资会回到未分配池。' : '') +
      (playersIn(id).length ? '\n玩家会变成未定位。' : ''))) return;
  D.pool.push(...r.items);
  D.bg.forEach(b => { if (b.roomId === id) b.roomId = ''; });
  D.rooms = D.rooms.filter(x => x.id !== id);
  
  if (uiState.sel === id) {
    uiState.sel = null;
    uiState.selEntity = null;
  }
  save();
  if (window.renderSide) window.renderSide();
}

export function selectRoom(id) {
  uiState.sel = id;
  uiState.selEntity = null;
  renderMap();
  if (window.renderSide) window.renderSide();
  if (window.renderEntitySide) window.renderEntitySide();
}

// ════════════════════════════════════════════════════════════
// 5. 门配置与卡片 (供 side.js 调用)
// ════════════════════════════════════════════════════════════
export function setDoor(s, t) {
  const r = room(uiState.sel);
  if (!t) delete r.doors[s];
  else r.doors[s] = { t, note: (r.doors[s] && r.doors[s].note) || '' };
  save(); 
  if (window.renderSide) window.renderSide();
}

export function setDoorNote(s, v) {
  const d = room(uiState.sel).doors[s];
  if (d) { d.note = v; save(); }
}

export function doorLock(s) {
  const d = room(uiState.sel).doors[s]; if (!d) return;
  d.t = d.t === 'lock' ? 'door' : 'lock';
  save(); 
  if (window.renderSide) window.renderSide();
  toast(d.t === 'lock' ? '🔒 已上锁' : '🔓 已开锁');
}

export function doorsCard(r) {
  if (uiState.edit) {
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

// 挂载到 window 供 HTML 内联调用
Object.assign(window, { addFirst, addRoom, delRoom, selectRoom, setDoor, setDoorNote, doorLock });
