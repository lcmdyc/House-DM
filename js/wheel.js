// js/wheel.js — 滚轮增减数值 通用模块 (ES6 Module)
import { D, pname, pcolor } from './data.js';
import { save, toast, addLog } from './core.js';

// ════════════════════════════════════════════════════════════
// 1. 通用滚轮事件处理入口
// ════════════════════════════════════════════════════════════
export function onWheelAdj(e, type, idOrIdx, attrId) {
  e.preventDefault();
  e.stopPropagation();
  const delta = e.deltaY < 0 ? 1 : -1;
  if (type === 'player') adjPlayerAttr(idOrIdx, attrId, delta);
  if (type === 'npc')    adjNpcAttr(idOrIdx, attrId, delta);
  if (type === 'preset') adjPresetAttr(+idOrIdx, attrId, delta);
}

// ════════════════════════════════════════════════════════════
// 2. 玩家属性增减
// ════════════════════════════════════════════════════════════
export function adjPlayerAttr(playerIdx, attrId, delta) {
  const c   = D.bg[playerIdx].card;
  const cur = +c.vals[attrId] || 0;
  const next = Math.max(0, cur + delta);
  
  // 点数上限检查
  const used = Object.values(c.vals).reduce((s, v) => s + (+v || 0), 0) - cur + next;
  if (used > D.cardCfg.points) { toast('点数不足'); return; }
  
  c.vals[attrId] = next;
  const a = D.cardCfg.attrs.find(x => x.id === attrId);
  
  addLog('attr',
    `${pname(playerIdx)} · ${a ? a.name : attrId}：${cur} → ${next}`,
    pcolor(playerIdx)
  );
  
  save(); // 自动触发 renderStrip 和 renderBg (若面板打开)
}

// ════════════════════════════════════════════════════════════
// 3. NPC 属性增减
// ════════════════════════════════════════════════════════════
export function adjNpcAttr(npcId, attrId, delta) {
  const n = D.npcs.find(x => x.id === npcId); if (!n) return;
  const a = n.attrs.find(x => x.id === attrId); if (!a) return;
  
  const cur  = +a.val || 0;
  const next = Math.max(0, cur + delta);
  
  addLog('attr',
    `[NPC]${n.name} · ${a.name}：${cur} → ${next}`,
    n.color || '#b27cd8'
  );
  
  a.val = String(next);
  save(); // 自动触发 renderNpcStrip 和 renderNpcDetail (若面板打开)
}

// ════════════════════════════════════════════════════════════
// 4. 预设特殊属性增减
// ════════════════════════════════════════════════════════════
export function adjPresetAttr(playerIdx, attrId, delta) {
  const attrs = D.bg[playerIdx].presetAttrs;
  if (!Array.isArray(attrs)) return;
  const a = attrs.find(x => x.id === attrId); if (!a) return;
  
  const cur  = +a.val || 0;
  const next = Math.max(0, cur + delta);
  a.val = next;
  
  addLog('attr',
    `${pname(playerIdx)} · ${a.name}：${cur} → ${next}`,
    pcolor(playerIdx)
  );
  
  save(); // 自动触发 renderBg (若面板打开)
}

// ════════════════════════════════════════════════════════════
// 5. 挂载全局方法
// ════════════════════════════════════════════════════════════
Object.assign(window, {
  onWheelAdj, adjPlayerAttr, adjNpcAttr, adjPresetAttr
});