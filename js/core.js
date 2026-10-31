// js/core.js — 全局 UI 状态、通用工具、日志系统 (ES6 Module)
import { D, saveData, uid, esc, pcolor, pname, dayLabel } from './data.js';

// ════════════════════════════════════════════════════════════
// 1. 全局 UI 状态 (UI State)
// ════════════════════════════════════════════════════════════
export const uiState = {
  sel: null,           // 当前选中的房间 ID
  selEntity: null,     // 当前选中的实体 (Room 内)
  selNpcId: null,      // 当前选中的 NPC ID (资料库)
  edit: true,          // 是否处于编辑模式
  bgSel: 0,            // 当前选中的玩家背景索引
  dayView: D.curDay,   // 日程表当前查看的天数
  logF: 'all',         // 日志过滤条件
  dragType: null,      // 拖拽类型
  dragSourceId: null,  // 拖拽源 ID
  pan: { x: 0, y: 0 }, // 地图平移坐标
  lastMin: null,       // 地图缩放相关
  hbMode: 'dm'         // 手册导出模式
};

export function save() {
  saveData(D);
  window.dispatchEvent(new CustomEvent('trpg-ui-update'));
}

// ════════════════════════════════════════════════════════════
// 2. 通用 DOM 工具 (DOM Utils)
// ════════════════════════════════════════════════════════════
let toastTimer;
export function toast(msg) {
  const t = document.getElementById('toast');
  if (!t) return;
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), 1800);
}

export async function copyText(text) {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch (err) { console.warn('Clipboard API failed', err); }
  
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.cssText = 'position:fixed;opacity:0';
  document.body.appendChild(ta);
  ta.select();
  let ok = false;
  try { ok = document.execCommand('copy'); } catch (_) {}
  ta.remove();
  return ok;
}

// ════════════════════════════════════════════════════════════
// 3. 业务辅助函数 (Business Helpers)
// ════════════════════════════════════════════════════════════
export const newItem = () => ({ id: uid(), type: 'item', name: '', desc: '', cond: '', owners: [], consumed: false });

export const chipHtml = i => {
  const b = D.bg[i];
  const cName = b?.card?.name?.trim();
  const ho = b?.ho?.trim();
  const pName = pname(i);
  
  let title = pName;
  if (cName) title = `${cName} (${pName})`;
  else if (ho) title = `${ho} (${pName})`;
  
  let text = '?';
  if (cName) {
    text = [...cName][0]; 
  } else if (ho) {
    text = ho.length <= 2 ? ho : [...ho][0]; 
  } else {
    text = [...pName][0]; 
  }
  
  return `<i class="chip" style="background:${pcolor(i)}" title="${esc(title)}">${esc(text)}</i>`;
};

export function findItem(id) {
  let l = D.pool.find(i => i.id === id);
  if (l) return { item: l, list: D.pool, rid: '' };
  for (const r of D.rooms) {
    const it = r.items.find(i => i.id === id);
    if (it) return { item: it, list: r.items, rid: r.id };
  }
  return null;
}

export const getItem = id => findItem(id)?.item;

export function roomSel(cur) {
  return `<option value="">📍 未定位</option>` +
    D.rooms.map(r =>
      `<option value="${r.id}" ${r.id === cur ? 'selected' : ''}>${esc(r.name) || '未命名'} (${r.x},${r.y})</option>`
    ).join('');
}

export function getAllItems() {
  return [...D.pool, ...D.rooms.flatMap(r => r.items)];
}

export function toggleItemOwner(itemId, ownerId) {
  const f = findItem(itemId);
  if (!f) return;
  const had = f.item.owners.includes(ownerId);
  if (had) {
    f.item.owners = f.item.owners.filter(x => x !== ownerId);
  } else {
    f.item.owners.push(ownerId);
  }
  save();
  window.dispatchEvent(new CustomEvent('trpg-ui-update'));
}

// 💡 修复：取消模糊匹配，直接精准匹配“角色姓名 (玩家姓名)”这种完整结构
export function parseText(text) {
  if (!text) return '';
  return String(text).replace(/\{\{(.*?)\}\}/g, (match, p1) => {
    const target = p1.trim().toLowerCase();
    
    const idx = D.bg.findIndex((b, i) => {
      const pName = (D.players[i] || '').trim();
      const cName = (b.card?.name || '').trim();
      const ho = (b.ho || '').trim();
      
      // 构造与左侧卡片完全一致的标签名：角色姓名 (玩家姓名)
      const dispName = cName ? `${cName} (${pName})` : pName;
      
      // 严格匹配：身份、玩家名、角色名、或完整的标签名
      return target === ho.toLowerCase() || 
             target === pName.toLowerCase() || 
             target === cName.toLowerCase() ||
             target === dispName.toLowerCase();
    });
    
    if (idx !== -1) {
      const b = D.bg[idx];
      const pName = (D.players[idx] || '').trim();
      const cName = (b.card?.name || '').trim();
      const dispName = cName ? `${cName} (${pName})` : pName;
      // 替换为带颜色的完整标签名
      return `<b style="color: ${b.color};">${esc(dispName)}</b>`;
    }
    
    return match;
  });
}

// ════════════════════════════════════════════════════════════
// 4. 日志系统 (Log System)
// ════════════════════════════════════════════════════════════
const LOG_TYPES = [['all','全部'],['item','📦 物品'],['attr','📊 属性'],['move','🚶 移动'],['day','🚩 日程']];
const logTime = ts => new Date(ts).toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit', hour12: false });
const logFiltered = () => D.log.filter(e => uiState.logF === 'all' || e.type === uiState.logF);

export function addLog(type, text, color = '') {
  D.log.push({ id: uid(), ts: Date.now(), day: D.curDay + 1, type, text, color });
  if (D.log.length > 2000) D.log.splice(0, D.log.length - 2000);
  const logDlg = document.getElementById('logDlg');
  if (logDlg && logDlg.open) renderLog();
}

export function openLog() { 
  renderLog(); 
  document.getElementById('logDlg').showModal(); 
}

export function renderLog() {
  const tabsEl = document.getElementById('logTabs');
  if (tabsEl) {
    tabsEl.innerHTML = LOG_TYPES.map(([k, l]) =>
      `<button class="${uiState.logF === k ? 'on' : ''}" data-filter="${k}">${l}</button>`
    ).join('');
  }

  const list = logFiltered().slice().reverse();
  const listEl = document.getElementById('logList');
  if (listEl) {
    listEl.innerHTML = list.length
      ? list.map(e =>
          `<div class="lg ${e.type}">
            <span class="ld">Day ${e.day}</span>
            <span class="lt">${logTime(e.ts)}</span>
            <span class="lx">${e.color ? `<i class="cdot" style="background:${e.color}"></i>` : ''}${parseText(esc(e.text))}</span>
          </div>`).join('')
      : '<p class="hint">暂无记录。</p>';
  }
}

export function copyLog() {
  const t = logFiltered().map(e => `[${dayLabel(e.day - 1)} ${logTime(e.ts)}] ${e.text}`).join('\n');
  if (!t) { toast('没有可复制的记录'); return; }
  copyText(t).then(ok => ok ? toast('📋 已复制日志') : prompt('请手动复制：', t));
}

export function clearLog() {
  if (!confirm('清空全部日志？')) return;
  D.log = []; 
  save(); 
  renderLog();
}

document.getElementById('logTabs')?.addEventListener('click', (e) => {
  if (e.target.tagName === 'BUTTON') {
    uiState.logF = e.target.dataset.filter;
    renderLog();
  }
});

// ════════════════════════════════════════════════════════════
// 5. 页签导航系统 (Navigation)
// ════════════════════════════════════════════════════════════
export function switchTab(tab) {
  document.getElementById('pageWorkbench').style.display = tab === 'workbench' ? 'flex' : 'none';
  document.getElementById('pageLibrary').style.display   = tab === 'library'   ? 'flex' : 'none';
  document.getElementById('tabWorkbench').classList.toggle('on', tab === 'workbench');
  document.getElementById('tabLibrary').classList.toggle('on',   tab === 'library');
  
  if (tab === 'library') {
    const active = document.querySelector('.lib-tab.on');
    if (!active) {
      switchLibTab('bg');
    } else {
      const sub = active.id.replace('libTab', '').toLowerCase();
      switchLibTab(sub);
    }
  }
}

export function switchLibTab(sub) {
  document.getElementById('libPageBg').style.display       = sub === 'bg'       ? 'flex' : 'none';
  document.getElementById('libPageNpc').style.display      = sub === 'npc'      ? 'flex' : 'none';
  document.getElementById('libPageRelation').style.display = sub === 'relation' ? 'flex' : 'none';
  document.getElementById('libTabBg').classList.toggle('on',       sub === 'bg');
  document.getElementById('libTabNpc').classList.toggle('on',      sub === 'npc');
  document.getElementById('libTabRelation').classList.toggle('on', sub === 'relation');
  
  window.dispatchEvent(new CustomEvent('trpg-lib-tab-changed', { detail: { sub } }));
}

// ════════════════════════════════════════════════════════════
// 6. 数据导入、导出与重置 (Data Management)
// ════════════════════════════════════════════════════════════
export function exportData() {
  const dataStr = JSON.stringify(D, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const safeName = (D.title || '未命名模组').replace(/[\\/:*?"<>|]/g, '_');
  
  const now = new Date();
  const timeStr = now.getFullYear().toString() +
                  (now.getMonth() + 1).toString().padStart(2, '0') +
                  now.getDate().toString().padStart(2, '0') + '-' +
                  now.getHours().toString().padStart(2, '0') +
                  now.getMinutes().toString().padStart(2, '0');

  a.download = `${safeName}_${timeStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
  toast('✅ 备份已导出');
}

export function importData(e) {
  const file = e?.target?.files?.[0];
  if (!file) return;
  
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const parsed = JSON.parse(ev.target.result);
      saveData(parsed);
      toast('✅ 数据已导入，正在刷新...');
      setTimeout(() => location.reload(), 500);
    } catch (err) {
      console.error("导入解析失败:", err);
      alert('导入失败：文件格式不正确');
    }
  };
  
  reader.readAsText(file);
  if (e.target) e.target.value = '';
}

export function resetData() {
  if (confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！')) {
    localStorage.removeItem('trpg_module_v1');
    location.reload();
  }
}

// ════════════════════════════════════════════════════════════
// 7. 模式切换 (Mode Toggle)
// ════════════════════════════════════════════════════════════
export function toggleMode() {
  uiState.edit = !uiState.edit;
  
  const btn = document.getElementById('modeBtn');
  if (btn) {
    btn.textContent = uiState.edit ? '✏️ 编辑模式' : '👁️ 带团模式';
    btn.classList.toggle('on', uiState.edit);
  }
  
  document.body.classList.toggle('edit', uiState.edit);
  save(); 
}

// ════════════════════════════════════════════════════════════
// 9. 顶部模组名称双向绑定
// ════════════════════════════════════════════════════════════
window.addEventListener('trpg-data-loaded', () => {
  const titleInput = document.getElementById('modTitle');
  if (titleInput) {
    titleInput.value = D.title || '未命名模组';
    titleInput.onchange = (e) => {
      D.title = e.target.value.trim() || '未命名模组';
      save();
      toast('✅ 模组名称已保存');
    };
  }
});

// ════════════════════════════════════════════════════════════
// 10. 模组库 (Module Library)
// ════════════════════════════════════════════════════════════
export async function openModLib() {
  const dlg = document.getElementById('modLibDlg');
  const listEl = document.getElementById('modLibList');
  const countEl = document.getElementById('modLibCount');
  if (!dlg || !listEl) return;

  dlg.showModal();
  listEl.innerHTML = '<p class="hint" style="padding:20px;text-align:center">🔄 正在加载模组列表...</p>';

  try {
    const res = await fetch('modules/index.json');
    if (!res.ok) throw new Error('无法获取模组列表');
    const mods = await res.json();

    countEl.textContent = `共 ${mods.length} 个模组`;

    listEl.innerHTML = mods.map(m => `
      <div class="card" style="margin-bottom: 12px; display: flex; flex-direction: column; gap: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <h3 style="margin:0; font-size: 16px; color: var(--accent);">
            ${esc(m.name)} <span style="font-size:12px;color:var(--mute);font-weight:normal">v${esc(m.version || '1.0')}</span>
          </h3>
          <button class="primary" onclick="loadModuleFromLib('${esc(m.file)}')">⬇️ 载入此模组</button>
        </div>
        <div style="font-size: 12px; color: var(--mute);">
          ✍️ 作者: ${esc(m.author || '未知')} | 👥 人数: ${esc(m.players || '未知')} | ⏳ 时长: ${esc(m.duration || '未知')}
        </div>
        <div style="font-size: 13px; color: var(--text); line-height: 1.5;">${esc(m.desc)}</div>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          ${(m.tags || []).map(t => `<span class="tag static" style="background: rgba(255,255,255,0.05); border: 1px solid var(--line); color: var(--text);">${esc(t)}</span>`).join('')}
        </div>
      </div>
    `).join('');
  } catch (err) {
    console.error("模组库加载失败:", err);
    listEl.innerHTML = '<p class="hint" style="padding:20px;text-align:center;color:var(--danger)">加载失败。请确保 modules/index.json 文件存在且格式正确。</p>';
  }
}

export async function loadModuleFromLib(fileUrl) {
  if (!confirm('⚠️ 载入新模组将覆盖当前所有数据（请确保已导出备份）。确定要继续吗？')) return;
  
  try {
    toast('🔄 正在下载模组数据...');
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error('无法下载模组文件');
    const parsed = await res.json();
    
    saveData(parsed);
    
    toast('✅ 模组载入成功，正在刷新...');
    setTimeout(() => location.reload(), 500);
  } catch (err) {
    console.error("模组载入失败:", err);
    alert('载入失败：' + err.message);
  }
}

// ════════════════════════════════════════════════════════════
// 8. 挂载全局函数 (供 HTML 中的 onclick 直接调用)
// ════════════════════════════════════════════════════════════

Object.assign(window, {
  exportData,
  importData,
  resetData,
  switchTab,
  switchLibTab,
  openLog,
  copyLog,
  clearLog,
  toggleMode,
  openModLib,
  loadModuleFromLib,
  getAllItems,
  toggleItemOwner,
  parseText // 👈 导出供其他文件使用
});
