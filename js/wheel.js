// js/wheel.js — 滚轮增减数值 通用模块
// 无外部依赖，需在 players.js / npc.js 之前加载

/**
 * 通用滚轮事件处理入口
 * 在 HTML 的 onwheel 属性中调用：
 *   onwheel="onWheelAdj(event, 'player', i, aid)"
 *   onwheel="onWheelAdj(event, 'npc', npcId, attrId)"
 *   onwheel="onWheelAdj(event, 'preset', i, attrId)"
 */
function onWheelAdj(e, type, idOrIdx, attrId) {
  e.preventDefault();
  e.stopPropagation();
  const delta = e.deltaY < 0 ? 1 : -1;
  if (type === 'player') adjPlayerAttr(idOrIdx, attrId, delta);
  if (type === 'npc')    adjNpcAttr(idOrIdx, attrId, delta);
  if (type === 'preset') adjPresetAttr(+idOrIdx, attrId, delta);
}

// ── 玩家属性增减 ──────────────────────────────────────────
function adjPlayerAttr(playerIdx, attrId, delta) {
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
  save();
  renderStrip();
  // 若背景详情面板开着，同步刷新
  const libBg = document.getElementById('libPageBg');
  if (libBg && libBg.offsetParent !== null) renderBg();
}

// ── NPC 属性增减 ──────────────────────────────────────────
function adjNpcAttr(npcId, attrId, delta) {
  const n = D.npcs.find(x => x.id === npcId); if (!n) return;
  const a = n.attrs.find(x => x.id === attrId); if (!a) return;
  const cur  = +a.val || 0;
  const next = Math.max(0, cur + delta);
  addLog('attr',
    `[NPC]${n.name} · ${a.name}：${cur} → ${next}`,
    n.color || '#b27cd8'
  );
  a.val = String(next);
  saveData(D);
  renderNpcStrip();
  // 若 NPC 详情面板开着，同步刷新
  if (typeof selNpcId !== 'undefined' && selNpcId === npcId) renderNpcDetail();
}

// ── 预设特殊属性增减 ──────────────────────────────────────
function adjPresetAttr(playerIdx, attrId, delta) {
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
  save();
  // 若背景详情面板开着，同步刷新
  const libBg = document.getElementById('libPageBg');
  if (libBg && libBg.offsetParent !== null) renderBg();
}