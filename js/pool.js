// js/pool.js — 物资总览池与分配 (ES6 Module)
import { D, esc, room, pname } from './data.js';
import { uiState, save, newItem, findItem, getItem } from './core.js';

// ════════════════════════════════════════════════════════════
// 1. 局部状态与事件监听
// ════════════════════════════════════════════════════════════
// 将搜索状态挂载到 uiState (或者保持局部变量也可，这里为了统一模式)
uiState.poolQ = '';
uiState.poolT = '';

window.addEventListener('trpg-ui-update', () => {
  if (document.getElementById('sumDlg')?.open) {
    renderPool();
  }
});

// ════════════════════════════════════════════════════════════
// 2. 弹窗与渲染
// ════════════════════════════════════════════════════════════
export function openSummary() {
  if (!Array.isArray(D.pool)) D.pool = [];
  renderPool();
  document.getElementById('sumDlg').showModal();
}

function roomOpts(cur) {
  return `<option value="">📥 未分配</option>` +
    D.rooms.map(r =>
      `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`
    ).join('');
}

function poolRow(i, rid) {
  const st = i.consumed
    ? '已消耗'
    : i.owners.length
      ? '已给 ' + i.owners.map(n => esc(pname(n))).join('、')
      : '';
  return `<div class="prow2 ${i.type === 'clue' ? 'clue' : ''} ${i.consumed ? 'consumed' : ''}">
    <div class="l1">
      <button class="tag ${i.type}" onclick="poolType('${i.id}')">${i.type === 'clue' ? '线索' : '道具'}</button>
      <input type="text" value="${esc(i.name)}" placeholder="物资名称" oninput="poolUpd('${i.id}','name',this.value)">
      ${st ? `<span class="mini">${st}</span>` : ''}
      <select onchange="moveItem('${i.id}',this.value)">${roomOpts(rid)}</select>
      <button class="danger" onclick="poolDel('${i.id}')">🗑</button>
    </div>
    <div class="l2">
      <input type="text" value="${esc(i.desc)}" placeholder="描述" oninput="poolUpd('${i.id}','desc',this.value)">
      <input type="text" value="${esc(i.cond)}" placeholder="获取条件" oninput="poolUpd('${i.id}','cond',this.value)">
    </div>
  </div>`;
}

export function renderPool() {
  if (!Array.isArray(D.pool)) D.pool = [];

  const body = document.getElementById('poolList');
  if (!body) return;

  const q = uiState.poolQ.trim().toLowerCase();
  const ok = i =>
    (!uiState.poolT || i.type === uiState.poolT) &&
    (!q || [i.name, i.desc, i.cond].some(s => String(s || '').toLowerCase().includes(q)));

  const groups = [
    { rid: '', name: '📥 未分配', list: D.pool, un: true },
    ...D.rooms.map(r => ({ rid: r.id, name: '🚪 ' + (r.name || '未命名'), list: r.items }))
  ];

  let total = 0;
  let h = '';

  groups.forEach(g => {
    const shown = g.list.filter(ok);
    total += g.list.length;
    if (!shown.length && !g.un) return;
    h += `<div class="sec ${g.un ? 'un' : ''}"><span>${esc(g.name)}（${g.list.length}）</span></div>`;
    h += shown.length
      ? shown.map(i => poolRow(i, g.rid)).join('')
      : '<p class="hint" style="margin:2px 0 6px">暂无</p>';
  });

  body.innerHTML = total
    ? h
    : h + '<p class="hint">还没有任何物资。</p>';
}

// ════════════════════════════════════════════════════════════
// 3. 物资操作
// ════════════════════════════════════════════════════════════
export function addPoolItem() {
  if (!Array.isArray(D.pool)) D.pool = [];
  D.pool.push(newItem());
  
  uiState.poolQ = '';
  uiState.poolT = '';
  const qEl = document.getElementById('poolQ');
  const tEl = document.getElementById('poolT');
  if (qEl) qEl.value = '';
  if (tEl) tEl.value = '';
  
  save(); // 触发 renderPool
  
  // 滚动到顶部需要在 DOM 更新后执行
  setTimeout(() => {
    const list = document.getElementById('poolList');
    if (list) list.scrollTop = 0;
  }, 0);
}

export function moveItem(id, to) {
  const f = findItem(id);
  if (!f) return;
  f.list.splice(f.list.indexOf(f.item), 1);
  (to === '' ? D.pool : room(to).items).push(f.item);
  save();
}

export function poolUpd(id, k, v) {
  const f = findItem(id);
  if (!f) return;
  f.item[k] = v;
  save();
}

export function poolType(id) {
  const i = getItem(id);
  if (!i) return;
  i.type = i.type === 'clue' ? 'item' : 'clue';
  save();
}

export function poolDel(id) {
  if (!confirm('确定删除这件物资？')) return;
  const f = findItem(id);
  if (!f) return;
  f.list.splice(f.list.indexOf(f.item), 1);
  save();
}

// ════════════════════════════════════════════════════════════
// 4. 初始化与挂载
// ════════════════════════════════════════════════════════════
export function initPoolSearch() {
  const qEl = document.getElementById('poolQ');
  const tEl = document.getElementById('poolT');
  if (qEl) qEl.addEventListener('input', e => { uiState.poolQ = e.target.value; renderPool(); });
  if (tEl) tEl.addEventListener('change', e => { uiState.poolT = e.target.value; renderPool(); });
}

// 页面加载后自动初始化搜索绑定
document.addEventListener('DOMContentLoaded', initPoolSearch);

// 挂载全局方法
Object.assign(window, {
  openSummary, addPoolItem, moveItem, poolUpd, poolType, poolDel
});