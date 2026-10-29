// js/data.js

const KEY = 'trpg_module_v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

// 如需发布带有预置内容的固定模组，将导出后的 JSON 赋给 DEFAULT_DATA 即可
const DEFAULT_DATA = null;

const PALETTE = [
  '#e0605e', '#e8a13a', '#e6d24a', '#8bc34a',
  '#4cc9a0', '#4aa8d8', '#6c7be0', '#b27cd8',
  '#e37bb6', '#9b8b7a', '#ff8a5c', '#7fd0e0'
];

const INFO_FIELDS = [
  ['name', '姓名'], ['gender', '性别'], ['age', '年龄'],
  ['job', '职业'], ['religion', '宗教'], ['zodiac', '星座']
];

// 门的方向：N/E/S/W
const SIDES = [['N', '北', 0, -1], ['E', '东', 1, 0], ['S', '南', 0, 1], ['W', '西', -1, 0]];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const sideOf = (dx, dy) => SIDES.find(s => s[2] === dx && s[3] === dy)[0];
const DOOR_T = { door: '双向门', open: '敞开通道', lock: '锁住的门', out: '单向门 · 只能出', in: '单向门 · 只能进' };
const DOOR_S = { door: '门', open: '通道', lock: '锁门', out: '单向出', in: '单向进' };
const ARW = { out: { N: '↑', E: '→', S: '↓', W: '←' }, in: { N: '↓', E: '←', S: '↑', W: '→' } };
const doorSym = (t, s) => t === 'door' ? '门' : t === 'open' ? '通' : t === 'lock' ? '锁' : ARW[t][s];

// 实体/遭遇模板
const newEntity = () => ({
  id: uid(),
  name: '新实体/遭遇',
  category: 'npc', // npc, monster, trap, object
  disposition: '中立', // 友善, 中立, 敌对, 警惕, 隐藏
  desc: '',
  attrs: [{ name: 'HP', val: '10' }, { name: 'AC/护甲', val: '10' }],
  actions: [{ trigger: '遭遇/搭话时', effect: '提供线索或发起攻击' }],
  dmNote: ''
});

const blankCard = () => ({ info: { name: '', gender: '', age: '', job: '', religion: '', zodiac: '' }, vals: {}, items: '', other: '' });
const blankBg = (i = 0) => ({ identity: '', skills: [], goals: [], card: blankCard(), color: PALETTE[i % PALETTE.length], roomId: '' });
const newDay = () => ({ id: uid(), ended: false, events: [] });
const defaultCfg = () => ({ points: 40, attrs: ['力量', '技巧', '敏捷', '勇气', '观察', '理智', '口才'].map(n => ({ id: uid(), name: n, show: true })) });

function blankRoom(x, y, name) {
  return { id: uid(), x, y, name: name || '新房间', desc: '', dm: '', poolNote: '', items: [], doors: {}, entities: [] };
}

function blankData() {
  return {
    title: '我的原创模组',
    players: Array.from({ length: 7 }, (_, i) => '玩家' + (i + 1)),
    rooms: [],
    pool: [],
    cardCfg: defaultCfg(),
    bg: Array.from({ length: 7 }, (_, i) => blankBg(i)),
    days: [newDay()],
    curDay: 0,
    ui: { strip: true, showChar: true },
    log: []
  };
}

function fixItem(i) {
  if (!Array.isArray(i.owners)) {
    i.owners = (i.owner !== undefined && i.owner !== '') ? [+i.owner] : [];
  }
  delete i.owner;
  delete i.obtained;
}

function migrate(d) {
  if (!Array.isArray(d.players) || !d.players.length) d.players = blankData().players;
  if (!Array.isArray(d.pool)) d.pool = [];
  if (!Array.isArray(d.bg)) d.bg = [];
  if (!Array.isArray(d.log)) d.log = [];
  if (!d.cardCfg || !Array.isArray(d.cardCfg.attrs)) d.cardCfg = defaultCfg();
  if (typeof d.cardCfg.points !== 'number') d.cardCfg.points = 40;
  d.cardCfg.attrs.forEach(a => { if (typeof a.show !== 'boolean') a.show = true; });
  d.ui = Object.assign({ strip: true, showChar: true }, d.ui || {});
  if (!Array.isArray(d.days) || !d.days.length) d.days = [newDay()];
  d.days.forEach(x => { if (!Array.isArray(x.events)) x.events = []; if (!x.id) x.id = uid(); });
  if (!(d.curDay >= 0 && d.curDay < d.days.length)) d.curDay = 0;

  d.rooms.forEach(r => {
    if (!r.doors || typeof r.doors !== 'object') {
      r.doors = {};
      SIDES.forEach(([s, , dx, dy]) => {
        if (d.rooms.some(o => o.x === r.x + dx && o.y === r.y + dy)) r.doors[s] = { t: 'door', note: '' };
      });
    }
    if (!Array.isArray(r.entities)) r.entities = [];
    r.entities.forEach(en => {
      if (!Array.isArray(en.attrs)) en.attrs = [];
      if (!Array.isArray(en.actions)) en.actions = [];
      if (!en.category) en.category = 'npc';
      if (!en.disposition) en.disposition = '中立';
    });
  });

  d.players.forEach((_, i) => {
    const b = d.bg[i] || (d.bg[i] = blankBg(i));
    if (!Array.isArray(b.skills)) b.skills = [];
    if (!Array.isArray(b.goals)) b.goals = [];
    if (typeof b.identity !== 'string') b.identity = '';
    if (typeof b.color !== 'string' || !b.color) b.color = PALETTE[i % PALETTE.length];
    if (!d.rooms.some(r => r.id === b.roomId)) b.roomId = '';
    if (!b.card) b.card = blankCard();
    const c = b.card;
    c.info = Object.assign(blankCard().info, c.info || {});
    if (!c.vals || typeof c.vals !== 'object') c.vals = {};
  });

  d.bg.length = d.players.length;
  const n = d.players.length;
  const fixAll = i => { fixItem(i); i.owners = i.owners.filter(o => o >= 0 && o < n); };
  d.rooms.forEach(r => r.items.forEach(fixAll));
  d.pool.forEach(fixAll);
  return d;
}

function loadData() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return migrate(JSON.parse(s));
  } catch (e) {}
  return migrate(DEFAULT_DATA ? JSON.parse(JSON.stringify(DEFAULT_DATA)) : blankData());
}

function saveData(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
}
