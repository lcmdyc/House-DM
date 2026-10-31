// js/schedule.js — 日程系统 (Day/事件管理) (ES6 Module)
import { D, uid, esc, newDay, dayLabel } from './data.js';
import { uiState, save, toast, addLog, copyText } from './core.js';

// ════════════════════════════════════════════════════════════
// 1. 自动响应 UI 更新事件
// ════════════════════════════════════════════════════════════
window.addEventListener('trpg-ui-update', () => {
  updateDayBar();
  if (document.getElementById('dayDlg')?.open) {
    renderDays();
  }
});

window.addEventListener('trpg-data-loaded', updateDayBar);

// ════════════════════════════════════════════════════════════
// 2. 工具栏按钮文字同步
// ════════════════════════════════════════════════════════════
export function updateDayBar() {
  const t = dayLabel(D.curDay);
  const dayBtn    = document.getElementById('dayBtn');
  const endDayBtn = document.getElementById('endDayBtn');
  if (dayBtn)    dayBtn.textContent    = '📅 ' + t;
  if (endDayBtn) endDayBtn.textContent = t + ' 结束 ▶';
}

// ════════════════════════════════════════════════════════════
// 3. 弹窗与主渲染
// ════════════════════════════════════════════════════════════
export function openDays() {
  uiState.dayView = D.curDay;
  renderDays();
  document.getElementById('dayDlg').showModal();
}

export function renderDays() {
  if (uiState.dayView >= D.days.length) uiState.dayView = D.days.length - 1;

  const navEl  = document.getElementById('dayNav');
  const mainEl = document.getElementById('dayMain');
  if (!navEl || !mainEl) return;

  // ====== 💡 新增：强制应用左右布局样式 ======
  const parent = navEl.parentElement;
  if (parent) {
    parent.style.display = 'flex';
    parent.style.flexDirection = 'row';
    parent.style.alignItems = 'stretch';
    parent.style.height = '65vh'; // 设定高度以支持内部独立滚动
    parent.style.minHeight = '400px';
  }
  
  // 左侧导航栏样式
  navEl.style.width = '220px';
  navEl.style.flexShrink = '0';
  navEl.style.overflowY = 'auto';
  navEl.style.borderRight = '1px solid var(--line)';
  navEl.style.paddingRight = '16px';
  navEl.style.display = 'flex';
  navEl.style.flexDirection = 'column';
  navEl.style.gap = '8px';

  // 右侧主内容区样式
  mainEl.style.flex = '1';
  mainEl.style.overflowY = 'auto';
  mainEl.style.paddingLeft = '16px';
  // ==========================================

  // ── 左侧 Day 标签列 ──
  navEl.innerHTML = D.days.map((d, i) => {
    const n = d.events.length, dn = d.events.filter(e => e.done).length;
    return `<div class="item day-card${i === uiState.dayView ? ' on' : ''}${i === D.curDay ? ' cur' : ''}"
      data-id="${i}"
      ${uiState.edit ? `ondragover="window.handleCardDragOver(event)"
        ondragleave="window.handleCardDragLeave(event)"
        ondrop="window.handleCardDrop(event,'day',${i})"` : ''}
      onclick="uiState.dayView=${i};renderDays()"
      style="padding:10px; cursor:pointer; border-radius:6px; transition:0.2s;">
      <div class="row" style="gap:4px; display:flex; align-items:center;">
        ${uiState.edit ? `<span class="drag-handle" draggable="true"
          ondragstart="window.handleHandleDragStart(event,'day',${i})"
          ondragend="window.handleCardDragEnd(event)"
          onclick="event.stopPropagation()">⠿</span>` : ''}
        <b style="font-size:13.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(dayLabel(i))}
        </b>
        <span class="dtag" style="font-size:12px; color:var(--mute)">${i === D.curDay ? '🚩' : d.ended ? '✔' : ''}${n ? ` ${dn}/${n}` : ''}</span>
      </div>
    </div>`;
  }).join('') +
  (uiState.edit ? `<button class="primary" onclick="addDay()" style="margin-top:6px;width:100%">＋ 新增一天</button>` : '');

  // ── 右侧当天详情 ──
  const d = D.days[uiState.dayView];
  if (!d) { mainEl.innerHTML = ''; return; }
  const isCur  = uiState.dayView === D.curDay;
  const keep   = mainEl.scrollTop;

  const evs = d.events.length
    ? d.events.map(e => uiState.edit ? evEditHtml(e) : evCompactHtml(e)).join('')
    : '<p class="hint" style="text-align:center; margin-top:40px; color:var(--mute);">这一天还没有事件</p>';

  mainEl.innerHTML = `
    <div class="dayhead" style="display:flex; align-items:center; flex-wrap:wrap; gap:10px; margin-bottom:16px; padding-bottom:12px; border-bottom:1px solid var(--line);">
      ${uiState.edit
        ? `<input type="text" class="nm"
             style="width:200px;border-bottom:2px solid var(--accent);border-radius:4px;font-size:16px;font-weight:bold;padding:4px 8px;background:var(--bg);"
             value="${esc(dayLabel(uiState.dayView))}"
             placeholder="Day 名称"
             oninput="setDayTitle(${uiState.dayView},this.value)">`
        : `<span class="nm" style="font-size:18px;font-weight:bold">${esc(dayLabel(uiState.dayView))}</span>`
      }
      ${isCur
        ? '<span class="badge2 cur" style="background:var(--accent);color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">当前日</span>'
        : d.ended
          ? '<span class="badge2" style="background:var(--mute);color:#fff;padding:2px 8px;border-radius:12px;font-size:12px;">已结束</span>'
          : '<span class="badge2" style="background:var(--bg-dark);color:var(--text);padding:2px 8px;border-radius:12px;font-size:12px;">未开始</span>'
      }
      <div style="flex:1"></div>
      ${isCur
        ? `<button class="primary" onclick="endDay()">${esc(dayLabel(uiState.dayView))} 结束 ▶</button>`
        : `<button onclick="setCur(${uiState.dayView})">设为当前日</button>`
      }
      ${uiState.edit && D.days.length > 1
        ? `<button class="danger" onclick="delDay()">删除这一天</button>`
        : ''
      }
    </div>
    <div style="display:flex; flex-direction:column; gap:12px;">
      ${evs}
    </div>
    ${uiState.edit ? `<button class="primary" onclick="evAdd()" style="margin-top:16px; width:100%; padding:10px;">＋ 添加事件</button>` : ''}`;

  mainEl.scrollTop = keep;
  updateDayBar();
}

// ════════════════════════════════════════════════════════════
// 4. 事件卡片 HTML 生成
// ════════════════════════════════════════════════════════════
function evEditHtml(e) {
  return `
    <div class="item${e.done ? ' done' : ''}" data-id="${e.id}"
      style="padding:12px; background:var(--card); border:1px solid var(--line); border-radius:8px;"
      ondragover="window.handleCardDragOver(event)"
      ondragleave="window.handleCardDragLeave(event)"
      ondrop="window.handleCardDrop(event,'event','${e.id}')">
      <div class="row" style="display:flex; gap:8px; align-items:center; margin-bottom:8px;">
        <span class="drag-handle" draggable="true"
          ondragstart="window.handleHandleDragStart(event,'event','${e.id}')"
          ondragend="window.handleCardDragEnd(event)"
          onclick="event.stopPropagation()">⠿</span>
        <input type="checkbox" style="width:18px;height:18px;cursor:pointer;" ${e.done ? 'checked' : ''} onchange="evDone('${e.id}',this.checked)">
        <input type="text" style="width:85px;flex:none;padding:6px;border-radius:4px;border:1px solid var(--line);" value="${esc(e.time)}"
          placeholder="时间" oninput="evUpd('${e.id}','time',this.value)">
        <input type="text" style="flex:1;font-weight:bold;padding:6px;border-radius:4px;border:1px solid var(--line);" value="${esc(e.title)}"
          placeholder="事件标题" oninput="evUpd('${e.id}','title',this.value)">
        <button class="danger" style="padding:6px 10px;" onclick="evDel('${e.id}')">✕</button>
      </div>
      <textarea style="width:100%; min-height:60px; padding:8px; border-radius:4px; border:1px solid var(--line); resize:vertical; box-sizing:border-box;"
        placeholder="事件详情..."
        oninput="evUpd('${e.id}','detail',this.value)">${esc(e.detail)}</textarea>
    </div>`;
}

function evCompactHtml(e) {
  return `
    <div class="item compact${e.done ? ' consumed' : ''}" onclick="copyEventDetail('${e.id}')"
      style="padding:12px; background:var(--card); border:1px solid var(--line); border-radius:8px; display:flex; justify-content:space-between; align-items:center; cursor:pointer; transition:0.2s;">
      <div class="row" style="display:flex; gap:12px; align-items:flex-start; flex:1;">
        <span class="tag static"
          style="background:${e.done ? '#888' : 'var(--accent)'};color:#fff;min-width:32px;height:32px;line-height:32px;text-align:center;border-radius:50%;display:inline-block;flex-shrink:0;">
          ${e.done ? '✔' : '📅'}
        </span>
        <div class="memo" style="flex:1; display:flex; flex-direction:column; gap:4px;">
          <b style="font-size:14.5px; color:${e.done ? 'var(--mute)' : 'var(--text)'}; text-decoration:${e.done ? 'line-through' : 'none'};">${esc(e.title) || '（未命名事件）'}</b>
          ${e.time   ? `<span class="cd" style="font-size:12px; color:var(--accent);">🕐 ${esc(e.time)}</span>`         : ''}
          ${e.detail ? `<span class="desc-p" style="font-size:13px; color:var(--mute); line-height:1.4;">${esc(e.detail)}</span>`       : ''}
        </div>
      </div>
      <div class="status" onclick="event.stopPropagation()" style="margin-left:12px; flex-shrink:0;">
        <button class="cbtn${e.done ? ' on' : ''}" style="padding:6px 12px; border-radius:4px;"
          onclick="evDone('${e.id}',${!e.done});renderDays()">
          ${e.done ? '✔ 已完成' : '标记完成'}
        </button>
      </div>
    </div>`;
}

export function copyEventDetail(id) {
  const ev = D.days.flatMap(d => d.events).find(e => e.id === id);
  if (!ev) return;
  const txt = [
    ev.title  || '（未命名）',
    ev.time   ? `时间：${ev.time}`  : '',
    ev.detail ? `\n${ev.detail}`    : ''
  ].filter(Boolean).join('\n');
  if (!txt.trim()) { toast('该事件没有可复制的内容'); return; }
  copyText(txt).then(ok => toast(ok ? '📋 已复制事件内容' : '复制失败'));
}

// ════════════════════════════════════════════════════════════
// 5. Day 操作
// ════════════════════════════════════════════════════════════
export function setDayTitle(i, val) {
  D.days[i].title = val.trim() || `Day ${i + 1}`;
  save();
  // 局部更新左侧对应标签文字，避免输入时失焦
  const navItems = document.getElementById('dayNav').querySelectorAll('.day-card');
  if (navItems[i]) {
    const b = navItems[i].querySelector('b');
    if (b) b.textContent = dayLabel(i);
  }
}

export function addDay() {
  D.days.push(newDay(D.days.length));
  uiState.dayView = D.days.length - 1;
  save();
}

export function delDay() {
  if (!confirm(`删除「${dayLabel(uiState.dayView)}」？`)) return;
  D.days.splice(uiState.dayView, 1);
  if (uiState.dayView < D.curDay) D.curDay--;
  else if (uiState.dayView === D.curDay) D.curDay = Math.min(D.curDay, D.days.length - 1);
  uiState.dayView = Math.min(uiState.dayView, D.days.length - 1);
  save();
}

export function setCur(i) {
  D.curDay = i;
  D.days[i].ended = false;
  uiState.dayView = i;
  addLog('day', '当前进度：' + dayLabel(i));
  save();
  toast('当前进度：' + dayLabel(i));
}

export function endDay() {
  const i = D.curDay, d = D.days[i];
  const undone = d.events.filter(e => !e.done);
  if (!confirm(`确认结束「${dayLabel(i)}」？` +
      (undone.length ? `\n还有 ${undone.length} 个事件未完成。` : ''))) return;

  let carry = false;
  if (undone.length) carry = confirm(`把 ${undone.length} 个未完成事件顺延到下一天？`);

  addLog('day', `—— ${dayLabel(i)} 结束 ——`);
  d.ended = true;

  if (i === D.days.length - 1) D.days.push(newDay(D.days.length));
  const next = D.days[i + 1];
  if (carry) {
    d.events = d.events.filter(e => e.done);
    next.events.unshift(...undone);
  }

  D.curDay = i + 1;
  uiState.dayView = D.curDay;
  save();
  toast(`「${dayLabel(i)}」已结束，进入「${dayLabel(D.curDay)}」`);
}

// ════════════════════════════════════════════════════════════
// 6. 事件操作
// ════════════════════════════════════════════════════════════
const evGet = id => D.days[uiState.dayView].events.find(e => e.id === id);

export function evAdd() {
  D.days[uiState.dayView].events.push({ id:uid(), time:'', title:'', detail:'', done:false });
  save();
}

export function evDel(id) {
  D.days[uiState.dayView].events = D.days[uiState.dayView].events.filter(e => e.id !== id);
  save();
}

export function evUpd(id, k, v) {
  evGet(id)[k] = v;
  save();
}

export function evDone(id, v) {
  evGet(id).done = v;
  save();
}

// ════════════════════════════════════════════════════════════
// 7. 拖拽处理 (供 side.js 调用)
// ════════════════════════════════════════════════════════════
export function handleScheduleDrop(e, type, targetId, isTop) {
  if (type === 'day') {
    const fromIdx = +uiState.dragSourceId;
    const toIdx   = +targetId;
    if (fromIdx === toIdx) return;
    const [moved] = D.days.splice(fromIdx, 1);
    D.days.splice(isTop ? toIdx : toIdx + 1, 0, moved);
    
    // 修正 curDay 指向
    if (D.curDay === fromIdx) D.curDay = isTop ? toIdx : toIdx + 1;
    else if (D.curDay > fromIdx && D.curDay <= toIdx) D.curDay--;
    else if (D.curDay < fromIdx && D.curDay >= toIdx) D.curDay++;
    
    uiState.dayView = D.curDay;
    save();
  } else if (type === 'event') {
    const list = D.days[uiState.dayView].events;
    const fromIdx = list.findIndex(x => x.id === uiState.dragSourceId);
    let toIdx = list.findIndex(x => x.id === targetId);
    if (fromIdx === -1 || toIdx === -1) return;
    const [moved] = list.splice(fromIdx, 1);
    if (!isTop) toIdx++;
    list.splice(toIdx, 0, moved);
    save();
  }
}

// ════════════════════════════════════════════════════════════
// 8. 挂载全局方法
// ════════════════════════════════════════════════════════════
Object.assign(window, {
  openDays, renderDays, updateDayBar,
  setDayTitle, addDay, delDay, setCur, endDay,
  evAdd, evDel, evUpd, evDone, copyEventDetail,
  handleScheduleDrop
});
