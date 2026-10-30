// js/app.js — 启动 · 导入导出 · 模组库 · 模式切换
// 依赖顺序：data.js → core.js → theme.js → p2p.js → handbook.js
//           → map.js → side.js → npc.js → players.js
//           → schedule.js → pool.js → relation.js → app.js

// ════════════════════════════════════════════════════════════
// 一、编辑 / 预览模式切换
// ════════════════════════════════════════════════════════════
function toggleMode() {
  edit = !edit;
  document.body.classList.toggle('edit', edit);
  const btn = document.getElementById('modeBtn');
  if (btn) {
    btn.textContent = edit ? '✏️ 编辑模式' : '👁 预览模式';
    btn.classList.toggle('on', edit);
  }
  renderBg();   // 预设区块两种模式渲染不同，必须重绘
}

// ════════════════════════════════════════════════════════════
// 二、模组库
// ════════════════════════════════════════════════════════════
let modList = [];

function openModLib() {
  loadModLib();
  document.getElementById('modLibDlg').showModal();
}

async function loadModLib() {
  const el = document.getElementById('modLibList');
  if (!el) return;
  el.innerHTML = '<p class="hint">加载中…</p>';
  try {
    const res = await fetch('modules/index.json');
    modList   = await res.json();
    renderModLib();
  } catch {
    el.innerHTML = '<p class="hint">⚠️ 无法加载模组列表（modules/index.json）</p>';
  }
}

function renderModLib() {
  const el = document.getElementById('modLibList');
  if (!el) return;
  if (!modList.length) { el.innerHTML = '<p class="hint">暂无模组</p>'; return; }
  el.innerHTML = modList.map((m, i) => `
    <div class="mod-card">
      <div class="mod-head">
        <span class="mod-name">${esc(m.name || '未命名模组')}</span>
        <span class="mod-tag">${esc(m.tag || '')}</span>
      </div>
      <p class="mod-desc">${esc(m.desc || '暂无简介')}</p>
      <div class="mod-meta">
        ${m.players  ? `👥 ${m.players}人`  : ''}
        ${m.duration ? `⏱ ${m.duration}`    : ''}
        ${m.author   ? `✍️ ${m.author}`      : ''}
      </div>
      <div class="mod-actions">
        <button class="primary" onclick="importMod(${i})">导入此模组</button>
        ${m.preview ? `<button onclick="previewMod(${i})">预览</button>` : ''}
      </div>
    </div>`
  ).join('');
}

async function importMod(i) {
  const m = modList[i];
  if (!m || !m.file) { toast('模组文件路径缺失'); return; }
  if (!confirm(`确定导入「${m.name}」？当前数据将被覆盖。`)) return;
  try {
    const res  = await fetch(`modules/${m.file}`);
    const data = await res.json();
    D = migrate(data);
    initNewData();
    saveData(D);
    document.getElementById('modLibDlg').close();
    fullRefresh();
    toast(`✅ 已导入模组「${m.name}」`);
    addLog('sys', `导入模组「${m.name}」`);
  } catch (e) {
    toast('导入失败：' + e.message);
  }
}

function previewMod(i) {
  const m = modList[i]; if (!m) return;
  alert(`【${m.name}】\n\n${m.desc || '暂无简介'}\n\n玩家数：${m.players || '?'}\n时长：${m.duration || '?'}\n作者：${m.author || '?'}`);
}

// ════════════════════════════════════════════════════════════
// 三、导入 / 导出
// ════════════════════════════════════════════════════════════
function exportData() {
  const json = JSON.stringify(D, null, 2);
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  // 文件名格式：模组名-house-dm-日期.json
  const modName = (D.title || '未命名模组').replace(/[\\/:*?"<>|]/g, '_');
  a.download = `${modName}-${new Date().toISOString().slice(0, 10)}.json`;
  a.click();
  URL.revokeObjectURL(url);
  toast('📤 已导出存档');
}


function importData(e) {
  if (e && e.target && e.target.files) {
    _doImport(e.target.files[0]);
    return;
  }
  const inp    = document.createElement('input');
  inp.type     = 'file';
  inp.accept   = '.json,application/json';
  inp.onchange = ev => _doImport(ev.target.files[0]);
  inp.click();
}

async function _doImport(file) {
  if (!file) return;
  try {
    const text = await file.text();
    const raw  = JSON.parse(text);
    D = migrate(raw);
    initNewData();
    saveData(D);
    fullRefresh();
    toast(`✅ 已导入「${file.name}」`);
    addLog('sys', `导入存档「${file.name}」`);
  } catch (err) {
    toast('❌ 导入失败：' + err.message);
  }
}

function resetData() {
  if (!confirm('确定重置所有数据？此操作不可撤销。')) return;
  D = migrate(blankData());
  initNewData();
  saveData(D);
  fullRefresh();
  toast('🔄 已重置数据');
  addLog('sys', '重置数据');
}

// ════════════════════════════════════════════════════════════
// 四、导入后初始化新字段
// ════════════════════════════════════════════════════════════
function initNewData() {
  D.relations = D.relations || [];
  D.pool      = D.pool      || [];
  D.npcs      = D.npcs      || [];
  D.days      = D.days      || [newDay(0)];
  D.curDay    = D.curDay    ?? 0;
  D.players   = D.players   || [];
  D.rooms     = D.rooms     || [];
  D.log       = D.log       || [];

  D.ui = D.ui || {};
  if (typeof D.ui.npcStrip !== 'boolean') D.ui.npcStrip = true;
  if (!Array.isArray(D.ui.npcVisible)) D.ui.npcVisible = [];

  D.bg = D.bg || [];
  D.players.forEach((_, i) => {
    D.bg[i] = D.bg[i] || {};
    D.bg[i].dead         = D.bg[i].dead        ?? false;
    D.bg[i].customFields = D.bg[i].customFields || [];
    D.bg[i].dmNote       = D.bg[i].dmNote       ?? '';   // ← DM备注
  });

  D.npcs.forEach(n => {
    n.dead         = n.dead         ?? false;
    n.customFields = n.customFields || [];
    n.color        = n.color        || '#b27cd8';
  });

  // 重置运行时状态
  dayView   = D.curDay;
  sel       = null;
  selEntity = null;
  selNpcId  = null;
  edit      = false;
  poolQ     = '';
  poolT     = '';
  if (typeof relPositions !== 'undefined') relPositions = {};

  // 同步模式按钮外观
  document.body.classList.toggle('edit', edit);
  const btn = document.getElementById('modeBtn');
  if (btn) {
    btn.textContent = edit ? '✏️ 编辑模式' : '👁 预览模式';
    btn.classList.toggle('on', edit);
  }
}

// ════════════════════════════════════════════════════════════
// 五、全局刷新
// ════════════════════════════════════════════════════════════
function fullRefresh() {
  const titleEl = document.getElementById('modTitle');
  if (titleEl) titleEl.value = D.title || '';

  renderMap();
  renderStrip();
  renderSide();

  if (typeof updatePlayerBar === 'function') updatePlayerBar();
  if (typeof updateDayBar    === 'function') updateDayBar();
  if (typeof renderNpcStrip  === 'function') setTimeout(renderNpcStrip, 0);

  // 资料库按当前激活子页刷新
  const activeSub = document.querySelector('.lib-tab.on');
  if (activeSub) {
    if (activeSub.id === 'libTabBg'       && typeof renderBg           === 'function') renderBg();
    if (activeSub.id === 'libTabNpc'      && typeof renderNpcLib       === 'function') renderNpcLib();
    if (activeSub.id === 'libTabRelation' && typeof renderRelationLib  === 'function') renderRelationLib();
  }

  if (document.getElementById('sumDlg')?.open && typeof renderPool === 'function') renderPool();
  if (document.getElementById('dayDlg')?.open && typeof renderDays === 'function') renderDays();
  if (document.getElementById('logDlg')?.open) renderLog();
}

// ════════════════════════════════════════════════════════════
// 六、启动
// ════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  try {
    const raw = localStorage.getItem(KEY);
    D = raw ? migrate(JSON.parse(raw)) : migrate(blankData());
  } catch {
    D = migrate(blankData());
  }

  initNewData();

  initMapEvents();   // map.js（theme.js 为 IIFE 已自执行）

  fullRefresh();

  if (typeof initP2P === 'function') initP2P();

  console.log('[House-DM] 启动完成');
});
