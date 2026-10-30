// js/app.js — 模块入口与全局绑定

import * as data from './data.js';
import * as core from './core.js';
import * as theme from './theme.js';
import * as p2p from './p2p.js';
import * as map from './map.js';
import * as side from './side.js';
import * as npc from './npc.js';
import * as players from './players.js';
import * as schedule from './schedule.js';
import * as pool from './pool.js';
import * as relation from './relation.js';
import * as handbook from './handbook.js';
import * as wheel from './wheel.js'; // 👈 核心修复：补上漏掉的滚轮模块！

// 将 wheel 也加入模块集合
const allModules = { data, core, theme, p2p, map, side, npc, players, schedule, pool, relation, handbook, wheel };

// 1. 将所有模块导出的数据和函数批量挂载到全局 window
Object.values(allModules).forEach(mod => {
  Object.assign(window, mod);
});

window.addEventListener('DOMContentLoaded', () => {
  console.log("🚀 DM 工具模块加载完毕，开始初始化界面与事件...");

  // 2. 自动扫描并执行所有模块中的“初始化”和“事件绑定”函数
  Object.values(allModules).forEach(mod => {
    Object.keys(mod).forEach(fnName => {
      if (typeof mod[fnName] === 'function' && 
         (fnName.startsWith('init') || fnName.startsWith('bind') || fnName.startsWith('setup'))) {
        try {
          mod[fnName]();
          console.log(`✅ 成功绑定事件/初始化: ${fnName}`);
        } catch(e) {
          console.warn(`⚠️ 执行 ${fnName} 时出现小问题:`, e);
        }
      }
    });
  });

  // 3. 初始渲染界面
  if (typeof window.loadData === 'function') window.loadData();
  if (typeof window.init === 'function') window.init();
  if (typeof window.renderMap === 'function') window.renderMap();
  if (typeof window.renderSide === 'function') window.renderSide();
  if (typeof window.renderStrip === 'function') window.renderStrip();
  if (typeof window.renderNpcStrip === 'function') window.renderNpcStrip();
  if (typeof window.renderDays === 'function') window.renderDays();
  if (typeof window.renderPool === 'function') window.renderPool();

  window.dispatchEvent(new CustomEvent('trpg-data-loaded'));
  window.dispatchEvent(new CustomEvent('trpg-ui-update'));

  // 4. 地图拖拽原生兜底
  const mapWrap = document.getElementById('mapWrap');
  if (mapWrap) {
    let isDraggingMap = false;
    let startX, startY, scrollLeft, scrollTop;

    mapWrap.addEventListener('mousedown', (e) => {
      if (e.target.closest('.room') || e.target.closest('.dr') || e.target.closest('.add') || e.target.closest('button')) return;
      isDraggingMap = true;
      mapWrap.classList.add('dragging');
      startX = e.pageX - mapWrap.offsetLeft;
      startY = e.pageY - mapWrap.offsetTop;
      scrollLeft = mapWrap.scrollLeft;
      scrollTop = mapWrap.scrollTop;
    });

    window.addEventListener('mouseup', () => {
      isDraggingMap = false;
      mapWrap.classList.remove('dragging');
    });

    window.addEventListener('mousemove', (e) => {
      if (!isDraggingMap) return;
      e.preventDefault();
      const x = e.pageX - mapWrap.offsetLeft;
      const y = e.pageY - mapWrap.offsetTop;
      mapWrap.scrollLeft = scrollLeft - (x - startX);
      mapWrap.scrollTop = scrollTop - (y - startY);
    });
  }
});