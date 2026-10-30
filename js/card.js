// js/card.js — 通用对象卡片模块 (供玩家和NPC列表共用)
import { D, esc } from './data.js';
import { save } from './core.js';

// ════════════════════════════════════════════════════════════
// 全局拖拽排序逻辑
// ════════════════════════════════════════════════════════════
window.onCardDragStart = function(e, type, id) {
  e.dataTransfer.setData('text/plain', JSON.stringify({ type, id }));
  e.target.style.opacity = '0.5';
};

window.onCardDragEnd = function(e) {
  e.target.style.opacity = '1';
};

window.onCardDrop = function(e, targetType, targetId) {
  e.preventDefault();
  try {
    const data = JSON.parse(e.dataTransfer.getData('text/plain'));
    if (data.type !== targetType) return; 
    
    if (targetType === 'player') {
      const fromIdx = parseInt(data.id, 10);
      const toIdx = parseInt(targetId, 10);
      if (fromIdx === toIdx) return;
      
      const p = D.players.splice(fromIdx, 1)[0];
      const b = D.bg.splice(fromIdx, 1)[0];
      D.players.splice(toIdx, 0, p);
      D.bg.splice(toIdx, 0, b);
    } else if (targetType === 'npc') {
      const fromIdx = D.npcs.findIndex(n => n.id === data.id);
      const toIdx = D.npcs.findIndex(n => n.id === targetId);
      if (fromIdx < 0 || toIdx < 0 || fromIdx === toIdx) return;
      
      const n = D.npcs.splice(fromIdx, 1)[0];
      D.npcs.splice(toIdx, 0, n);
    }
    
    save();
    window.dispatchEvent(new Event('trpg-ui-update')); 
  } catch(err) { console.error('拖拽排序失败:', err); }
};

// ════════════════════════════════════════════════════════════
// 紧凑型卡片渲染 (自适应浅色/深色模式)
// ════════════════════════════════════════════════════════════
export function renderEntityCard({
  id, dragType, name, color, badge, disposition, roomId, isDead, isSelected, rooms,
  onSelect, onRoomChange, onDuplicate, onDelete, onToggleDead
}) {
  const roomOpts = `<option value="">📍 未定位</option>` + 
    rooms.map(r => `<option value="${r.id}" ${r.id === roomId ? 'selected' : ''}>${esc(r.name)}</option>`).join('');

  return `
    <div class="npc-card ${isSelected ? 'sel' : ''} ${isDead ? 'dead' : ''}"
         draggable="true"
         ondragstart="window.onCardDragStart(event, '${dragType}', '${id}')"
         ondragend="window.onCardDragEnd(event)"
         ondragover="event.preventDefault()"
         ondrop="window.onCardDrop(event, '${dragType}', '${id}')"
         style="border-left: 4px solid ${color || '#888'}; padding: 6px 8px; margin-bottom: 6px; display: flex; flex-direction: column; gap: 6px; cursor: pointer;"
         onclick="${onSelect}">
      
      <!-- 第一行：名称、立场、徽章 -->
      <div style="display: flex; align-items: center; justify-content: space-between; gap: 4px;">
        <div style="font-weight: bold; font-size: 13px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; color: var(--fg);" title="${esc(name)}">
          ${esc(name)} ${isDead ? '💀' : ''}
        </div>
        <div style="display: flex; gap: 4px; align-items: center; flex-shrink: 0;">
          ${disposition ? `<span style="font-size: 11px; color: var(--mute);">${esc(disposition)}</span>` : ''}
          <span style="background:${color}22; color:${color}; padding: 1px 4px; border-radius: 3px; font-size: 11px;">${esc(badge)}</span>
        </div>
      </div>
      
      <!-- 第二行：位置下拉、死亡、复制、删除 -->
      <div style="display: flex; align-items: center; gap: 4px;">
        <select style="flex: 1; width: 0; font-size: 11px; padding: 2px; background: var(--bg); border: 1px solid var(--border); color: var(--fg); border-radius: 3px; cursor: pointer;" 
                onclick="event.stopPropagation()" 
                onchange="${onRoomChange}">
          ${roomOpts}
        </select>
        <button style="padding: 2px 6px; font-size: 11px; background: ${isDead ? '#3a1c1c' : 'var(--bg)'}; border: 1px solid ${isDead ? '#5a2a2a' : 'var(--border)'}; border-radius: 3px; color: ${isDead ? '#ff6b6b' : 'var(--fg)'}; cursor: pointer;" 
                title="${isDead ? '取消死亡' : '标记死亡'}" onclick="event.stopPropagation(); ${onToggleDead}">💀</button>
        <button style="padding: 2px 6px; font-size: 11px; background: var(--bg); border: 1px solid var(--border); border-radius: 3px; color: var(--fg); cursor: pointer;" 
                title="复制" onclick="event.stopPropagation(); ${onDuplicate}">⧉</button>
        <button class="danger" style="padding: 2px 6px; font-size: 11px; border-radius: 3px; cursor: pointer;" 
                title="删除" onclick="event.stopPropagation(); ${onDelete}">✕</button>
      </div>
    </div>
  `;
}