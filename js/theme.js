// js/theme.js — 主题切换 (ES6 Module)
import { toast } from './core.js';

export const THEMES = {
  dark: {
    '--bg': '#14161b', '--panel': '#1c1f26', '--card': '#232732',
    '--card-hover': '#2a2f3d', '--line': '#2e3444', '--text': '#e1e4ea',
    '--mute': '#8b92a4', '--accent': '#d8893a', '--accent-rgb': '216,137,58',
    '--danger': '#d9534f', '--item': '#4aa8d8', '--clue': '#e8a13a',
    '--npc': '#b27cd8', '--door': '#c8955a', '--open': '#4cc9a0',
    '--lock': '#e0605e', '--out': '#9b8b7a', '--in': '#6c7be0',
    '--map-grid': 'rgba(255,255,255,0.03)'
  },
  light: {
    '--bg': '#f2f4f7', '--panel': '#ffffff', '--card': '#e4e7ee',
    '--card-hover': '#d8dce6', '--line': '#b8c0cc', '--text': '#1a1e26',
    '--mute': '#545c6e', '--accent': '#bd6717', '--accent-rgb': '189,103,23',
    '--danger': '#c73430', '--item': '#1b73a3', '--clue': '#b36b10',
    '--npc': '#8342af', '--door': '#925f29', '--open': '#1e8a65',
    '--lock': '#b33230', '--out': '#6f6254', '--in': '#3e4da9',
    '--map-grid': 'rgba(0,0,0,0.07)'
  }
};

export function applyTheme(t) {
  t = (t === 'light') ? 'light' : 'dark';
  const root = document.documentElement;
  
  // 行内 style 优先级最高，直接覆盖任何 CSS 文件
  Object.entries(THEMES[t]).forEach(([k, v]) => root.style.setProperty(k, v));
  root.setAttribute('data-theme', t);
  
  try { localStorage.setItem('trpg_theme', t); } catch(_) {}
  
  const btn = document.getElementById('themeBtn');
  if (btn) btn.textContent = t === 'light' ? '☀️ 浅色' : '🌙 深色';
}

export function toggleTheme() {
  const cur = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = cur === 'light' ? 'dark' : 'light';
  applyTheme(next);
  toast(`已切换为 ${next === 'light' ? '☀️ 浅色' : '🌙 深色'} 配色`);
}

// ════════════════════════════════════════════════════════════
// 初始化与挂载
// ════════════════════════════════════════════════════════════
let stored = 'dark';
try { 
  const v = localStorage.getItem('trpg_theme'); 
  if (v === 'light' || v === 'dark') stored = v; 
} catch(_) {}

applyTheme(stored);

// 绑定按钮，只绑一次 (type="module" 脚本执行时 DOM 已就绪)
const themeBtn = document.getElementById('themeBtn');
if (themeBtn) themeBtn.addEventListener('click', toggleTheme);

// 挂载到 window 以防 HTML 中有内联调用
window.toggleTheme = toggleTheme;