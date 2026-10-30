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

  // ── 左侧 Day 标签列 ──
  navEl.innerHTML = D.days.map((d, i) => {
    const n = d.events.length, dn = d.events.filter(e => e.done).length;
    return `<div class="item day-card${i === uiState.dayView ? ' on' : ''}${i === D.curDay ? ' cur' : ''}"
      data-id="${i}"
      ${uiState.edit ? `ondragover="window.handleCardDragOver(event)"
        ondragleave="window.handleCardDragLeave(event)"
        ondrop="window.handleCardDrop(event,'day',${i})"` : ''}
      onclick="uiState.dayView=${i};renderDays()">
      <div class="row" style="gap:4px">
        ${uiState.edit ? `<span class="drag-handle" draggable="true"
          ondragstart="window.handleHandleDragStart(event,'day',${i})"
          ondragend="window.handleCardDragEnd(event)"
          onclick="event.stopPropagation()">⠿</span>` : ''}
        <b style="font-size:12.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(dayLabel(i))}
        </b>
        <span class="dtag">${i === D.curDay ? '🚩' : d.ended ? '✔' : ''}${n ? ` ${dn}/${n}` : ''}</span>
      </div>
    </div>`;
  }).join('') +
  (uiState.edit ? `<button onclick="addDay()" style="margin-top:6px;width:100%">＋ 新增一天</button>` : '');

  // ── 右侧当天详情 ──
  const d = D.days[uiState.dayView];
  if (!d) { mainEl.innerHTML = ''; return; }
  const isCur  = uiState.dayView === D.curDay;
  const keep   = mainEl.scrollTop;

  const evs = d.events.length
    ? d.events.map(e => uiState.edit ? evEditHtml(e) : evCompactHtml(e)).join('')
    : '<p class="hint">这一天还没有事件</p>';

  mainEl.innerHTML = `
    <div class="dayhead">
      ${uiState.edit
        ? `<input type="text" class="nm"
             style="width:220px;border-bottom:1px solid var(--accent);border-radius:4px"
             value="${esc(dayLabel(uiState.dayView))}"
             placeholder="Day 名称"
             oninput="setDayTitle(${uiState.dayView},this.value)">`
        : `<span class="nm" style="font-size:16px;font-weight:bold">${esc(dayLabel(uiState.dayView))}</span>`
      }
      ${isCur
        ? '<span class="badge2 cur">当前日</span>'
        : d.ended
          ? '<span class="badge2">已结束</span>'
          : '<span class="badge2">未开始</span>'
      }
      ${isCur
        ? `<button class="primary" onclick="endDay()">${esc(dayLabel(uiState.dayView))} 结束 ▶</button>`
        : `<button onclick="setCur(${uiState.dayView})">设为当前日</button>`
      }
      ${uiState.edit && D.days.length > 1
        ? `<button class="danger" onclick="delDay()">删除这一天</button>`
        : ''
      }
    </div>
    ${evs}
    ${uiState.edit ? `<button class="primary" onclick="evAdd()" style="margin-top:6px">＋ 添加事件</button>` : ''}`;

  mainEl.scrollTop = keep;
  updateDayBar();
}

// ════════════════════════════════════════════════════════════
// 4. 事件卡片 HTML 生成
// ════════════════════════════════════════════════════════════
function evEditHtml(e) {
  return `
    <div class="item${e.done ? ' done' : ''}" data-id="${e.id}"
      ondragover="window.handleCardDragOver(event)"
      ondragleave="window.handleCardDragLeave(event)"
      ondrop="window.handleCardDrop(event,'event','${e.id}')">
      <div class="row">
        <span class="drag-handle" draggable="true"
          ondragstart="window.handleHandleDragStart(event,'event','${e.id}')"
          ondragend="window.handleCardDragEnd(event)"
          onclick="event.stopPropagation()">⠿</span>
        <input type="checkbox" ${e.done ? 'checked' : ''} onchange="evDone('${e.id}',this.checked)">
        <input type="text" style="width:85px;flex:none" value="${esc(e.time)}"
          placeholder="时间" oninput="evUpd('${e.id}','time',this.value)">
        <input type="text" style="flex:1;font-weight:bold" value="${esc(e.title)}"
          placeholder="事件标题" oninput="evUpd('${e.id}','title',this.value)">
        <button class="danger" onclick="evDel('${e.id}')">🗑</button>
      </div>
      <label class="s">事件详情</label>
      <textarea style="min-height:48px"
        oninput="evUpd('${e.id}','detail',this.value)">${esc(e.detail)}</textarea>
    </div>`;
}

function evCompactHtml(e) {
  return `
    <div class="item compact${e.done ? ' consumed' : ''}" onclick="copyEventDetail('${e.id}')">
      <div class="row">
        <span class="tag static"
          style="background:${e.done ? '#888' : 'var(--accent)'};color:#fff;min-width:36px;text-align:center">
          ${e.done ? '✔' : '📅'}
        </span>
        <div class="memo">
          <b>${esc(e.title) || '（未命名事件）'}</b>
          ${e.time   ? `<span class="cd">🕐 ${esc(e.time)}</span>`         : ''}
          ${e.detail ? `<span class="desc-p">${esc(e.detail)}</span>`       : ''}
        </div>
        <span class="copyi">📋</span>
      </div>
      <div class="status" onclick="event.stopPropagation()">
        <button class="cbtn${e.done ? ' on' : ''}"
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