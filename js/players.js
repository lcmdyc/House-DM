// js/players.js — 玩家状态条 + 背景资料库 + 车卡系统
// 依赖：data.js  （D, uid, esc, saveData, INFO_FIELDS, blankBg, cardUsed, pname, pcolor, rname）
// 依赖：core.js  （bgSel, edit, save, toast, copyText, addLog, roomSel）
// 依赖：wheel.js （onWheelAdj, adjPlayerAttr）
// 依赖：map.js   （renderMap）
// 依赖：side.js  （renderSide）

// ════════════════════════════════════════════════════════════
// 一、玩家状态条
// ════════════════════════════════════════════════════════════
function renderStrip() {
  const s = document.getElementById('strip'); if (!s || !D) return;

  let html = `<div class="sthead">
    <span style="margin-right:auto">👥 玩家属性</span>
    <button title="设置显示哪些属性" onclick="openStripCfg()">⚙</button>
  </div>`;

  html += D.players.map((_, i) => {
    const b    = D.bg[i]; if (!b) return '';
    const dead = b.dead;

    const cardChips = (D.cardCfg && D.cardCfg.attrs)
      ? D.cardCfg.attrs.filter(a => a.show).map(a => {
          const v = +b.card.vals[a.id] || 0;
          return `<span class="${v === 0 ? 'z' : ''}"
            title="${esc(a.name)}（滚轮增减）"
            onwheel="onWheelAdj(event,'player',${i},'${a.id}')">
            <i>${esc(a.name)}</i><b>${v}</b>
          </span>`;
        })
      : [];

    const presetChips = (b.presetAttrs || [])
      .filter(a => a.show !== false)
      .map(a => {
        const v = +a.val || 0;
        return `<span class="${v === 0 ? 'z' : ''}"
          title="${esc(a.name)}（滚轮增减）"
          onwheel="onWheelAdj(event,'preset',${i},'${a.id}')">
          <i>${esc(a.name)}</i><b>${v}</b>
        </span>`;
      });

    const allChips = [...cardChips, ...presetChips];
    const attrsHtml = allChips.length
      ? `<div class="as">${allChips.join('')}</div>`
      : '';

    return `<div class="pc${dead ? ' dead' : ''}"
      style="border-top-color:${pcolor(i)}"
      onclick="openBg(${i})">
      <div class="pn-row">
        <span class="pn">${esc(pname(i))}${dead ? ' <span class="dead-badge">💀</span>' : ''}</span>
        <select class="prm" onclick="event.stopPropagation()"
          onchange="setPlayerRoom(${i},this.value)">
          ${roomSel(b.roomId)}
        </select>
      </div>
      ${attrsHtml}
    </div>`;
  }).join('');

  s.innerHTML = html;
}

// ════════════════════════════════════════════════════════════
// 二、属性加减 / 房间定位
// ════════════════════════════════════════════════════════════
function adjAttr(i, aid, delta) { adjPlayerAttr(i, aid, delta); }

function setPlayerRoom(i, rid) {
  const old = D.bg[i].roomId || '';
  if (old === rid) return;
  D.bg[i].roomId = rid;
  addLog('move', `${pname(i)}：${rname(old)} → ${rname(rid)}`, pcolor(i));
  save(); renderStrip(); renderMap(); renderSide();
}

// ════════════════════════════════════════════════════════════
// 三、玩家复制
// ════════════════════════════════════════════════════════════
function duplicatePlayer(i) {
  const srcName = D.players[i];

  function baseName(n) { return n.replace(/[A-Z]$/, ''); }
  const base = baseName(srcName);
  const siblings = D.players.filter(n => baseName(n) === base);
  const usedLetters = siblings
    .map(n => n.slice(base.length))
    .filter(s => /^[A-Z]$/.test(s));
  let suffix = '';
  for (let c = 65; c <= 90; c++) {
    const letter = String.fromCharCode(c);
    if (!usedLetters.includes(letter)) { suffix = letter; break; }
  }
  const newName = base + suffix;

  const srcBg = JSON.parse(JSON.stringify(D.bg[i]));
  srcBg.roomId = '';
  srcBg.dead   = false;

  if (Array.isArray(srcBg.presetAttrs)) {
    srcBg.presetAttrs = srcBg.presetAttrs.map(a => ({ ...a, id: uid() }));
  }

  const newIdx = i + 1;
  D.players.splice(newIdx, 0, newName);
  D.bg.splice(newIdx, 0, srcBg);

  const fix = idx => idx >= newIdx ? idx + 1 : idx;
  D.pool.forEach(it => { it.owners = it.owners.map(fix); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.map(fix); }));

  bgSel = newIdx;
  save();
  toast(`✅ 已复制「${srcName}」→「${newName}」`);
  renderStrip(); renderPlayersBox(); renderBg(); renderMap(); renderSide();
}

// ════════════════════════════════════════════════════════════
// 四、玩家数量管理
// ════════════════════════════════════════════════════════════
function updatePlayerBar() {
  const btn = document.getElementById('playersBtn');
  if (btn) btn.textContent = `👥 玩家(${D.players.length})`;
}

function openPlayers() {
  renderPlayersBox();
  document.getElementById('playersDlg').showModal();
}

function closePlayers() { document.getElementById('playersDlg').close(); }

function renderPlayersBox() {
  const box = document.getElementById('playersBox'); if (!box) return;
  const cnt = document.getElementById('plCount');
  if (cnt) cnt.textContent = `共 ${D.players.length} 人`;
  box.innerHTML = D.players.map((_, i) => {
    const b = D.bg[i];
    return `<div class="player-row" style="border-left:3px solid ${pcolor(i)}">
      <input type="text" value="${esc(pname(i))}" placeholder="玩家姓名"
        oninput="D.players[${i}]=this.value;save();renderStrip()">
      <input type="color" value="${b.color}"
        oninput="D.bg[${i}].color=this.value;save();renderStrip();renderMap()">
      <button class="danger" onclick="removePlayer(${i})"
        ${D.players.length <= 1 ? 'disabled' : ''}>✕</button>
    </div>`;
  }).join('');
}

function addPlayer() {
  const i = D.players.length;
  D.players.push('玩家' + (i + 1));
  if (!D.bg[i]) D.bg[i] = blankBg(i);
  save(); renderStrip(); renderPlayersBox(); renderMap();
}

function removePlayer(i) {
  if (D.players.length <= 1) { toast('至少保留1名玩家'); return; }
  if (!confirm(`确定移除「${pname(i)}」？`)) return;
  D.players.splice(i, 1);
  D.bg.splice(i, 1);
  const total = D.players.length;
  D.pool.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); }));
  if (bgSel >= total) bgSel = total - 1;
  save(); renderStrip(); renderPlayersBox(); renderBg(); renderMap(); renderSide();
}

function setPlayerCount(n) {
  n = Math.max(1, +n);
  while (D.players.length < n) {
    const i = D.players.length;
    D.players.push('玩家' + (i + 1));
    if (!D.bg[i]) D.bg[i] = blankBg(i);
  }
  D.players.length = n;
  D.bg.length = n;
  const total = D.players.length;
  D.pool.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); });
  D.rooms.forEach(r => r.items.forEach(it => { it.owners = it.owners.filter(o => o >= 0 && o < total); }));
  if (bgSel >= total) bgSel = total - 1;
  save(); renderStrip(); renderBg(); renderMap(); renderSide();
}

// ════════════════════════════════════════════════════════════
// 五、背景资料库入口
// ════════════════════════════════════════════════════════════
function openBg(i) {
  bgSel = (i !== undefined) ? i : bgSel;
  switchTab('library');
  switchLibTab('bg');
}

function renderBg() {
  const navEl  = document.getElementById('bgNav');
  const mainEl = document.getElementById('bgMain');
  if (!navEl || !mainEl) return;
  if (!D.bg[bgSel]) bgSel = 0;
  const b = D.bg[bgSel];
  if (!b) return;

  navEl.innerHTML = D.players.map((_, i) => {
    const bg   = D.bg[i];
    const dead = bg && bg.dead;
    const room = rname(bg.roomId) || '未定位';
    const sel  = bgSel === i;
    return `<div
      class="npc-card${sel ? ' sel' : ''}${dead ? ' dead' : ''}"
      style="border-left-color:${pcolor(i)}"
      onclick="bgSel=${i};renderBg()">
      <div class="nc-name">${esc(pname(i))}${dead ? ' 💀' : ''}</div>
      <div class="nc-meta">
        <span class="nc-badge" style="background:${pcolor(i)}22;color:${pcolor(i)}">玩家</span>
        <span>📍 ${esc(room)}</span>
        <button class="npc-dup-btn" title="复制此玩家"
          style="margin-left:auto;padding:1px 5px;font-size:11px"
          onclick="event.stopPropagation();duplicatePlayer(${i})">⧉</button>
      </div>
    </div>`;
  }).join('');

  mainEl.innerHTML = `
    ${bgTopBar(bgSel)}
    <div class="bg-two-col">
      <div class="bg-col bg-col-preset">${bgPresetSection(bgSel)}</div>
      <div class="bg-col bg-col-card">${bgCardSection(bgSel)}</div>
    </div>`;
}

// ════════════════════════════════════════════════════════════
// 六、顶部信息栏
// ════════════════════════════════════════════════════════════
function bgTopBar(i) {
  const b = D.bg[i];
  return `<div class="bg-topbar">
    <input class="bg-name-input" type="text" value="${esc(D.players[i])}" placeholder="玩家姓名"
      oninput="D.players[${i}]=this.value;save();renderStrip();renderMap();
        document.querySelectorAll('#bgNav .nc-name')[${i}] &&
        (document.querySelectorAll('#bgNav .nc-name')[${i}].textContent=this.value)">
    <input type="color" value="${b.color}" title="标记颜色"
      oninput="D.bg[${i}].color=this.value;save();renderStrip();renderMap()">
    <select class="bg-room-sel" onchange="setPlayerRoom(${i},this.value)">
      ${roomSel(b.roomId)}
    </select>
    <button class="bg-dead-btn${b.dead ? ' on danger' : ''}"
      onclick="togglePlayerDeadLib(${i})">
      ${b.dead ? '💀 已死亡' : '标记死亡'}
    </button>
    <button class="danger" onclick="removePlayer(${i})">🗑 删除</button>
  </div>`;
}

function togglePlayerDeadLib(i) {
  D.bg[i].dead = !D.bg[i].dead;
  save(); renderBg(); renderStrip();
  toast(D.bg[i].dead ? `💀 ${pname(i)} 已标记死亡` : `✅ ${pname(i)} 已取消死亡标记`);
}

// ════════════════════════════════════════════════════════════
// 七、模组预设区块
// ════════════════════════════════════════════════════════════
function copyPreset(btn) {
  const card  = btn.closest('[data-copy]');
  const text  = card ? card.getAttribute('data-copy') : '';
  const label = btn.getAttribute('data-label') || '内容';
  copyText(text).then(ok => toast(ok ? `📋 已复制${label}` : '复制失败'));
}

function presetCardHead(icon, title, label) {
  if (!edit) {
    return `<h3 class="preset-card-h3">${icon} ${title}
      <button class="preset-copy-btn" data-label="${label}" onclick="copyPreset(this)">📋 复制</button>
    </h3>`;
  }
  return `<h3>${icon} ${title}</h3>`;
}

function bgPresetSection(i) {
  return `<div class="bg-section bg-section-preset">
    <div class="bg-section-head">
      <span class="bg-section-icon">📋</span>
      <span class="bg-section-title">模组预设</span>
      <span class="bg-section-hint">由作者设定</span>
    </div>
    ${bgIdentityCard(i)}
    ${bgSkillsCard(i)}
    ${bgGoalsCard(i)}
    ${bgPresetAttrsCard(i)}
    ${bgDmNoteCard(i)}
  </div>`;
}

// ── 身份描述 ──────────────────────────────────────────────
function bgIdentityCard(i) {
  const val = D.bg[i].identity || '';
  if (!edit) {
    return `<div class="card preset-readonly" data-copy="${esc(val)}">
      ${presetCardHead('🪪', '身份描述', '身份描述')}
      <div class="preset-text">${val ? esc(val).replace(/\n/g, '<br>') : '<span class="hint">暂无</span>'}</div>
    </div>`;
  }
  return `<div class="card">
    <h3>🪪 身份描述</h3>
    <textarea class="identity-ta" placeholder="角色背景、身份设定…"
      oninput="D.bg[${i}].identity=this.value;save()">${esc(val)}</textarea>
  </div>`;
}

// ── 技能/道具 ─────────────────────────────────────────────
function bgSkillsCard(i) {
  const skills = D.bg[i].skills || [];
  if (!edit) {
    const text = skills.join('\n');
    return `<div class="card preset-readonly" data-copy="${esc(text)}">
      ${presetCardHead('⚔️', '技能/道具', '技能/道具')}
      ${skills.length
        ? `<ul class="preset-list">${skills.map(s => `<li>${esc(s)}</li>`).join('')}</ul>`
        : '<p class="hint">暂无</p>'}
    </div>`;
  }
  const rows = skills.map((sk, idx) =>
    `<div class="skill-row">
      <input type="text" value="${esc(sk)}" placeholder="技能/道具"
        oninput="D.bg[${i}].skills[${idx}]=this.value;save()">
      <button class="danger"
        onclick="D.bg[${i}].skills.splice(${idx},1);save();renderBg()">✕</button>
    </div>`
  ).join('');
  return `<div class="card">
    <h3>⚔️ 技能/道具
      <button onclick="D.bg[${i}].skills.push('');save();renderBg()">＋ 添加</button>
    </h3>
    ${rows || '<p class="hint">暂无</p>'}
  </div>`;
}

// ── 角色目的 ──────────────────────────────────────────────
function bgGoalsCard(i) {
  const goals = D.bg[i].goals || [];
  if (!edit) {
    const text = goals.join('\n');
    return `<div class="card preset-readonly" data-copy="${esc(text)}">
      ${presetCardHead('🎯', '角色目的', '角色目的')}
      ${goals.length
        ? `<ul class="preset-list">${goals.map(g => `<li>${esc(g)}</li>`).join('')}</ul>`
        : '<p class="hint">暂无</p>'}
    </div>`;
  }
  const rows = goals.map((g, idx) =>
    `<div class="goal-row">
      <input type="text" value="${esc(g)}" placeholder="目标/动机"
        oninput="D.bg[${i}].goals[${idx}]=this.value;save()">
      <button class="danger"
        onclick="D.bg[${i}].goals.splice(${idx},1);save();renderBg()">✕</button>
    </div>`
  ).join('');
  return `<div class="card">
    <h3>🎯 角色目的
      <button onclick="D.bg[${i}].goals.push('');save();renderBg()">＋ 添加</button>
    </h3>
    ${rows || '<p class="hint">暂无</p>'}
  </div>`;
}

// ── 特殊属性 ──────────────────────────────────────────────
function bgPresetAttrsCard(i) {
  if (!D.bg[i].presetAttrs) D.bg[i].presetAttrs = [];
  const attrs = D.bg[i].presetAttrs;

  const rows = attrs.map((a, idx) =>
    `<div class="attr-row" style="align-items:center;gap:6px">
      <input type="text" class="attr-name" value="${esc(a.name)}" placeholder="属性名"
        oninput="D.bg[${i}].presetAttrs[${idx}].name=this.value;save();renderStrip()">
      <button onclick="adjPresetAttr(${i},${idx},-1)" ${+a.val<=0?'disabled':''}>－</button>
      <span class="attr-val"
        title="${esc(a.name)}（滚轮增减）"
        onwheel="onWheelAdj(event,'preset',${i},'${a.id}')"
        style="min-width:28px;text-align:center;font-weight:bold">${+a.val||0}</span>
      <button onclick="adjPresetAttr(${i},${idx},1)">＋</button>
      <label style="display:flex;align-items:center;gap:3px;font-size:12px;color:var(--mute);flex-shrink:0">
        <input type="checkbox" ${a.show!==false?'checked':''}
          onchange="D.bg[${i}].presetAttrs[${idx}].show=this.checked;save();renderStrip();renderBg()">侧栏显示
      </label>
      <button class="danger attr-del-btn"
        onclick="D.bg[${i}].presetAttrs.splice(${idx},1);save();renderStrip();renderBg()">✕</button>
    </div>`
  ).join('');

  return `<div class="card">
    <h3>📊 特殊属性
      <button onclick="D.bg[${i}].presetAttrs.push({id:uid(),name:'新属性',val:0,show:true});save();renderBg()">＋ 添加</button>
    </h3>
    <div class="attr-list">
      ${rows || '<p class="hint">暂无，点击＋添加</p>'}
    </div>
  </div>`;
}

function adjPresetAttr(i, idx, delta) {
  const a = D.bg[i].presetAttrs[idx]; if (!a) return;
  a.val = Math.max(0, (+a.val || 0) + delta);
  save();
  renderStrip();
  // 只更新数值显示，不重建整个页面
  const rows = document.querySelectorAll(`#bgMain .attr-list .attr-row`);
  if (rows[idx]) {
    const span = rows[idx].querySelector('.attr-val');
    if (span) span.textContent = a.val;
    const minusBtn = rows[idx].querySelector('button');
    if (minusBtn) minusBtn.disabled = a.val <= 0;
  }
}

// ── DM 备注 ───────────────────────────────────────────────
function bgDmNoteCard(i) {
  const val = D.bg[i].dmNote || '';
  return `<div class="card card-dm-note">
    <h3>🔒 DM 备注 <span class="bg-section-hint">不计入导出</span></h3>
    <textarea class="dmnote-ta" placeholder="DM 专属备注，不会被复制或导出给玩家…"
      oninput="D.bg[${i}].dmNote=this.value;save()">${esc(val)}</textarea>
  </div>`;
}

// ════════════════════════════════════════════════════════════
// 八、玩家车卡区块
// ════════════════════════════════════════════════════════════
function bgCardSection(i) {
  return `<div class="bg-section bg-section-card">
    <div class="bg-section-head">
      <span class="bg-section-icon">🎴</span>
      <span class="bg-section-title">玩家车卡</span>
      <span class="bg-section-hint">由玩家填写</span>
    </div>
    ${bgBasicInfoCard(i)}
    ${bgAttrsCard(i)}
    ${bgItemsCard(i)}
    ${bgOtherCard(i)}
  </div>`;
}

// ── 基础信息 ──────────────────────────────────────────────
function bgBasicInfoCard(i) {
  const b      = D.bg[i];
  const fields = b.card.infoFields || [];

  const fieldRows = fields.map((f, idx) =>
    `<div class="custom-field-row">
      <input type="text" class="cf-key" value="${esc(f.key)}" placeholder="字段名"
        oninput="D.bg[${i}].card.infoFields[${idx}].key=this.value;save()">
      <input type="text" class="cf-val" value="${esc(f.val)}" placeholder="内容"
        oninput="D.bg[${i}].card.infoFields[${idx}].val=this.value;save()">
      <button class="danger"
        onclick="D.bg[${i}].card.infoFields.splice(${idx},1);save();renderBg()">✕</button>
    </div>`
  ).join('');

  return `<div class="card">
    <h3>📝 基础信息
      <button onclick="D.bg[${i}].card.infoFields.push({key:'',val:''});save();renderBg()">＋ 添加</button>
    </h3>
    <div class="info-name-row">
      <div class="info-field info-field-name">
        <label>姓名</label>
        <input type="text" value="${esc(D.players[i])}" placeholder="姓名"
          oninput="D.players[${i}]=this.value;save();renderStrip();renderMap()">
      </div>
    </div>
    <div class="info-custom-fields">
      ${fieldRows || '<p class="hint">暂无其他信息，点击＋添加</p>'}
    </div>
  </div>`;
}

// ── 属性分配 ──────────────────────────────────────────────
function bgAttrsCard(i) {
  const b    = D.bg[i];
  const c    = b.card;
  const cfg  = D.cardCfg;
  const used = cardUsed(c);
  const left = cfg.points - used;

  const attrRows = cfg.attrs.filter(a => a.show).map(a => {
    const v = +c.vals[a.id] || 0;
    return `<div class="attr-row">
      <span class="attr-name">${esc(a.name)}</span>
      <button onclick="adjAttr(${i},'${a.id}',-1)" ${v <= 0 ? 'disabled' : ''}>－</button>
      <span class="attr-val"
        title="${esc(a.name)}（滚轮增减）"
        onwheel="onWheelAdj(event,'player',${i},'${a.id}')">${v}</span>
      <button onclick="adjAttr(${i},'${a.id}',1)"
        ${left <= 0 && v === 0 ? 'disabled' : ''}>＋</button>
      <button class="attr-del-btn" onclick="adjAttr(${i},'${a.id}',0-${v})" title="清零">×</button>
    </div>`;
  }).join('');

  const cfgRows = cfg.attrs.map((a, idx) =>
    `<div class="cfg-row">
      <input type="text" value="${esc(a.name)}" placeholder="属性名"
        oninput="D.cardCfg.attrs[${idx}].name=this.value;save()">
      <label><input type="checkbox" ${a.show ? 'checked' : ''}
        onchange="D.cardCfg.attrs[${idx}].show=this.checked;save();renderBg()"> 显示</label>
      <button class="danger" onclick="delCardAttr(${idx})">✕</button>
    </div>`
  ).join('');

  return `<div class="card" id="bgAttrsCard_${i}">
    <h3>🎲 属性分配
      <span class="pts-badge" style="${left < 0 ? 'color:var(--danger)' : ''}">
        已用 ${used}　剩余 ${left}
      </span>
      <button onclick="openCardCfg()" title="配置属性">⚙</button>
      <button onclick="addCardAttr()">＋ 新属性</button>
    </h3>
    <div class="pts-total-row">
      <label>可分配点数</label>
      <input class="pts-input" type="number" min="1" max="999" value="${cfg.points}"
        oninput="D.cardCfg.points=+this.value||40;save();renderAttrBadge(${i})">
      <span>点</span>
    </div>
    <div class="attr-list" id="bgAttrList_${i}">${attrRows || '<p class="hint">暂无属性，点击＋新属性添加</p>'}</div>
    <dialog id="cardCfgDlg" class="dlg">
      <div class="dlg-head"><b>⚙ 车卡配置</b>
        <button onclick="document.getElementById('cardCfgDlg').close()">✕</button>
      </div>
      <label>总点数上限
        <input type="number" min="1" max="999" value="${cfg.points}"
          oninput="D.cardCfg.points=+this.value||40;save();renderAttrBadge(${i})">
      </label>
      <div class="cfg-list">${cfgRows}</div>
      <button onclick="addCardAttr()">＋ 添加属性</button>
    </dialog>
  </div>`;
}

// 局部刷新属性徽章（已用/剩余），不重建整个页面
function renderAttrBadge(i) {
  const c    = D.bg[i].card;
  const cfg  = D.cardCfg;
  const used = cardUsed(c);
  const left = cfg.points - used;
  const badge = document.querySelector(`#bgAttrsCard_${i} .pts-badge`);
  if (badge) {
    badge.style.color = left < 0 ? 'var(--danger)' : '';
    badge.textContent = `已用 ${used}　剩余 ${left}`;
  }
}

function openCardCfg() { document.getElementById('cardCfgDlg').showModal(); }

function addCardAttr() {
  D.cardCfg.attrs.push({ id: uid(), name: '新属性', show: true });
  save(); renderBg();
}

function delCardAttr(idx) {
  const aid = D.cardCfg.attrs[idx].id;
  D.cardCfg.attrs.splice(idx, 1);
  D.bg.forEach(b => { delete b.card.vals[aid]; });
  save(); renderBg();
}

// ── 随身物品 ──────────────────────────────────────────────
function bgItemsCard(i) {
  const b = D.bg[i];
  return `<div class="card">
    <h3>🎒 随身物品</h3>
    <textarea class="items-ta" placeholder="随身携带的物品…"
      oninput="D.bg[${i}].card.items=this.value;save()">${esc(b.card.items || '')}</textarea>
  </div>`;
}

// ── 其他背景 ──────────────────────────────────────────────
function bgOtherCard(i) {
  const b = D.bg[i];
  return `<div class="card">
    <h3>🐱 其他背景</h3>
    <textarea class="other-ta" placeholder="其他背景故事、特殊能力…"
      oninput="D.bg[${i}].card.other=this.value;save()">${esc(b.card.other || '')}</textarea>
  </div>`;
}

// ════════════════════════════════════════════════════════════
// 九、玩家属性条 ⚙ 设置弹窗
// ════════════════════════════════════════════════════════════
function openStripCfg() {
  renderStripCfg();
  document.getElementById('stripDlg').showModal();
}

function renderStripCfg() {
  const box = document.getElementById('stripCfgBox');
  if (!box) return;
  box.innerHTML =
    `<label class="chkrow">
       <input type="checkbox" ${D.ui.showChar ? 'checked' : ''}
         onchange="D.ui.showChar=this.checked;save();renderStrip()">
       <span>显示角色姓名</span>
     </label>` +
    D.cardCfg.attrs.map(a =>
      `<label class="chkrow">
         <input type="checkbox" ${a.show ? 'checked' : ''}
           onchange="attrShow('${a.id}',this.checked)">
         <span>${esc(a.name) || '（未命名）'}</span>
       </label>`
    ).join('');
}

function attrShow(id, v) {
  const a = D.cardCfg.attrs.find(a => a.id === id);
  if (a) { a.show = v; save(); renderStrip(); }
}

function stripAll(v) {
  D.cardCfg.attrs.forEach(a => a.show = v);
  save(); renderStrip(); renderStripCfg();
}