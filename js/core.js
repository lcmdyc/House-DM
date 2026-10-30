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

// 统一的保存并触发 UI 更新
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
  
  // 1. 鼠标悬浮时的提示文字
  let title = pName;
  if (cName) title = `${cName} (${pName})`;
  else if (ho) title = `${ho} (${pName})`;
  
  // 2. 圆圈内的缩略字逻辑
  let text = '?';
  if (cName) {
    text = [...cName][0]; // 有名字，取名字第一个字
  } else if (ho) {
    // 没名字有身份，取身份（如果是 HO、HO1 这种短英文，最多显示2个字符避免撑出圆圈，否则取首字）
    text = ho.length <= 2 ? ho : [...ho][0]; 
  } else {
    text = [...pName][0]; // 兜底用玩家名首字
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
            <span class="lx">${e.color ? `<i class="cdot" style="background:${e.color}"></i>` : ''}${esc(e.text)}</span>
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
    if (!active) switchLibTab('bg');
    else window.dispatchEvent(new CustomEvent('trpg-tab-changed', { detail: { tab: active.id } }));
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
  
  // 获取模组名称并清理非法字符，防止作为文件名时报错
  const safeName = (D.name || '未命名模组').replace(/[\\/:*?"<>|]/g, '_');
  
  // 生成时间水印 YYYYMMDD-HHMM
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

export function importData() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json';
  input.onchange = e => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const parsed = JSON.parse(ev.target.result);
        Object.assign(D, parsed);
        save();
        toast('✅ 数据已导入，正在刷新...');
        setTimeout(() => location.reload(), 500);
      } catch (err) {
        alert('导入失败：文件格式不正确');
      }
    };
    reader.readAsText(file);
  };
  input.click();
}

export function resetData() {
  if (confirm('⚠️ 确定要重置所有数据吗？此操作不可恢复！')) {
    localStorage.removeItem('trpg_data');
    location.reload();
  }
}
// ════════════════════════════════════════════════════════════
// 8. 模式切换 (Mode Toggle)
// ════════════════════════════════════════════════════════════
export function toggleMode() {
  uiState.edit = !uiState.edit;
  
  // 更新按钮外观
  const btn = document.getElementById('modeBtn');
  if (btn) {
    btn.textContent = uiState.edit ? '✏️ 编辑模式' : '👁️ 带团模式';
    btn.classList.toggle('on', uiState.edit);
  }
  
  // 更新 body 的 class，方便 CSS 控制全局样式
  document.body.classList.toggle('edit', uiState.edit);
  
  // 保存并触发全局 UI 刷新
  save(); 
}
// ════════════════════════════════════════════════════════════
// 7. 挂载全局函数 (供 HTML 中的 onclick 直接调用)
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
  toggleMode // 👈 把这个加进去
});

