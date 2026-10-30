// js/pool.js — 物资总览池与分配
// 依赖：data.js（D, uid, esc, saveData, room, findItem, getItem, newItem, pname）
// 依赖：core.js（save, toast, renderSide, renderMap）

let poolQ = '';
let poolT = '';

// ── 打开弹窗 ──────────────────────────────────────────────────
function openSummary() {
  if (!Array.isArray(D.pool)) D.pool = [];
  renderPool();
  document.getElementById('sumDlg').showModal();
}

// ── 房间下拉（含"未分配"选项）────────────────────────────────
function roomOpts(cur) {
  return `<option value="">📥 未分配</option>` +
    D.rooms.map(r =>
      `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`
    ).join('');
}

// ── 单行物资渲染 ──────────────────────────────────────────────
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

// ── 主渲染函数 ────────────────────────────────────────────────
function renderPool() {
  if (!Array.isArray(D.pool)) D.pool = [];

  const body = document.getElementById('poolList');
  if (!body) return;

  const q = poolQ.trim().toLowerCase();
  const ok = i =>
    (!poolT || i.type === poolT) &&
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

// ── 新增物资到未分配池 ────────────────────────────────────────
function addPoolItem() {
  if (!Array.isArray(D.pool)) D.pool = [];
  D.pool.push(newItem());
  save();
  poolQ = '';
  poolT = '';
  const qEl = document.getElementById('poolQ');
  const tEl = document.getElementById('poolT');
  if (qEl) qEl.value = '';
  if (tEl) tEl.value = '';
  renderPool();
  const list = document.getElementById('poolList');
  if (list) list.scrollTop = 0;
}

// ── 搬移物资（房间 ↔ 未分配池）──────────────────────────────
function moveItem(id, to) {
  const f = findItem(id);
  if (!f) return;
  f.list.splice(f.list.indexOf(f.item), 1);
  (to === '' ? D.pool : room(to).items).push(f.item);
  save();
  renderMap();
  renderSide();
  renderPool();
}

// ── 字段更新 ──────────────────────────────────────────────────
function poolUpd(id, k, v) {
  const f = findItem(id);
  if (!f) return;
  f.item[k] = v;
  save();
  renderSide();
}

// ── 切换类型（道具/线索）────────────────────────────────────
function poolType(id) {
  const i = getItem(id);
  if (!i) return;
  i.type = i.type === 'clue' ? 'item' : 'clue';
  save();
  renderSide();
  renderPool();
}

// ── 删除物资 ──────────────────────────────────────────────────
function poolDel(id) {
  if (!confirm('确定删除这件物资？')) return;
  const f = findItem(id);
  if (!f) return;
  f.list.splice(f.list.indexOf(f.item), 1);
  save();
  renderMap();
  renderSide();
  renderPool();
}

// ── 搜索/筛选输入绑定（页面加载后调用）──────────────────────
function initPoolSearch() {
  const qEl = document.getElementById('poolQ');
  const tEl = document.getElementById('poolT');
  if (qEl) qEl.addEventListener('input', e => { poolQ = e.target.value; renderPool(); });
  if (tEl) tEl.addEventListener('change', e => { poolT = e.target.value; renderPool(); });
}