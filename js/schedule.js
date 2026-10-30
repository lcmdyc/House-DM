// js/schedule.js — 日程系统（Day/事件管理）
// 依赖：data.js  （D, uid, esc, saveData, newDay, dayLabel）
// 依赖：app.js   （edit, dayView, dragSourceId, toast, addLog, copyText,
//                  handleHandleDragStart, handleCardDragEnd,
//                  handleCardDragOver, handleCardDragLeave, handleCardDrop）
// 依赖：players.js（renderStrip）

// ── 工具栏按钮文字同步 ───────────────────────────────────────
function updateDayBar() {
  const t = dayLabel(D.curDay);
  const dayBtn    = document.getElementById('dayBtn');
  const endDayBtn = document.getElementById('endDayBtn');
  if (dayBtn)    dayBtn.textContent    = '📅 ' + t;
  if (endDayBtn) endDayBtn.textContent = t + ' 结束 ▶';
}

// ── 打开弹窗 ─────────────────────────────────────────────────
function openDays() {
  dayView = D.curDay;
  renderDays();
  document.getElementById('dayDlg').showModal();
}

// ── 主渲染 ───────────────────────────────────────────────────
function renderDays() {
  if (dayView >= D.days.length) dayView = D.days.length - 1;

  const navEl  = document.getElementById('dayNav');
  const mainEl = document.getElementById('dayMain');
  if (!navEl || !mainEl) return;

  // ── 左侧 Day 标签列 ──────────────────────────────────────
  navEl.innerHTML = D.days.map((d, i) => {
    const n = d.events.length, dn = d.events.filter(e => e.done).length;
    return `<div class="item day-card${i === dayView ? ' on' : ''}${i === D.curDay ? ' cur' : ''}"
      data-id="${i}"
      ${edit ? `ondragover="handleCardDragOver(event)"
        ondragleave="handleCardDragLeave(event)"
        ondrop="handleCardDrop(event,'day',${i})"` : ''}
      onclick="dayView=${i};renderDays()">
      <div class="row" style="gap:4px">
        ${edit ? `<span class="drag-handle" draggable="true"
          ondragstart="handleHandleDragStart(event,'day',${i})"
          ondragend="handleCardDragEnd(event)"
          onclick="event.stopPropagation()">⠿</span>` : ''}
        <b style="font-size:12.5px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap">
          ${esc(dayLabel(i))}
        </b>
        <span class="dtag">${i === D.curDay ? '🚩' : d.ended ? '✔' : ''}${n ? ` ${dn}/${n}` : ''}</span>
      </div>
    </div>`;
  }).join('') +
  (edit ? `<button onclick="addDay()" style="margin-top:6px;width:100%">＋ 新增一天</button>` : '');

  // ── 右侧当天详情 ─────────────────────────────────────────
  const d = D.days[dayView];
  if (!d) { mainEl.innerHTML = ''; return; }
  const isCur  = dayView === D.curDay;
  const keep   = mainEl.scrollTop;

  const evs = d.events.length
    ? d.events.map(e => edit ? evEditHtml(e) : evCompactHtml(e)).join('')
    : '<p class="hint">这一天还没有事件</p>';

  mainEl.innerHTML = `
    <div class="dayhead">
      ${edit
        ? `<input type="text" class="nm"
             style="width:220px;border-bottom:1px solid var(--accent);border-radius:4px"
             value="${esc(dayLabel(dayView))}"
             placeholder="Day 名称"
             oninput="setDayTitle(${dayView},this.value)">`
        : `<span class="nm" style="font-size:16px;font-weight:bold">${esc(dayLabel(dayView))}</span>`
      }
      ${isCur
        ? '<span class="badge2 cur">当前日</span>'
        : d.ended
          ? '<span class="badge2">已结束</span>'
          : '<span class="badge2">未开始</span>'
      }
      ${isCur
        ? `<button class="primary" onclick="endDay()">${esc(dayLabel(dayView))} 结束 ▶</button>`
        : `<button onclick="setCur(${dayView})">设为当前日</button>`
      }
      ${edit && D.days.length > 1
        ? `<button class="danger" onclick="delDay()">删除这一天</button>`
        : ''
      }
    </div>
    ${evs}
    ${edit ? `<button class="primary" onclick="evAdd()" style="margin-top:6px">＋ 添加事件</button>` : ''}`;

  mainEl.scrollTop = keep;
  updateDayBar();
}

// ── 编辑态事件卡片 ───────────────────────────────────────────
function evEditHtml(e) {
  return `
    <div class="item${e.done ? ' done' : ''}" data-id="${e.id}"
      ondragover="handleCardDragOver(event)"
      ondragleave="handleCardDragLeave(event)"
      ondrop="handleCardDrop(event,'event','${e.id}')">
      <div class="row">
        <span class="drag-handle" draggable="true"
          ondragstart="handleHandleDragStart(event,'event','${e.id}')"
          ondragend="handleCardDragEnd(event)"
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

// ── 带团态事件卡片（只读 + 点击复制）───────────────────────
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

// ── 复制事件内容 ─────────────────────────────────────────────
function copyEventDetail(id) {
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

// ── Day 标题修改 ─────────────────────────────────────────────
function setDayTitle(i, val) {
  D.days[i].title = val.trim() || `Day ${i + 1}`;
  saveData(D);
  updateDayBar();
  // 只更新左侧对应标签文字，不整体重绘
  const navItems = document.getElementById('dayNav').querySelectorAll('.day-card');
  if (navItems[i]) {
    const b = navItems[i].querySelector('b');
    if (b) b.textContent = dayLabel(i);
  }
}

// ── Day 操作 ─────────────────────────────────────────────────
function addDay() {
  D.days.push(newDay(D.days.length));
  dayView = D.days.length - 1;
  saveData(D);
  renderDays();
}

function delDay() {
  if (!confirm(`删除「${dayLabel(dayView)}」？`)) return;
  D.days.splice(dayView, 1);
  if (dayView < D.curDay)       D.curDay--;
  else if (dayView === D.curDay) D.curDay = Math.min(D.curDay, D.days.length - 1);
  dayView = Math.min(dayView, D.days.length - 1);
  saveData(D);
  renderDays();
}

function setCur(i) {
  D.curDay = i;
  D.days[i].ended = false;
  dayView = i;
  addLog('day', '当前进度：' + dayLabel(i));
  saveData(D);
  renderDays();
  renderStrip();
  toast('当前进度：' + dayLabel(i));
}

function endDay() {
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
  dayView  = D.curDay;
  saveData(D);

  const dlg = document.getElementById('dayDlg');
  if (dlg && dlg.open) renderDays();
  else updateDayBar();

  renderStrip();
  toast(`「${dayLabel(i)}」已结束，进入「${dayLabel(D.curDay)}」`);
}

// ── 事件操作 ─────────────────────────────────────────────────
const evGet = id => D.days[dayView].events.find(e => e.id === id);

function evAdd() {
  D.days[dayView].events.push({ id:uid(), time:'', title:'', detail:'', done:false });
  saveData(D);
  renderDays();
}

function evDel(id) {
  D.days[dayView].events = D.days[dayView].events.filter(e => e.id !== id);
  saveData(D);
  renderDays();
}

function evUpd(id, k, v) {
  evGet(id)[k] = v;
  saveData(D);
}

function evDone(id, v) {
  evGet(id).done = v;
  saveData(D);
  renderDays();
}