// js/relation.js — 关系图谱
// 依赖：data.js（D, uid, esc, saveData）
// 依赖：core.js（save, toast, copyText）

const REL_STYLES = {
  normal:  { label: '普通',   color: '#888',    dash: false },
  ally:    { label: '盟友',   color: '#4cc9a0', dash: false },
  hostile: { label: '敌对',   color: '#e0605e', dash: false },
  family:  { label: '亲属',   color: '#e8a13a', dash: false },
  secret:  { label: '秘密',   color: '#b27cd8', dash: true  },
};

const REL_DIRS = {
  one:  '单向 →',
  both: '双向 ↔',
};

let relView      = { panX: 0, panY: 0, zoom: 1 };
let relPositions = {};
let _relSimTimer = null;
let _relEdgePaths = [];

// ── 平滑居中动画状态 ─────────────────────────────────────────
let _relCenterAnim = null; // { fromPanX, fromPanY, fromZoom, toPanX, toPanY, toZoom, t }

// ── 节点列表 ─────────────────────────────────────────────────
function relNodes() {
  const players = D.players.map((_, i) => ({
    id: `p_${i}`, type: 'player', rawId: i,
    name: pname(i), color: pcolor(i), dead: D.bg[i] && D.bg[i].dead,
  }));
  const npcs = D.npcs.map(n => ({
    id: `n_${n.id}`, type: 'npc', rawId: n.id,
    name: n.name, color: n.color || '#b27cd8', dead: n.dead,
  }));
  return [...players, ...npcs];
}

function nodeKey(type, rawId) {
  return type === 'player' ? `p_${rawId}` : `n_${rawId}`;
}

// ── 渲染资料库页 ─────────────────────────────────────────────
function renderRelationLib() {
  const el = document.getElementById('libPageRelation'); if (!el) return;
  el.innerHTML = `
    <div class="rel-layout">
      <div class="rel-canvas-wrap" id="relCanvasWrap" style="position:relative">
        <canvas id="relCanvas"></canvas>
        <div id="relTooltip" class="rel-tooltip" style="display:none"></div>
        <div id="relEdgePopup" class="rel-edge-popup" style="display:none"></div>
        <div class="rel-canvas-btns">
          <button onclick="relCenterViewSmooth()" title="居中视图">⌖ 居中</button>
          <button onclick="relZoom(0.15)" title="放大">＋</button>
          <button onclick="relZoom(-0.15)" title="缩小">－</button>
          <button onclick="resetRelLayout()" title="重新力导向布局">↺ 重排</button>
          <button onclick="copyRelSummary()">📋 复制摘要</button>
        </div>
        <div class="rel-legend" id="relLegend">
          ${Object.entries(REL_STYLES).map(([k, v]) =>
            `<span class="rel-leg-item">
              <svg width="24" height="10">
                <line x1="0" y1="5" x2="24" y2="5"
                  stroke="${v.color}" stroke-width="2"
                  ${v.dash ? 'stroke-dasharray="4,3"' : ''}/>
              </svg>${v.label}
            </span>`
          ).join('')}
        </div>
      </div>
      <div class="rel-panel">
        <div class="rel-panel-head">
          <h3>🔗 关系列表</h3>
          <button class="primary" onclick="addRelation()">＋ 新增</button>
        </div>
        <div id="relList" class="rel-list-scroll"></div>
      </div>
    </div>`;
  renderRelList();
  requestAnimationFrame(() => {
    initRelPositions();
    startRelSim();
  });
}

// ── 关系列表 ─────────────────────────────────────────────────
function renderRelList() {
  const el = document.getElementById('relList'); if (!el) return;
  if (!D.relations.length) {
    el.innerHTML = '<p class="hint rel-empty">暂无关系，点击右上角新增</p>';
    return;
  }
  el.innerHTML = D.relations.map(r => {
    const st    = REL_STYLES[r.style] || REL_STYLES.normal;
    const dir   = r.dir || 'one';
    const nodes_ = relNodes();
    const opts  = nodes_.map(n =>
      `<option value="${n.type}|${n.rawId}" ${nodeKey(r.fromType, r.fromId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`
    ).join('');
    const opts2 = nodes_.map(n =>
      `<option value="${n.type}|${n.rawId}" ${nodeKey(r.toType, r.toId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`
    ).join('');
    const arrowSvg = dir === 'both'
      ? `<svg class="rel-arrow-svg" width="34" height="14">
          <polygon points="5,4 0,7 5,10" fill="${st.color}"/>
          <line x1="2" y1="7" x2="32" y2="7" stroke="${st.color}" stroke-width="2" ${st.dash ? 'stroke-dasharray="4,3"' : ''}/>
          <polygon points="29,4 34,7 29,10" fill="${st.color}"/>
         </svg>`
      : `<svg class="rel-arrow-svg" width="28" height="14">
          <line x1="2" y1="7" x2="22" y2="7" stroke="${st.color}" stroke-width="2" ${st.dash ? 'stroke-dasharray="4,3"' : ''}/>
          <polygon points="22,4 27,7 22,10" fill="${st.color}"/>
         </svg>`;
    return `<div class="rel-item">
      <div class="rel-item-row">
        <select class="rel-node-sel" onchange="relEditNode('${r.id}','from',this.value)">${opts}</select>
        ${arrowSvg}
        <select class="rel-node-sel" onchange="relEditNode('${r.id}','to',this.value)">${opts2}</select>
        <button class="danger rel-del" onclick="delRelation('${r.id}')">✕</button>
      </div>
      <div class="rel-item-row" style="margin-top:4px">
        <select class="rel-style-sel" onchange="relEdit('${r.id}','style',this.value)">
          ${Object.entries(REL_STYLES).map(([k, v]) =>
            `<option value="${k}" ${r.style === k ? 'selected' : ''}>${v.label}</option>`
          ).join('')}
        </select>
        <select class="rel-dir-sel" onchange="relEdit('${r.id}','dir',this.value)">
          ${Object.entries(REL_DIRS).map(([k, v]) =>
            `<option value="${k}" ${dir === k ? 'selected' : ''}>${v}</option>`
          ).join('')}
        </select>
      </div>
      <div class="rel-item-row" style="margin-top:4px">
        <input type="text" class="rel-label-input" value="${esc(r.label)}"
          placeholder="关系描述（如：旧友、雇主）"
          oninput="relEdit('${r.id}','label',this.value)">
      </div>
    </div>`;
  }).join('');
}

// ── 新增 / 编辑 / 删除 ───────────────────────────────────────
function addRelation() {
  const nodes = relNodes();
  if (nodes.length < 2) { toast('至少需要2个角色才能建立关系'); return; }
  const from = nodes[0], to = nodes[1];
  D.relations.push({
    id: uid(), fromType: from.type, fromId: from.rawId,
    toType: to.type, toId: to.rawId, label: '', style: 'normal', dir: 'one',
  });
  saveData(D); renderRelList(); startRelSim();
}

function delRelation(id) {
  D.relations = D.relations.filter(r => r.id !== id);
  saveData(D); renderRelList(); drawRelCanvas();
}

function relEdit(id, field, val) {
  const r = D.relations.find(x => x.id === id); if (!r) return;
  r[field] = val;
  saveData(D);
  if (field === 'style' || field === 'dir') { renderRelList(); drawRelCanvas(); }
}

function relEditNode(id, side, val) {
  const r = D.relations.find(x => x.id === id); if (!r) return;
  const [type, rawId] = val.split('|');
  if (side === 'from') { r.fromType = type; r.fromId = type === 'player' ? +rawId : rawId; }
  else                 { r.toType   = type; r.toId   = type === 'player' ? +rawId : rawId; }
  saveData(D); renderRelList(); startRelSim();
}

// ── 坐标转换 ─────────────────────────────────────────────────
function screenToWorld(sx, sy) {
  return { x: (sx - relView.panX) / relView.zoom, y: (sy - relView.panY) / relView.zoom };
}
function worldToScreen(wx, wy) {
  return { x: wx * relView.zoom + relView.panX, y: wy * relView.zoom + relView.panY };
}

// ── 初始化节点位置 ────────────────────────────────────────────
function initRelPositions() {
  const nodes = relNodes();
  const W = 1200, H = 900;
  nodes.forEach(n => {
    if (!relPositions[n.id]) {
      relPositions[n.id] = {
        x: W / 2 + (Math.random() - 0.5) * W * 1.6,
        y: H / 2 + (Math.random() - 0.5) * H * 1.6,
        vx: 0, vy: 0,
      };
    } else {
      relPositions[n.id].vx = relPositions[n.id].vx || 0;
      relPositions[n.id].vy = relPositions[n.id].vy || 0;
    }
  });
}

// ── 计算目标居中参数（不改变 relView）────────────────────────
function calcCenterTarget() {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return null;
  const nodes = relNodes();
  if (!nodes.length) return null;
  const positions = nodes.map(n => relPositions[n.id]).filter(Boolean);
  if (!positions.length) return null;
  const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
  const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
  const pad = 80;
  const zoom = Math.min(Math.max(
    Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1)),
    0.15), 2);
  return {
    zoom,
    panX: W / 2 - ((minX + maxX) / 2) * zoom,
    panY: H / 2 - ((minY + maxY) / 2) * zoom,
  };
}

// ── 平滑居中（easeInOut，约 400ms）──────────────────────────
function relCenterViewSmooth() {
  const target = calcCenterTarget(); if (!target) return;
  if (_relCenterAnim) cancelAnimationFrame(_relCenterAnim._raf);
  const from = { panX: relView.panX, panY: relView.panY, zoom: relView.zoom };
  const DURATION = 400;
  const start = performance.now();

  function easeInOut(t) { return t < 0.5 ? 2*t*t : -1+(4-2*t)*t; }

  function frame(now) {
    const raw = Math.min((now - start) / DURATION, 1);
    const t   = easeInOut(raw);
    relView.panX = from.panX + (target.panX - from.panX) * t;
    relView.panY = from.panY + (target.panY - from.panY) * t;
    relView.zoom = from.zoom + (target.zoom - from.zoom) * t;
    drawRelCanvas();
    if (raw < 1) {
      _relCenterAnim = { _raf: requestAnimationFrame(frame) };
    } else {
      _relCenterAnim = null;
    }
  }
  _relCenterAnim = { _raf: requestAnimationFrame(frame) };
}

// 保留原名供内部调用（不带动画，用于力模拟过程中实时更新）
function relCenterView() {
  const target = calcCenterTarget(); if (!target) return;
  relView.zoom = target.zoom;
  relView.panX = target.panX;
  relView.panY = target.panY;
  drawRelCanvas();
}

// ── 缩放 ─────────────────────────────────────────────────────
function relZoom(delta) {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  const W = canvas.clientWidth || canvas.width, H = canvas.clientHeight || canvas.height;
  const newZoom = Math.min(Math.max(relView.zoom + delta, 0.1), 4);
  relView.panX = W / 2 - (W / 2 - relView.panX) * (newZoom / relView.zoom);
  relView.panY = H / 2 - (H / 2 - relView.panY) * (newZoom / relView.zoom);
  relView.zoom = newZoom;
  drawRelCanvas();
}

// ── 力导向模拟 ───────────────────────────────────────────────
function startRelSim() {
  if (_relSimTimer) cancelAnimationFrame(_relSimTimer);
  if (_relCenterAnim) { cancelAnimationFrame(_relCenterAnim._raf); _relCenterAnim = null; }

  let alpha = 1.0;
  const NODE_R = 20;
  // 力模拟期间先做一次瞬时居中，让初始视图合理
  initRelPositions();
  relCenterView();

  function step() {
    const canvas = document.getElementById('relCanvas');
    if (!canvas) { _relSimTimer = null; return; }
    const nodes = relNodes();
    if (!nodes.length) { drawRelCanvas(); _relSimTimer = null; return; }

    const REPEL = 55000, ATTRACT = 0.022, IDEAL = 300, DAMP = 0.65, CENTER = 0.003;
    const WC = 1200, HC = 900, cx = WC / 2, cy = HC / 2;
    const force = {};
    nodes.forEach(n => { force[n.id] = { fx: 0, fy: 0 }; });

    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        const a = relPositions[nodes[i].id], b = relPositions[nodes[j].id];
        if (!a || !b) continue;
        let dx = a.x - b.x, dy = a.y - b.y;
        let dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < 0.5) { dx = (Math.random() - 0.5) * 2; dy = (Math.random() - 0.5) * 2; dist = 0.5; }
        const ux = dx / dist, uy = dy / dist;
        const f = (REPEL * alpha) / (dist * dist);
        force[nodes[i].id].fx += ux * f; force[nodes[i].id].fy += uy * f;
        force[nodes[j].id].fx -= ux * f; force[nodes[j].id].fy -= uy * f;
        if (dist < NODE_R * 4) {
          const extra = (REPEL * 6 * alpha) / (dist * dist);
          force[nodes[i].id].fx += ux * extra; force[nodes[i].id].fy += uy * extra;
          force[nodes[j].id].fx -= ux * extra; force[nodes[j].id].fy -= uy * extra;
        }
      }
    }

    D.relations.forEach(r => {
      const fk = nodeKey(r.fromType, r.fromId), tk = nodeKey(r.toType, r.toId);
      const a = relPositions[fk], b = relPositions[tk];
      if (!a || !b) return;
      const dx = b.x - a.x, dy = b.y - a.y;
      const dist = Math.sqrt(dx * dx + dy * dy) || 0.1;
      const f = ATTRACT * (dist - IDEAL) * alpha;
      const ux = dx / dist, uy = dy / dist;
      force[fk].fx += ux * f; force[fk].fy += uy * f;
      force[tk].fx -= ux * f; force[tk].fy -= uy * f;
    });

    nodes.forEach(n => {
      const p = relPositions[n.id]; if (!p) return;
      force[n.id].fx += (cx - p.x) * CENTER;
      force[n.id].fy += (cy - p.y) * CENTER;
    });

    nodes.forEach(n => {
      const p = relPositions[n.id]; if (!p || p._pinned) return;
      const f = force[n.id];
      p.vx = (p.vx + f.fx) * DAMP; p.vy = (p.vy + f.fy) * DAMP;
      const maxV = 40, spd = Math.sqrt(p.vx * p.vx + p.vy * p.vy);
      if (spd > maxV) { p.vx = p.vx / spd * maxV; p.vy = p.vy / spd * maxV; }
      p.x += p.vx; p.y += p.vy;
    });

    drawRelCanvas();

    // 加快衰减：0.94（原 0.97），约 75 帧结束，~1.2 秒
    alpha *= 0.94;
    if (alpha > 0.008) {
      _relSimTimer = requestAnimationFrame(step);
    } else {
      _relSimTimer = null;
      // 模拟结束后平滑居中，而非突然跳变
      relCenterViewSmooth();
    }
  }
  _relSimTimer = requestAnimationFrame(step);
}

// ── 辅助：采样二次贝塞尔曲线 ─────────────────────────────────
function sampleQuadBezier(p0, cp, p1, steps) {
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    pts.push({
      x: (1-t)*(1-t)*p0.x + 2*(1-t)*t*cp.x + t*t*p1.x,
      y: (1-t)*(1-t)*p0.y + 2*(1-t)*t*cp.y + t*t*p1.y,
    });
  }
  return pts;
}

function pointToSegDist(px, py, ax, ay, bx, by) {
  const dx = bx - ax, dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / lenSq));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function hitEdge(wx, wy, threshold) {
  for (const ep of _relEdgePaths) {
    const pts = ep.points;
    for (let i = 0; i < pts.length - 1; i++) {
      if (pointToSegDist(wx, wy, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y) < threshold)
        return ep.id;
    }
  }
  return null;
}

function drawArrow(ctx, fp, cp, ep, zoom) {
  const t = 0.85;
  const arx = (1-t)*(1-t)*fp.x + 2*(1-t)*t*cp.x + t*t*ep.x;
  const ary = (1-t)*(1-t)*fp.y + 2*(1-t)*t*cp.y + t*t*ep.y;
  const angle = Math.atan2(ep.y - ary, ep.x - arx);
  const al = 13 / zoom;
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ep.x, ep.y);
  ctx.lineTo(ep.x - al * Math.cos(angle - 0.45), ep.y - al * Math.sin(angle - 0.45));
  ctx.lineTo(ep.x - al * Math.cos(angle + 0.45), ep.y - al * Math.sin(angle + 0.45));
  ctx.closePath();
  ctx.fill();
}

// ── Canvas 绘制 ───────────────────────────────────────────────
function drawRelCanvas() {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth || 600, H = wrap.clientHeight || 400;
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, W, H);

  const nodes = relNodes();
  if (!nodes.length) {
    ctx.fillStyle = '#888'; ctx.font = '14px sans-serif';
    ctx.textAlign = 'center'; ctx.fillText('暂无角色', W / 2, H / 2);
    return;
  }

  ctx.save();
  ctx.translate(relView.panX, relView.panY);
  ctx.scale(relView.zoom, relView.zoom);

  const R = 20;
  _relEdgePaths = [];

  D.relations.forEach(r => {
    const fk = nodeKey(r.fromType, r.fromId), tk = nodeKey(r.toType, r.toId);
    const fp = relPositions[fk], tp = relPositions[tk];
    if (!fp || !tp) return;
    const st  = REL_STYLES[r.style] || REL_STYLES.normal;
    const dir = r.dir || 'one';
    const dx = tp.x - fp.x, dy = tp.y - fp.y;
    const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
    const hasDual = D.relations.some(x =>
      x.id !== r.id &&
      nodeKey(x.fromType, x.fromId) === tk &&
      nodeKey(x.toType,   x.toId)   === fk
    );
    const cp = { x: hasDual ? mx - dy * 0.25 : mx, y: hasDual ? my + dx * 0.25 : my };
    const totalDist = Math.hypot(tp.x - fp.x, tp.y - fp.y);
    const ratioTo   = totalDist > R ? (totalDist - R) / totalDist : 0;
    const ep = { x: fp.x + (tp.x - fp.x) * ratioTo, y: fp.y + (tp.y - fp.y) * ratioTo };
    const ratioFrom = totalDist > R ? R / totalDist : 0;
    const sp = { x: fp.x + (tp.x - fp.x) * ratioFrom, y: fp.y + (tp.y - fp.y) * ratioFrom };
    const startPt = dir === 'both' ? sp : fp;

    _relEdgePaths.push({ id: r.id, points: sampleQuadBezier(startPt, cp, ep, 20) });

    ctx.save();
    ctx.strokeStyle = st.color;
    ctx.fillStyle   = st.color;
    ctx.lineWidth   = 2 / relView.zoom;
    if (st.dash) ctx.setLineDash([6, 4]);
    else         ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(startPt.x, startPt.y);
    ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y);
    ctx.stroke();
    drawArrow(ctx, startPt, cp, ep, relView.zoom);
    if (dir === 'both') drawArrow(ctx, ep, cp, sp, relView.zoom);
    if (r.label) {
      ctx.setLineDash([]);
      ctx.font      = `${12 / relView.zoom}px sans-serif`;
      ctx.fillStyle = st.color;
      ctx.textAlign = 'center';
      ctx.fillText(r.label, cp.x, cp.y - 8 / relView.zoom);
    }
    ctx.restore();
  });

  nodes.forEach(n => {
    const p = relPositions[n.id]; if (!p) return;
    ctx.save();
    ctx.beginPath();
    ctx.arc(p.x, p.y, R, 0, Math.PI * 2);
    ctx.fillStyle   = n.dead ? '#555' : n.color;
    ctx.globalAlpha = n.dead ? 0.5 : 1;
    ctx.fill();
    ctx.strokeStyle = p._pinned ? '#fff' : 'rgba(255,255,255,0.4)';
    ctx.lineWidth   = (p._pinned ? 3 : 1.5) / relView.zoom;
    ctx.stroke();
    ctx.globalAlpha  = 1;
    ctx.fillStyle    = '#fff';
    ctx.font         = `bold 22px sans-serif`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText([...n.name][0] || '?', p.x, p.y);
    ctx.font         = `14px sans-serif`;
    ctx.fillStyle    = 'rgba(220,220,220,0.9)';
    ctx.textBaseline = 'top';
    const lbl = n.name.length > 6 ? n.name.slice(0, 6) + '…' : n.name;
    ctx.fillText(lbl, p.x, p.y + R + 4);
    ctx.restore();
  });

  ctx.restore();
  bindRelCanvasEvents(canvas, nodes);
}

// ── 边内联弹窗 ───────────────────────────────────────────────
function showEdgePopup(relId, screenX, screenY) {
  const popup = document.getElementById('relEdgePopup'); if (!popup) return;
  const r = D.relations.find(x => x.id === relId); if (!r) return;
  const nodes = relNodes();
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const from = nodeMap[nodeKey(r.fromType, r.fromId)];
  const to   = nodeMap[nodeKey(r.toType,   r.toId)];
  const st   = REL_STYLES[r.style] || REL_STYLES.normal;
  const dir  = r.dir || 'one';
  popup.innerHTML = `
    <div class="rep-header">
      <span class="rep-names">${esc(from ? from.name : '?')} ${dir === 'both' ? '↔' : '→'} ${esc(to ? to.name : '?')}</span>
      <button class="rep-close" onclick="hideEdgePopup()">✕</button>
    </div>
    <div class="rep-row">
      <select class="rep-sel" onchange="relEdit('${r.id}','style',this.value);showEdgePopup('${r.id}',null,null)">
        ${Object.entries(REL_STYLES).map(([k, v]) =>
          `<option value="${k}" ${r.style === k ? 'selected' : ''}>${v.label}</option>`
        ).join('')}
      </select>
      <select class="rep-sel" onchange="relEdit('${r.id}','dir',this.value);showEdgePopup('${r.id}',null,null)">
        ${Object.entries(REL_DIRS).map(([k, v]) =>
          `<option value="${k}" ${dir === k ? 'selected' : ''}>${v}</option>`
        ).join('')}
      </select>
    </div>
    <div class="rep-row">
      <input id="repLabelInput" class="rep-input" type="text"
        value="${esc(r.label)}" placeholder="关系描述…"
        oninput="relEdit('${r.id}','label',this.value)">
    </div>
    <div class="rep-row rep-actions">
      <button class="danger rep-del" onclick="delRelation('${r.id}');hideEdgePopup()">🗑 删除</button>
    </div>`;
  popup.style.display = 'block';
  if (screenX !== null) {
    const wrap = document.getElementById('relCanvasWrap');
    const wRect = wrap.getBoundingClientRect();
    const pw = popup.offsetWidth  || 220;
    const ph = popup.offsetHeight || 130;
    let left = screenX + 12;
    let top  = screenY - ph / 2;
    if (left + pw > wRect.width)  left = screenX - pw - 12;
    if (top < 4)                  top  = 4;
    if (top + ph > wRect.height)  top  = wRect.height - ph - 4;
    popup.style.left = left + 'px';
    popup.style.top  = top  + 'px';
  }
  requestAnimationFrame(() => {
    const inp = document.getElementById('repLabelInput');
    if (inp) { inp.focus(); inp.select(); }
  });
}

function hideEdgePopup() {
  const popup = document.getElementById('relEdgePopup');
  if (popup) popup.style.display = 'none';
}

// ── Canvas 交互 ───────────────────────────────────────────────
function bindRelCanvasEvents(canvas, nodes) {
  if (canvas._relBound) return;
  canvas._relBound = true;
  const R = 20;
  let dragNode = null, panStart = null, offX = 0, offY = 0;
  let _pointerMoved = false;

  function hitNode(wx, wy) {
    return nodes.find(n => {
      const p = relPositions[n.id];
      return p && Math.hypot(wx - p.x, wy - p.y) <= R + 4;
    });
  }

  canvas.addEventListener('pointerdown', e => {
    _pointerMoved = false;
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w  = screenToWorld(sx, sy);
    const n  = hitNode(w.x, w.y);
    if (n) {
      dragNode = n;
      offX = w.x - relPositions[n.id].x;
      offY = w.y - relPositions[n.id].y;
    } else {
      panStart = { sx, sy, px: relView.panX, py: relView.panY };
    }
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    if (dragNode) {
      _pointerMoved = true;
      const w = screenToWorld(sx, sy);
      const p = relPositions[dragNode.id];
      p.x = w.x - offX; p.y = w.y - offY;
      p.vx = 0; p.vy = 0; p._pinned = true;
      drawRelCanvas();
    } else if (panStart) {
      const moved = Math.hypot(sx - panStart.sx, sy - panStart.sy);
      if (moved > 3) _pointerMoved = true;
      relView.panX = panStart.px + (sx - panStart.sx);
      relView.panY = panStart.py + (sy - panStart.sy);
      drawRelCanvas();
    }
  });

  canvas.addEventListener('pointerup', e => {
    const rect  = canvas.getBoundingClientRect();
    const sx    = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w     = screenToWorld(sx, sy);
    if (!_pointerMoved && !dragNode) {
      const hitThreshold = 8 / relView.zoom;
      const edgeId = hitEdge(w.x, w.y, hitThreshold);
      if (edgeId) showEdgePopup(edgeId, sx, sy);
      else        hideEdgePopup();
    }
    dragNode = null; panStart = null;
  });

  canvas.addEventListener('dblclick', e => {
    const rect = canvas.getBoundingClientRect();
    const w = screenToWorld(e.clientX - rect.left, e.clientY - rect.top);
    const n = hitNode(w.x, w.y);
    if (n && relPositions[n.id]) {
      relPositions[n.id]._pinned = false;
      toast(`${n.name} 已解除固定`);
    }
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const delta   = e.deltaY > 0 ? -0.1 : 0.1;
    const newZoom = Math.min(Math.max(relView.zoom + delta, 0.1), 4);
    relView.panX  = sx - (sx - relView.panX) * (newZoom / relView.zoom);
    relView.panY  = sy - (sy - relView.panY) * (newZoom / relView.zoom);
    relView.zoom  = newZoom;
    drawRelCanvas();
  }, { passive: false });

  const tip = document.getElementById('relTooltip');
  canvas.addEventListener('mousemove', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w  = screenToWorld(sx, sy);
    const n  = hitNode(w.x, w.y);
    if (n) {
      canvas.style.cursor = 'grab';
      if (tip) {
        tip.style.display = 'block';
        tip.style.left    = (sx + 14) + 'px';
        tip.style.top     = (sy - 10) + 'px';
        const npcData = n.type === 'npc' ? D.npcs.find(x => x.id === n.rawId) : null;
        const loc = n.type === 'player'
          ? (D.bg[n.rawId] && D.bg[n.rawId].roomId ? rname(D.bg[n.rawId].roomId) : '未定位')
          : (npcData && npcData.roomId ? rname(npcData.roomId) : '未定位');
        tip.innerHTML = `<b>${esc(n.name)}</b><br>${n.type === 'player' ? '玩家' : 'NPC'}${n.dead ? ' · 💀已死亡' : ''}<br>📍${esc(loc)}`;
      }
    } else {
      if (tip) tip.style.display = 'none';
      const edgeId = hitEdge(w.x, w.y, 8 / relView.zoom);
      canvas.style.cursor = edgeId ? 'pointer' : 'default';
    }
  });
  canvas.addEventListener('mouseleave', () => {
    if (tip) tip.style.display = 'none';
    canvas.style.cursor = 'default';
  });
}

// ── 重置布局 ─────────────────────────────────────────────────
function resetRelLayout() {
  if (_relSimTimer) { cancelAnimationFrame(_relSimTimer); _relSimTimer = null; }
  if (_relCenterAnim) { cancelAnimationFrame(_relCenterAnim._raf); _relCenterAnim = null; }
  relPositions = {};
  // 不重置 relView，让节点在当前视图内重新散布，避免突然跳变
  initRelPositions();
  startRelSim();
}

// ── 复制关系摘要 ─────────────────────────────────────────────
function copyRelSummary() {
  if (!D.relations.length) { toast('暂无关系可复制'); return; }
  const nodes   = relNodes();
  const nodeMap = Object.fromEntries(nodes.map(n => [n.id, n]));
  const lines   = ['【关系图谱】'];
  D.relations.forEach(r => {
    const from = nodeMap[nodeKey(r.fromType, r.fromId)];
    const to   = nodeMap[nodeKey(r.toType,   r.toId)];
    const st   = REL_STYLES[r.style] || REL_STYLES.normal;
    const dir  = r.dir === 'both' ? '↔' : '→';
    lines.push(`${from ? from.name : '?'} —[${st.label}${r.label ? '·' + r.label : ''}]${dir} ${to ? to.name : '?'}`);
  });
  copyText(lines.join('\n')).then(ok => toast(ok ? '📋 已复制关系摘要' : '复制失败'));
}