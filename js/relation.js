// js/relation.js — 关系图谱 (ES6 Module)
import { D, uid, esc, pname, pcolor } from './data.js';
import { save, toast, copyText, uiState } from './core.js'; // 【修改点】引入 uiState

const REL_STYLES = {
  normal:  { label: '普通',   color: '#888888', dash: false },
  ally:    { label: '盟友',   color: '#4cc9a0', dash: false },
  hostile: { label: '敌对',   color: '#e0605e', dash: false },
  family:  { label: '亲属',   color: '#e8a13a', dash: false },
  secret:  { label: '秘密',   color: '#b27cd8', dash: true  },
};

const REL_DIRS = {
  one:  '单向 →',
  both: '双向 ↔',
};

let relView = { panX: 0, panY: 0, zoom: 1 };
let _relEdgePaths = [];
let _nodeDims = {}; 

// 交互状态
let defStyle = 'normal'; 
let defDir = 'one';      
let connectingNode = null;
let connectCurrentPos = null;
let activePopupEdgeId = null;
let hoveredEdgeId = null; 

let _animFrameId = null;

function getThemeColor(varName, fallback) {
  const val = getComputedStyle(document.body).getPropertyValue(varName).trim();
  return val || fallback;
}

window.addEventListener('trpg-lib-tab-changed', (e) => {
  if (e.detail.sub === 'relation') {
    renderRelationLib();
    startAnimLoop();
  } else {
    stopAnimLoop();
  }
});

window.addEventListener('trpg-ui-update', () => {
  if (document.getElementById('libPageRelation')?.style.display !== 'none') {
    renderLeftSidebar();
    renderRelList();
    if (activePopupEdgeId) showEdgePopup(activePopupEdgeId);
    
    // 【修改点】同步更新编辑面板的显示状态
    const panel = document.getElementById('editModePanel');
    if (panel) panel.style.display = uiState.edit ? 'flex' : 'none';
    if (!uiState.edit) hideEdgePopup();
  }
});

function relNodes() {
  const players = (D.players || []).map((_, i) => {
    const b = D.bg[i];
    const dispName = (b && b.card && b.card.name) ? `${b.card.name}(${pname(i)})` : pname(i);
    return { id: `p_${i}`, type: 'player', rawId: i, name: dispName, color: pcolor(i), dead: b && b.dead };
  });
  const npcs = (D.npcs || []).map((n, i) => {
    const rawId = n.id !== undefined ? n.id : (n.uuid !== undefined ? n.uuid : i);
    return {
      id: `n_${rawId}`, type: 'npc', rawId: rawId, name: n.name || '未知', color: n.color || '#b27cd8', dead: n.dead
    };
  });
  return [...players, ...npcs];
}

function nodeKey(type, rawId) { return type === 'player' ? `p_${rawId}` : `n_${rawId}`; }

function initRelPositions() {
  if (!D.ui) D.ui = {};
  if (!D.ui.relPositions) D.ui.relPositions = {};
  if (!D.ui.relHidden) D.ui.relHidden = {}; 
  
  const nodes = relNodes();
  const wrap = document.getElementById('relCanvasWrap');
  const W = wrap ? wrap.clientWidth : 800, H = wrap ? wrap.clientHeight : 600;
  let changed = false;
  nodes.forEach(n => {
    if (!D.ui.relPositions[n.id]) {
      D.ui.relPositions[n.id] = { x: W / 2 + (Math.random() - 0.5) * 400, y: H / 2 + (Math.random() - 0.5) * 400 };
      changed = true;
    }
  });
  if (changed) save();
}

export function renderRelationLib() {
  if (!D.relations) D.relations = [];
  const el = document.getElementById('libPageRelation'); if (!el) return;
  
  if (el.parentElement) {
    el.parentElement.classList.add('rel-page-wrapper');
  }

  el.innerHTML = `
    <div class="rel-layout">
      <div class="rel-sidebar-left">
        <div class="rel-header"><h3>👁️ 显示对象</h3></div>
        <div id="relLeftList" class="rel-content rel-no-padding"></div>
      </div>

      <div id="relCanvasWrap" class="rel-canvas-wrap">
        <canvas id="relCanvas" class="rel-canvas"></canvas>
        
        <div class="rel-controls">
          <div class="rel-controls-row">
            <button class="rel-btn" onclick="relCenterView()">⌖ 居中</button>
            <button class="rel-btn" onclick="relAutoLayout()">✨ 自动布局</button>
          </div>
          
          <!-- 【修改点】面板显示状态绑定 uiState.edit -->
          <div id="editModePanel" class="rel-panel rel-flex-col" style="display: ${uiState.edit ? 'flex' : 'none'};">
            <div class="rel-panel-title">新建连线默认关系：</div>
            <div id="defStyleTags" class="rel-tags"></div>
            <div class="rel-panel-title mt-4">新建连线默认箭头：</div>
            <div id="defDirTags" class="rel-tags"></div>
          </div>
        </div>
        
        <div id="relEdgePopup" class="rel-popup" style="display: none; width: 320px;"></div>
      </div>

      <div class="rel-sidebar-right">
        <div class="rel-header">
          <h3>🔗 关系列表</h3>
          <button class="primary rel-btn-add" onclick="addRelation()">＋ 新增</button>
        </div>
        <div id="relList" class="rel-content"></div>
      </div>
    </div>`;
  
  initRelPositions();
  renderLeftSidebar();
  renderRelList();
  renderConnectPanel();
  requestAnimationFrame(() => { relCenterView(); bindRelCanvasEvents(); });
}

export function renderLeftSidebar() {
  const el = document.getElementById('relLeftList'); if (!el) return;
  const nodes = relNodes();
  
  el.innerHTML = nodes.map(n => {
    const isHidden = D.ui.relHidden && D.ui.relHidden[n.id];
    return `
      <div class="rel-char-item" onclick="toggleRelNode('${n.id}')">
        <div class="rel-char-name">
          <span class="rel-char-color" style="background: ${n.color}"></span>
          ${esc(n.name)}
        </div>
        <input type="checkbox" ${isHidden ? '' : 'checked'} onclick="event.stopPropagation(); toggleRelNode('${n.id}')">
      </div>
    `;
  }).join('');
}

export function toggleRelNode(id) {
  if (!D.ui.relHidden) D.ui.relHidden = {};
  D.ui.relHidden[id] = !D.ui.relHidden[id];
  save();
  renderLeftSidebar();
  drawRelCanvas();
}

function renderConnectPanel() {
  const styleBox = document.getElementById('defStyleTags');
  const dirBox = document.getElementById('defDirTags');
  if (!styleBox || !dirBox) return;

  styleBox.innerHTML = Object.entries(REL_STYLES).map(([k, v]) => {
    const isActive = defStyle === k;
    const bg = isActive ? v.color : 'var(--bg-dark)';
    const color = isActive ? '#fff' : 'var(--mute)';
    const border = isActive ? v.color : 'var(--border)';
    return `<button class="rel-tag" style="background:${bg}; color:${color}; border-color:${border};" onclick="setDefStyle('${k}')">${v.label}</button>`;
  }).join('');

  dirBox.innerHTML = Object.entries(REL_DIRS).map(([k, v]) => {
    const isActive = defDir === k;
    const stColor = REL_STYLES[defStyle].color;
    const bg = isActive ? stColor : 'var(--bg-dark)';
    const color = isActive ? '#fff' : 'var(--mute)';
    const border = isActive ? stColor : 'var(--border)';
    return `<button class="rel-tag" style="background:${bg}; color:${color}; border-color:${border};" onclick="setDefDir('${k}')">${v}</button>`;
  }).join('');
}

export function setDefStyle(k) { defStyle = k; renderConnectPanel(); }
export function setDefDir(k) { defDir = k; renderConnectPanel(); }

export function renderRelList() {
  const el = document.getElementById('relList'); if (!el) return;
  if (!D.relations || !D.relations.length) {
    el.innerHTML = '<p class="rel-list-hint">暂无关系，点击右上角新增</p>';
    return;
  }
  
  el.innerHTML = D.relations.map(r => {
    const st = REL_STYLES[r.style] || REL_STYLES.normal;
    const dir = r.dir || 'one';
    const nodes_ = relNodes();
    const opts = nodes_.map(n => `<option value="${n.type}|${n.rawId}" ${nodeKey(r.fromType, r.fromId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');
    const opts2 = nodes_.map(n => `<option value="${n.type}|${n.rawId}" ${nodeKey(r.toType, r.toId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');
    
    const styleTags = Object.entries(REL_STYLES).map(([k, v]) => {
      const isActive = r.style === k;
      const bg = isActive ? v.color : 'var(--bg-dark)';
      const color = isActive ? '#fff' : 'var(--mute)';
      const border = isActive ? v.color : 'var(--border)';
      return `<button class="rel-tag" style="background:${bg}; color:${color}; border-color:${border};" onclick="relEdit('${r.id}','style','${k}')">${v.label}</button>`;
    }).join('');

    const dirTags = Object.entries(REL_DIRS).map(([k, v]) => {
      const isActive = dir === k;
      const bg = isActive ? st.color : 'var(--bg-dark)';
      const color = isActive ? '#fff' : 'var(--mute)';
      const border = isActive ? st.color : 'var(--border)';
      return `<button class="rel-tag" style="background:${bg}; color:${color}; border-color:${border};" onclick="relEdit('${r.id}','dir','${k}')">${v}</button>`;
    }).join('');

    return `
    <div class="rel-card">
      <div class="rel-card-row">
        <select class="rel-card-select" onchange="relEditNode('${r.id}','from',this.value)">${opts}</select>
        <span class="rel-card-arrow" style="color: ${st.color};">${dir === 'both' ? '↔' : '→'}</span>
        <select class="rel-card-select" onchange="relEditNode('${r.id}','to',this.value)">${opts2}</select>
      </div>
      <div class="rel-tags">${styleTags}</div>
      <div class="rel-tags mb-10">${dirTags}</div>
      <div class="rel-card-row mb-0">
        <input type="text" class="rel-card-input" value="${esc(r.label)}" placeholder="关系描述（如：旧友）" onchange="relEdit('${r.id}','label',this.value)">
        <button class="danger rel-btn-danger" onclick="delRelation('${r.id}')">✕ 删除</button>
      </div>
    </div>`;
  }).join('');
}

export function addRelation() {
  if (!D.relations) D.relations = [];
  const nodes = relNodes();
  if (nodes.length < 2) { toast('至少需要2个角色才能建立关系'); return; }
  D.relations.push({ id: uid(), fromType: nodes[0].type, fromId: nodes[0].rawId, toType: nodes[1].type, toId: nodes[1].rawId, label: '', style: 'normal', dir: 'one' });
  save(); window.dispatchEvent(new Event('trpg-ui-update'));
}

export function delRelation(id) {
  D.relations = D.relations.filter(r => r.id !== id);
  if (activePopupEdgeId === id) hideEdgePopup();
  save(); window.dispatchEvent(new Event('trpg-ui-update'));
}

export function relEdit(id, field, val) {
  const r = D.relations.find(x => x.id === id); if (!r) return;
  r[field] = val;
  save(); window.dispatchEvent(new Event('trpg-ui-update'));
}

export function relEditNode(id, side, val) {
  const r = D.relations.find(x => x.id === id); if (!r) return;
  const [type, rawId] = val.split('|');
  if (side === 'from') { r.fromType = type; r.fromId = type === 'player' ? +rawId : rawId; }
  else                 { r.toType   = type; r.toId   = type === 'player' ? +rawId : rawId; }
  save(); window.dispatchEvent(new Event('trpg-ui-update'));
}

export function relAutoLayout() {
  const nodes = relNodes().filter(n => !D.ui.relHidden[n.id]);
  if (nodes.length < 2) return;
  
  let simPos = {};
  nodes.forEach(n => simPos[n.id] = { x: D.ui.relPositions[n.id].x, y: D.ui.relPositions[n.id].y, vx: 0, vy: 0 });

  const canvas = document.getElementById('relCanvas');
  const W = canvas ? canvas.clientWidth : 800, H = canvas ? canvas.clientHeight : 600;

  for (let step = 0; step < 150; step++) {
    for (let i = 0; i < nodes.length; i++) {
      for (let j = i + 1; j < nodes.length; j++) {
        let dx = simPos[nodes[i].id].x - simPos[nodes[j].id].x;
        let dy = simPos[nodes[i].id].y - simPos[nodes[j].id].y;
        let dist = Math.hypot(dx, dy) || 1;
        // 👇 修改点 1：增大斥力，让节点之间推得更远 (原为 15000)
        let f = 45000 / (dist * dist);
        simPos[nodes[i].id].vx += (dx/dist)*f; simPos[nodes[i].id].vy += (dy/dist)*f;
        simPos[nodes[j].id].vx -= (dx/dist)*f; simPos[nodes[j].id].vy -= (dy/dist)*f;
      }
    }
    if (D.relations) {
      D.relations.forEach(r => {
        let fk = nodeKey(r.fromType, r.fromId), tk = nodeKey(r.toType, r.toId);
        if (!simPos[fk] || !simPos[tk]) return;
        let dx = simPos[tk].x - simPos[fk].x, dy = simPos[tk].y - simPos[fk].y;
        let dist = Math.hypot(dx, dy) || 1;
        // 👇 修改点 2：增加连线理想长度，让线更长 (原为 200)
        let f = (dist - 350) * 0.05; 
        simPos[fk].vx += (dx/dist)*f; simPos[fk].vy += (dy/dist)*f;
        simPos[tk].vx -= (dx/dist)*f; simPos[tk].vy -= (dy/dist)*f;
      });
    }
    nodes.forEach(n => {
      simPos[n.id].vx += (W/2 - simPos[n.id].x) * 0.02;
      simPos[n.id].vy += (H/2 - simPos[n.id].y) * 0.02;
      simPos[n.id].x += simPos[n.id].vx;
      simPos[n.id].y += simPos[n.id].vy;
      simPos[n.id].vx *= 0.6; simPos[n.id].vy *= 0.6;
    });
  }

  const startPos = JSON.parse(JSON.stringify(D.ui.relPositions));
  const duration = 400;
  const startTime = performance.now();

  function animate(now) {
    let t = Math.min((now - startTime) / duration, 1);
    t = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; 
    nodes.forEach(n => {
      D.ui.relPositions[n.id].x = startPos[n.id].x + (simPos[n.id].x - startPos[n.id].x) * t;
      D.ui.relPositions[n.id].y = startPos[n.id].y + (simPos[n.id].y - startPos[n.id].y) * t;
    });
    if (t < 1) requestAnimationFrame(animate);
    else { save(); relCenterView(); }
  }
  requestAnimationFrame(animate);
}

export function relCenterView() {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  const nodes = relNodes().filter(n => !D.ui.relHidden[n.id]); 
  if (!nodes.length) return;
  const positions = nodes.map(n => D.ui.relPositions[n.id]).filter(Boolean);
  if (!positions.length) return;
  
  const minX = Math.min(...positions.map(p => p.x)), maxX = Math.max(...positions.map(p => p.x));
  const minY = Math.min(...positions.map(p => p.y)), maxY = Math.max(...positions.map(p => p.y));
  const W = canvas.clientWidth, H = canvas.clientHeight;
  
  const pad = 100;
  const zoom = Math.min(Math.max(Math.min((W - pad * 2) / (maxX - minX || 1), (H - pad * 2) / (maxY - minY || 1)), 0.2), 1.5);
  
  relView.zoom = zoom;
  relView.panX = W / 2 - ((minX + maxX) / 2) * zoom;
  relView.panY = H / 2 - ((minY + maxY) / 2) * zoom;
}

export function relZoom(delta) {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  const W = canvas.clientWidth, H = canvas.clientHeight;
  const newZoom = Math.min(Math.max(relView.zoom + delta, 0.2), 3);
  relView.panX = W / 2 - (W / 2 - relView.panX) * (newZoom / relView.zoom);
  relView.panY = H / 2 - (H / 2 - relView.panY) * (newZoom / relView.zoom);
  relView.zoom = newZoom;
}

function screenToWorld(sx, sy) { return { x: (sx - relView.panX) / relView.zoom, y: (sy - relView.panY) / relView.zoom }; }

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
      if (pointToSegDist(wx, wy, pts[i].x, pts[i].y, pts[i+1].x, pts[i+1].y) < threshold) return ep.id;
    }
  }
  return null;
}

export function showEdgePopup(relId, screenX = null, screenY = null) {
  const popup = document.getElementById('relEdgePopup'); if (!popup) return;
  const r = D.relations.find(x => x.id === relId); if (!r) { hideEdgePopup(); return; }
  
  activePopupEdgeId = relId;
  const nodes = relNodes();
  const st = REL_STYLES[r.style] || REL_STYLES.normal;
  const dir = r.dir || 'one';

  const opts = nodes.map(n => `<option value="${n.type}|${n.rawId}" ${nodeKey(r.fromType, r.fromId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');
  const opts2 = nodes.map(n => `<option value="${n.type}|${n.rawId}" ${nodeKey(r.toType, r.toId) === n.id ? 'selected' : ''}>${esc(n.name)}</option>`).join('');

  const styleTags = Object.entries(REL_STYLES).map(([k, v]) => {
    const isActive = r.style === k;
    const bg = isActive ? v.color : 'var(--bg-dark)';
    const color = isActive ? '#fff' : 'var(--mute)';
    const border = isActive ? v.color : 'var(--border)';
    return `<button class="rel-tag rel-tag-sm" style="background:${bg}; color:${color}; border-color:${border};" onclick="relEdit('${r.id}','style','${k}')">${v.label}</button>`;
  }).join('');

  const dirTags = Object.entries(REL_DIRS).map(([k, v]) => {
    const isActive = dir === k;
    const bg = isActive ? st.color : 'var(--bg-dark)';
    const color = isActive ? '#fff' : 'var(--mute)';
    const border = isActive ? st.color : 'var(--border)';
    return `<button class="rel-tag rel-tag-sm" style="background:${bg}; color:${color}; border-color:${border};" onclick="relEdit('${r.id}','dir','${k}')">${v}</button>`;
  }).join('');

  popup.innerHTML = `
    <div class="rel-popup-header">
      <span class="rel-popup-title">编辑关系</span>
      <button class="rel-popup-close" onclick="hideEdgePopup()">✕</button>
    </div>
    <div class="rel-card-row">
      <select class="rel-card-select" onchange="relEditNode('${r.id}','from',this.value)">${opts}</select>
      <span class="rel-card-arrow" style="color: ${st.color};">${dir === 'both' ? '↔' : '→'}</span>
      <select class="rel-card-select" onchange="relEditNode('${r.id}','to',this.value)">${opts2}</select>
    </div>
    <div class="rel-tags">${styleTags}</div>
    <div class="rel-tags mb-10">${dirTags}</div>
    <div class="rel-card-row mb-0">
      <input type="text" class="rel-card-input rel-popup-input" value="${esc(r.label)}" placeholder="关系描述（如：旧友）" onchange="relEdit('${r.id}','label',this.value)">
      <button class="danger rel-btn-danger" onclick="delRelation('${r.id}')">✕ 删除</button>
    </div>`;
  
  popup.style.display = 'block';
  if (screenX !== null && screenY !== null) {
    const wrap = document.getElementById('relCanvasWrap');
    const wRect = wrap.getBoundingClientRect();
    let left = screenX + 10, top = screenY - 20;
    if (left + 340 > wRect.width) left = screenX - 330;
    if (top + 200 > wRect.height) top = wRect.height - 210;
    popup.style.left = left + 'px'; popup.style.top = top + 'px';
  }
}

export function hideEdgePopup() {
  activePopupEdgeId = null;
  const popup = document.getElementById('relEdgePopup');
  if (popup) popup.style.display = 'none';
}

function startAnimLoop() {
  if (!_animFrameId) {
    const loop = () => { drawRelCanvas(); _animFrameId = requestAnimationFrame(loop); };
    _animFrameId = requestAnimationFrame(loop);
  }
}
function stopAnimLoop() {
  if (_animFrameId) { cancelAnimationFrame(_animFrameId); _animFrameId = null; }
}

function drawArrow(ctx, fp, cp, ep) {
  const t = 0.85;
  const arx = (1-t)*(1-t)*fp.x + 2*(1-t)*t*cp.x + t*t*ep.x;
  const ary = (1-t)*(1-t)*fp.y + 2*(1-t)*t*cp.y + t*t*ep.y;
  const angle = Math.atan2(ep.y - ary, ep.x - arx);
  const al = 12; 
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(ep.x, ep.y);
  ctx.lineTo(ep.x - al * Math.cos(angle - 0.5), ep.y - al * Math.sin(angle - 0.5));
  ctx.lineTo(ep.x - al * Math.cos(angle + 0.5), ep.y - al * Math.sin(angle + 0.5));
  ctx.closePath();
  ctx.fill();
}

function drawLabelPill(ctx, text, x, y, bgColor, textColor, borderColor) {
  ctx.font = `bold 12px sans-serif`;
  const padX = 8, padY = 4;
  const textW = ctx.measureText(text).width;
  const textH = 12;
  const h = textH + padY * 2;
  const w = textW + padX * 2;
  const rx = x - w / 2;
  const ry = y - h / 2;
  const r = 6;

  ctx.beginPath();
  ctx.moveTo(rx + r, ry);
  ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
  ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
  ctx.arcTo(rx, ry + h, rx, ry, r);
  ctx.arcTo(rx, ry, rx + w, ry, r);
  ctx.closePath();

  ctx.fillStyle = bgColor;
  ctx.fill();
  ctx.lineWidth = 1.5;
  ctx.strokeStyle = borderColor;
  ctx.stroke();

  ctx.fillStyle = textColor;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x, y + 1); 
}

export function drawRelCanvas() {
  const canvas = document.getElementById('relCanvas'); if (!canvas) return;
  const wrap = canvas.parentElement;
  const W = wrap.clientWidth, H = wrap.clientHeight;
  if (W === 0 || H === 0) return; 
  
  const dpr = window.devicePixelRatio || 1;
  canvas.width = W * dpr; canvas.height = H * dpr;
  const ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);

  const bgColor = getThemeColor('--bg', '#ffffff');
  const muteColor = getThemeColor('--mute', '#888888');

  ctx.clearRect(0, 0, W, H);
  
  const visibleNodes = relNodes().filter(n => !D.ui.relHidden[n.id]);
  if (!visibleNodes.length) return;

  ctx.save();
  ctx.translate(relView.panX, relView.panY);
  ctx.scale(relView.zoom, relView.zoom);

  _relEdgePaths = [];
  _nodeDims = {}; 

  ctx.font = `bold 14px sans-serif`;
  visibleNodes.forEach(n => {
    const textW = ctx.measureText(n.name).width;
    const w = Math.max(40, textW + 24); 
    const h = 32; 
    _nodeDims[n.id] = { w, h };
  });

  const time = performance.now() / 1000; 
  const renderPos = {};
  
  visibleNodes.forEach((n, idx) => {
    const p = D.ui.relPositions[n.id];
    if (!p) return;
    if (connectingNode?.id === n.id || (window._dragNodeId === n.id)) {
      renderPos[n.id] = { x: p.x, y: p.y };
    } else {
      const floatY = Math.sin(time * 1.5 + idx) * 6;
      renderPos[n.id] = { x: p.x, y: p.y + floatY };
    }
  });

  if (D.relations) {
    D.relations.forEach(r => {
      const fk = nodeKey(r.fromType, r.fromId), tk = nodeKey(r.toType, r.toId);
      const fp = renderPos[fk], tp = renderPos[tk];
      if (!fp || !tp) return; 
      
      const st = REL_STYLES[r.style] || REL_STYLES.normal;
      const dir = r.dir || 'one';
      const hasDual = D.relations.some(x => x.id !== r.id && nodeKey(x.fromType, x.fromId) === tk && nodeKey(x.toType, x.toId) === fk);
      
      let dx = tp.x - fp.x, dy = tp.y - fp.y;
      let dist = Math.hypot(dx, dy);
      if (dist < 1) { dx = 1; dy = 0; dist = 1; }
      
      const mx = (fp.x + tp.x) / 2, my = (fp.y + tp.y) / 2;
      const angle = Math.atan2(dy, dx);
      
      const dimTo = _nodeDims[tk] || {w: 40, h: 32};
      const rxTo = dimTo.w / 2, ryTo = dimTo.h / 2;
      const rTo = (rxTo * ryTo) / Math.sqrt(Math.pow(ryTo * Math.cos(angle), 2) + Math.pow(rxTo * Math.sin(angle), 2));
      
      const dimFrom = _nodeDims[fk] || {w: 40, h: 32};
      const rxFrom = dimFrom.w / 2, ryFrom = dimFrom.h / 2;
      const rFrom = (rxFrom * ryFrom) / Math.sqrt(Math.pow(ryFrom * Math.cos(angle), 2) + Math.pow(rxFrom * Math.sin(angle), 2));

      const minVisualDist = rFrom + rTo + 30;
      const isOverlap = dist < minVisualDist;
      const drawDist = Math.max(dist, minVisualDist);
      
      const drawDx = Math.cos(angle) * drawDist;
      const drawDy = Math.sin(angle) * drawDist;
      const drawFp = { x: mx - drawDx / 2, y: my - drawDy / 2 };
      
      const ratioTo = (drawDist - rTo - 6) / drawDist;
      const ratioFrom = (rFrom + 6) / drawDist;
      
      const ep = { x: drawFp.x + drawDx * ratioTo, y: drawFp.y + drawDy * ratioTo };
      const sp = { x: drawFp.x + drawDx * ratioFrom, y: drawFp.y + drawDy * ratioFrom };
      
      let offset = hasDual ? Math.max(drawDist * 0.2, 30) : 0;
      if (isOverlap) offset = Math.max(offset, 50); 
      
      const cp = { x: mx - Math.sin(angle) * offset, y: my + Math.cos(angle) * offset };
      const startPt = dir === 'both' ? sp : drawFp;

      _relEdgePaths.push({ id: r.id, points: sampleQuadBezier(startPt, cp, ep, 15) });

      const isHovered = hoveredEdgeId === r.id;
      const isActive = activePopupEdgeId === r.id;

      ctx.save();
      if (isHovered || isActive) {
        ctx.strokeStyle = st.color;
        ctx.lineWidth = 8;
        ctx.globalAlpha = 0.3;
        ctx.beginPath(); ctx.moveTo(startPt.x, startPt.y); ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y); ctx.stroke();
        ctx.globalAlpha = 1.0;
      }

      ctx.strokeStyle = st.color; ctx.fillStyle = st.color;
      ctx.lineWidth = isActive ? 3.5 : 2.5; 
      if (st.dash) ctx.setLineDash([8, 6]);
      
      ctx.beginPath(); ctx.moveTo(startPt.x, startPt.y); ctx.quadraticCurveTo(cp.x, cp.y, ep.x, ep.y); ctx.stroke();
      drawArrow(ctx, startPt, cp, ep);
      if (dir === 'both') drawArrow(ctx, ep, cp, sp);
      
      if (r.label) {
        ctx.setLineDash([]);
        drawLabelPill(ctx, r.label, cp.x, cp.y, bgColor, st.color, st.color);
      }
      ctx.restore();
    });
  }

  if (connectingNode && connectCurrentPos) {
    const fp = renderPos[connectingNode.id];
    const st = REL_STYLES[defStyle];
    ctx.save();
    ctx.strokeStyle = st.color; ctx.lineWidth = 3; ctx.setLineDash([10, 8]);
    ctx.beginPath(); ctx.moveTo(fp.x, fp.y); ctx.lineTo(connectCurrentPos.x, connectCurrentPos.y); ctx.stroke();
    ctx.restore();
  }

  visibleNodes.forEach(n => {
    const p = renderPos[n.id]; if (!p) return;
    const dim = _nodeDims[n.id];
    const w = dim.w, h = dim.h, r = h / 2;
    const rx = p.x - w / 2, ry = p.y - h / 2;

    ctx.save();
    
    ctx.beginPath();
    ctx.moveTo(rx + r, ry);
    ctx.arcTo(rx + w, ry, rx + w, ry + h, r);
    ctx.arcTo(rx + w, ry + h, rx, ry + h, r);
    ctx.arcTo(rx, ry + h, rx, ry, r);
    ctx.arcTo(rx, ry, rx + w, ry, r);
    ctx.closePath();

    ctx.fillStyle = n.dead ? muteColor : n.color;
    ctx.globalAlpha = n.dead ? 0.6 : 1;
    ctx.fill();
    
    ctx.strokeStyle = bgColor; 
    ctx.lineWidth = 3; 
    ctx.stroke();
    
    ctx.globalAlpha = 1; 
    ctx.fillStyle = '#ffffff'; 
    
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 4;
    ctx.shadowOffsetY = 1;
    
    ctx.font = `bold 14px sans-serif`; 
    ctx.textAlign = 'center'; 
    ctx.textBaseline = 'middle';
    ctx.fillText(n.name, p.x, p.y);
    
    ctx.restore();
  });

  ctx.restore();
}

function bindRelCanvasEvents() {
  const canvas = document.getElementById('relCanvas');
  if (!canvas || canvas._relBound) return;
  canvas._relBound = true;
  
  let dragNode = null, panStart = null;
  let pointerMoved = false;
  let clickStartX = 0, clickStartY = 0; 

  function hitNode(wx, wy) {
    const visibleNodes = relNodes().filter(n => !D.ui.relHidden[n.id]);
    for (let i = visibleNodes.length - 1; i >= 0; i--) {
      const n = visibleNodes[i];
      const p = D.ui.relPositions[n.id];
      const dim = _nodeDims[n.id] || {w: 40, h: 32};
      if (p && Math.abs(wx - p.x) <= dim.w / 2 + 5 && Math.abs(wy - p.y) <= dim.h / 2 + 5) {
        return n;
      }
    }
    return null;
  }

  canvas.addEventListener('pointerdown', e => {
    clickStartX = e.clientX;
    clickStartY = e.clientY;
    pointerMoved = false; 
    
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    
    const clickedNode = hitNode(w.x, w.y);
    
    if (clickedNode) {
      if (uiState.edit) { // 【修改点】使用 uiState.edit
        connectingNode = clickedNode;
        connectCurrentPos = { x: w.x, y: w.y };
      } else {
        dragNode = clickedNode;
        window._dragNodeId = clickedNode.id; 
        canvas.style.cursor = 'grabbing';
      }
    } else {
      panStart = { sx, sy, px: relView.panX, py: relView.panY };
      canvas.style.cursor = 'move';
    }
    canvas.setPointerCapture(e.pointerId);
  });

  canvas.addEventListener('pointermove', e => {
    if (Math.hypot(e.clientX - clickStartX, e.clientY - clickStartY) > 4) {
      pointerMoved = true;
    }
    
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);
    
    if (pointerMoved) {
      if (connectingNode) {
        connectCurrentPos = { x: w.x, y: w.y };
      } else if (dragNode) {
        D.ui.relPositions[dragNode.id].x = w.x;
        D.ui.relPositions[dragNode.id].y = w.y;
      } else if (panStart) {
        relView.panX = panStart.px + (sx - panStart.sx);
        relView.panY = panStart.py + (sy - panStart.sy);
      }
    }
    
    const hNode = hitNode(w.x, w.y);
    const hEdge = uiState.edit ? hitEdge(w.x, w.y, 15 / relView.zoom) : null; // 【修改点】使用 uiState.edit
    
    hoveredEdgeId = hEdge;
    
    if (hNode) canvas.style.cursor = uiState.edit ? 'crosshair' : 'grab'; // 【修改点】使用 uiState.edit
    else if (hEdge) canvas.style.cursor = 'pointer';
    else canvas.style.cursor = 'default';
  });

  canvas.addEventListener('pointerup', e => {
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const w = screenToWorld(sx, sy);

    if (!pointerMoved) {
      if (uiState.edit) { // 【修改点】使用 uiState.edit
        const edgeId = hitEdge(w.x, w.y, 15 / relView.zoom);
        if (edgeId) showEdgePopup(edgeId, sx, sy);
        else hideEdgePopup(); 
      } else {
        hideEdgePopup();
      }
    } else {
      if (connectingNode) {
        const targetNode = hitNode(w.x, w.y);
        if (targetNode && targetNode.id !== connectingNode.id) {
          if (!D.relations) D.relations = [];
          D.relations.push({
            id: uid(), fromType: connectingNode.type, fromId: connectingNode.rawId,
            toType: targetNode.type, toId: targetNode.rawId, label: '', 
            style: defStyle, dir: defDir 
          });
          save(); window.dispatchEvent(new Event('trpg-ui-update'));
          toast(`已连接: ${connectingNode.name} → ${targetNode.name}`);
        }
      } 
      else if (dragNode) {
        save(); 
      } 
    }
    
    connectingNode = null; connectCurrentPos = null;
    dragNode = null; window._dragNodeId = null;
    panStart = null;
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('wheel', e => {
    e.preventDefault();
    const rect = canvas.getBoundingClientRect();
    const sx = e.clientX - rect.left, sy = e.clientY - rect.top;
    const delta = e.deltaY > 0 ? -0.15 : 0.15;
    const newZoom = Math.min(Math.max(relView.zoom + delta, 0.2), 3);
    relView.panX = sx - (sx - relView.panX) * (newZoom / relView.zoom);
    relView.panY = sy - (sy - relView.panY) * (newZoom / relView.zoom);
    relView.zoom = newZoom;
  }, { passive: false });
}

// 【修改点】移除了 toggleRelEditMode
Object.assign(window, {
  renderRelationLib, addRelation, delRelation, relEdit, relEditNode,
  relCenterView, relZoom, relAutoLayout,
  showEdgePopup, hideEdgePopup, setDefStyle, setDefDir, toggleRelNode
});
