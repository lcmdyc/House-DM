// js/attr.js — 独立的角色属性模块 (供玩家和NPC共用)
import { D, esc } from './data.js';
import { save } from './core.js';

// ════════════════════════════════════════════════════════════
// 1. 核心滚轮调整逻辑 (挂载到全局供 HTML 内联事件调用)
// ════════════════════════════════════════════════════════════
window.onWheelAdj = function(e, type, entityId, attrId) {
  if (e && e.preventDefault) e.preventDefault();
  // 支持真实的鼠标滚轮事件，也支持传入 {isUp: true/false} 模拟按钮点击
  const delta = (e && e.deltaY < 0) || (e && e.isUp) ? 1 : -1; 
  
  if (type === 'player') {
    const b = D.bg[entityId]; // entityId 是玩家索引 i
    if (b) {
      const old = parseInt(b.card.vals[attrId], 10) || 0;
      b.card.vals[attrId] = Math.max(0, old + delta);
      save();
    }
  } else if (type === 'preset') {
    const b = D.bg[entityId]; // entityId 是玩家索引 i
    if (b && b.presetAttrs) {
      const a = b.presetAttrs.find(x => x.id === attrId);
      if (a) {
        a.val = Math.max(0, (parseInt(a.val, 10) || 0) + delta);
        save();
      }
    }
  } else if (type === 'npc') {
    const n = D.npcs.find(x => x.id === entityId); // entityId 是 NPC ID
    if (n && n.attrs) {
      const a = n.attrs.find(x => x.id === attrId);
      if (a) {
        a.val = Math.max(0, (parseInt(a.val, 10) || 0) + delta);
        save();
      }
    }
  }
};

// ════════════════════════════════════════════════════════════
// 2. 统一渲染属性展示胶囊 (供侧栏 / 浮窗使用)
// ════════════════════════════════════════════════════════════
export function renderAttrChips(type, entityId, attrs, valsObj = null) {
  if (!attrs || !attrs.length) return '';
  
  // 过滤出允许显示的属性
  const visibleAttrs = attrs.filter(a => a.show !== false);
  if (!visibleAttrs.length) return '';

  return visibleAttrs.map(a => {
    const v = valsObj ? (valsObj[a.id] || 0) : (a.val || 0);
    const num = parseInt(v, 10);
    const isZero = !isNaN(num) && num === 0;
    
    return `<span class="${isZero ? 'z' : ''}"
      title="${esc(a.name)}（滚轮增减）"
      onwheel="window.onWheelAdj(event, '${type}', '${entityId}', '${a.id}')">
      <i>${esc(a.name)}</i><b>${esc(v)}</b>
    </span>`;
  }).join('');
}

// ════════════════════════════════════════════════════════════
// 3. 统一渲染属性编辑行 (供资料库详情页使用)
// ════════════════════════════════════════════════════════════
export function renderAttrEditRows(type, entityId, attrs, updateFnName, delFnName) {
  if (!attrs || !attrs.length) return '<p class="hint">暂无属性，点击＋添加</p>';
  
  return attrs.map((a, idx) => `
    <div class="attr-row" style="display:flex;align-items:center;gap:6px;margin-bottom:6px;">
      <input class="attr-name" value="${esc(a.name)}" placeholder="属性名" style="flex:1;max-width:120px;"
        oninput="${updateFnName}('${entityId}', ${idx}, 'name', this.value)">
      
      <button onclick="window.onWheelAdj({isUp:false}, '${type}', '${entityId}', '${a.id}')">－</button>
      
      <input class="attr-val" value="${esc(a.val || 0)}" placeholder="值" style="width:60px;text-align:center;font-weight:bold;"
        title="${esc(a.name)}（滚轮增减）"
        onwheel="window.onWheelAdj(event, '${type}', '${entityId}', '${a.id}')"
        oninput="${updateFnName}('${entityId}', ${idx}, 'val', this.value)">
        
      <button onclick="window.onWheelAdj({isUp:true}, '${type}', '${entityId}', '${a.id}')">＋</button>
      
      <label style="font-size:12px;display:flex;align-items:center;gap:4px;color:var(--mute);cursor:pointer;margin-left:8px;">
        <input type="checkbox" ${a.show !== false ? 'checked' : ''}
          onchange="${updateFnName}('${entityId}', ${idx}, 'show', this.checked)"> 侧栏显示
      </label>
      
      <button class="danger attr-del-btn" style="margin-left:auto" onclick="${delFnName}('${entityId}', ${idx})">✕</button>
    </div>
  `).join('');
}