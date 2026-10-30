// js/core.js — 全局状态 + 工具函数
// 依赖：data.js（D, uid, esc, saveData, dayLabel, pname, pcolor, rname, room）

// ── NPC 数据初始化 ──────────────────────────────────────────────
if (!Array.isArray(D.npcs)) D.npcs = [];
if (!Array.isArray(D.pool)) D.pool = [];   // ← 修复：兜底初始化 pool
if (!D.ui) D.ui = {};
if (typeof D.ui.npcStrip !== 'boolean') D.ui.npcStrip = true;
if (!Array.isArray(D.ui.npcVisible)) D.ui.npcVisible = [];
// ── 关系 / 死亡标记 / 玩家自定义字段 初始化 ──
if (!Array.isArray(D.relations)) D.relations = [];
D.players.forEach((_, i) => {
  if (typeof D.bg[i].dead !== 'boolean') D.bg[i].dead = false;
  if (!Array.isArray(D.bg[i].customFields)) D.bg[i].customFields = [];
});
D.npcs.forEach(n => { if (typeof n.dead !== 'boolean') n.dead = false; });

// ── 全局 UI 状态 ──────────────────────────────────────────────
let sel       = null;
let selEntity = null;
let selNpcId  = null;
let edit      = true;
let bgSel     = 0;
let dayView   = D.curDay;
let logF      = 'all';
let dragType      = null;
let dragSourceId  = null;
let pan       = { x: 0, y: 0 };
let lastMin   = null;
let hbMode    = 'dm';

// ── save ──────────────────────────────────────────────────────
function save() {
  saveData(D);
  renderStrip();
  renderNpcStrip();
}

// ── Toast ─────────────────────────────────────────────────────
let toastT;
function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastT);
  toastT = setTimeout(() => t.classList.remove('show'), 1800);
}

// ── 剪贴板 ───────────────────────────────────────────────────
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
  if (navigator.clipboard && window.isSecureContext)
    return navigator.clipboard.writeText(text).then(() => true, () => fallback());
  return Promise.resolve(fallback());
}

// ── 物资辅助 ─────────────────────────────────────────────────
const newItem  = () => ({ id: uid(), type: 'item', name: '', desc: '', cond: '', owners: [], consumed: false });
const chipHtml = i => `<i class="chip" style="background:${pcolor(i)}" title="${esc(pname(i))}">${esc([...pname(i)][0] || '?')}</i>`;

function findItem(id) {
  let l = D.pool.find(i => i.id === id);
  if (l) return { item: l, list: D.pool, rid: '' };
  for (const r of D.rooms) {
    const it = r.items.find(i => i.id === id);
    if (it) return { item: it, list: r.items, rid: r.id };
  }
  return null;
}
const getItem = id => findItem(id).item;

// ── 日志 ─────────────────────────────────────────────────────
function addLog(type, text, color = '') {
  D.log.push({ id: uid(), ts: Date.now(), day: D.curDay + 1, type, text, color });
  if (D.log.length > 2000) D.log.splice(0, D.log.length - 2000);
  const logDlg = document.getElementById('logDlg');
  if (logDlg && logDlg.open) renderLog();
}

const LOG_TYPES = [['all','全部'],['item','📦 物品'],['attr','📊 属性'],['move','🚶 移动'],['day','🚩 日程']];
const logTime  = ts => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const logFiltered = () => D.log.filter(e => logF === 'all' || e.type === logF);

function openLog() { renderLog(); document.getElementById('logDlg').showModal(); }
function renderLog() {
  document.getElementById('logTabs').innerHTML = LOG_TYPES.map(([k, l]) =>
    `<button class="${logF === k ? 'on' : ''}" onclick="logF='${k}';renderLog()">${l}</button>`).join('');
  const list = logFiltered().slice().reverse();
  document.getElementById('logList').innerHTML = list.length
    ? list.map(e =>
        `<div class="lg ${e.type}">
           <span class="ld">Day ${e.day}</span>
           <span class="lt">${logTime(e.ts)}</span>
           <span class="lx">${e.color ? `<i class="cdot" style="background:${e.color}"></i>` : ''}${esc(e.text)}</span>
         </div>`).join('')
    : '<p class="hint">暂无记录。</p>';
}
function copyLog() {
  const t = logFiltered().map(e => `[${dayLabel(e.day - 1)} ${logTime(e.ts)}] ${e.text}`).join('\n');
  if (!t) { toast('没有可复制的记录'); return; }
  copyText(t).then(ok => ok ? toast('📋 已复制日志') : prompt('请手动复制：', t));
}
function clearLog() {
  if (!confirm('清空全部日志？')) return;
  D.log = []; saveData(D); renderLog();
}

// ── 房间下拉（被 players.js / side.js 共用）─────────────────
function roomSel(cur) {
  return `<option value="">📍 未定位</option>` +
    D.rooms.map(r =>
      `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`
    ).join('');
}

// ── 页签切换 ─────────────────────────────────────────────────
function switchTab(tab) {
  document.getElementById('pageWorkbench').style.display = tab === 'workbench' ? 'flex' : 'none';
  document.getElementById('pageLibrary').style.display   = tab === 'library'   ? 'flex' : 'none';
  document.getElementById('tabWorkbench').classList.toggle('on', tab === 'workbench');
  document.getElementById('tabLibrary').classList.toggle('on',   tab === 'library');
  if (tab === 'library') {
    const active = document.querySelector('.lib-tab.on');
    if (!active)                              switchLibTab('bg');
    else if (active.id === 'libTabNpc')       renderNpcLib();
    else if (active.id === 'libTabRelation')  renderRelationLib();
    else                                      renderBg();
  }
}

function switchLibTab(sub) {
  document.getElementById('libPageBg').style.display       = sub === 'bg'       ? 'flex' : 'none';
  document.getElementById('libPageNpc').style.display      = sub === 'npc'      ? 'flex' : 'none';
  document.getElementById('libPageRelation').style.display = sub === 'relation' ? 'flex' : 'none';
  document.getElementById('libTabBg').classList.toggle('on',       sub === 'bg');
  document.getElementById('libTabNpc').classList.toggle('on',      sub === 'npc');
  document.getElementById('libTabRelation').classList.toggle('on', sub === 'relation');
  if (sub === 'bg')       renderBg();
  if (sub === 'npc')      renderNpcLib();
  if (sub === 'relation') renderRelationLib();
}

// ── 全局重绘 ─────────────────────────────────────────────────
function renderAllViews() {
  document.getElementById('modTitle').value = D.title || '';
  renderStrip();
  renderNpcStrip();
  renderMap();
  renderSide();
  renderEntitySide();
  updateDayBar();
  updatePlayerBar();
  const dayDlg = document.getElementById('dayDlg');
  const sumDlg = document.getElementById('sumDlg');
  const logDlg = document.getElementById('logDlg');
  if (dayDlg && dayDlg.open) renderDays();
  if (sumDlg && sumDlg.open) renderPool();
  if (logDlg && logDlg.open) renderLog();
}