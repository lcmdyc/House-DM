// js/data.js — 数据结构、存储、迁移、全局辅助函数

const KEY = 'trpg_module_v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c =>
  ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

const DEFAULT_DATA = null;

const PALETTE = [
  '#e0605e','#e8a13a','#e6d24a','#8bc34a',
  '#4cc9a0','#4aa8d8','#6c7be0','#b27cd8',
  '#e37bb6','#9b8b7a','#ff8a5c','#7fd0e0'
];

const INFO_FIELDS = [
  ['name','姓名'],['gender','性别'],['age','年龄'],
  ['job','职业'],['religion','宗教'],['zodiac','星座']
];

const SIDES = [['N','北',0,-1],['E','东',1,0],['S','南',0,1],['W','西',-1,0]];
const OPP = { N:'S', S:'N', E:'W', W:'E' };
const sideOf = (dx, dy) => SIDES.find(s => s[2]===dx && s[3]===dy)[0];
const DOOR_T = { door:'双向门', open:'敞开通道', lock:'锁住的门', out:'单向门·只能出', in:'单向门·只能进' };
const DOOR_S = { door:'门', open:'通道', lock:'锁门', out:'单向出', in:'单向进' };
const ARW = { out:{N:'↑',E:'→',S:'↓',W:'←'}, in:{N:'↓',E:'←',S:'↑',W:'→'} };
const doorSym = (t, s) => t==='door'?'门':t==='open'?'通':t==='lock'?'锁':ARW[t][s];

const newEntity = () => ({
  id: uid(), name:'新实体/遭遇', category:'npc', disposition:'中立',
  desc:'', attrs:[{name:'HP',val:'10'},{name:'AC/护甲',val:'10'}],
  actions:[{trigger:'遭遇/搭话时',effect:'提供线索或发起攻击'}], dmNote:''
});

// ── 车卡默认结构（infoFields 替代旧 info 里的非 name 字段）──
const blankCard = () => ({
  info: { name: '' },
  infoFields: [
    { key: '性别', val: '' },
    { key: '年龄', val: '' },
    { key: '职业', val: '' },
    { key: '宗教', val: '' },
    { key: '星座', val: '' }
  ],
  vals: {}, items: '', other: ''
});

const blankBg = (i=0) => ({
  identity:'', skills:[], goals:[], customFields:[], card:blankCard(),
  color: PALETTE[i % PALETTE.length], roomId:'', dead:false, dmNote:''
});

// ── 日程 ──────────────────────────────────────────────────────
const newEvent = () => ({ id:uid(), text:'', type:'normal', done:false, detail:'' });
const newDay   = (idx=0) => ({ id:uid(), title:`Day ${idx+1}`, ended:false, events:[] });

const defaultCfg = () => ({
  points: 40,
  attrs: ['力量','技巧','敏捷','勇气','观察','理智','口才'].map(n => ({id:uid(),name:n,show:true}))
});

function blankRoom(x, y, name) {
  return { id:uid(), x, y, name:name||'新房间', desc:'', dm:'', poolNote:'', items:[], doors:{}, entities:[] };
}

function blankData() {
  return {
    title:'我的原创模组',
    players: Array.from({length:7},(_,i)=>'玩家'+(i+1)),
    rooms:[], pool:[],
    cardCfg: defaultCfg(),
    bg: Array.from({length:7},(_,i)=>blankBg(i)),
    days:[newDay(0)], curDay:0,
    ui:{strip:true,showChar:true}, log:[]
  };
}

function fixItem(i) {
  if (!Array.isArray(i.owners))
    i.owners = (i.owner!==undefined && i.owner!=='') ? [+i.owner] : [];
  delete i.owner; delete i.obtained;
}

function migrate(d) {
  if (!Array.isArray(d.players)||!d.players.length) d.players = blankData().players;
  if (!Array.isArray(d.pool))  d.pool  = [];
  if (!Array.isArray(d.bg))    d.bg    = [];
  if (!Array.isArray(d.log))   d.log   = [];
  if (!d.cardCfg||!Array.isArray(d.cardCfg.attrs)) d.cardCfg = defaultCfg();
  if (typeof d.cardCfg.points!=='number') d.cardCfg.points = 40;
  d.cardCfg.attrs.forEach(a => { if (typeof a.show!=='boolean') a.show=true; });
  d.ui = Object.assign({strip:true,showChar:true}, d.ui||{});

  // ── days 迁移 ────────────────────────────────────────────
  if (!Array.isArray(d.days)||!d.days.length) d.days = [newDay(0)];
  d.days.forEach((x, idx) => {
    if (!x.id)   x.id    = uid();
    if (typeof x.title!=='string'||!x.title.trim()) x.title = `Day ${idx+1}`;
    if (typeof x.ended !== 'boolean') x.ended = false;
    if (!Array.isArray(x.events)) x.events = [];
    x.events.forEach(ev => {
      if (!ev.id)                    ev.id     = uid();
      if (!ev.type)                  ev.type   = 'normal';
      if (ev.done === undefined)     ev.done   = false;
      if (ev.detail === undefined)   ev.detail = '';
    });
  });
  if (!(d.curDay >= 0 && d.curDay < d.days.length)) d.curDay = 0;

  // ── rooms 迁移 ───────────────────────────────────────────
  d.rooms.forEach(r => {
    if (!r.doors||typeof r.doors!=='object') {
      r.doors={};
      SIDES.forEach(([s,,dx,dy]) => {
        if (d.rooms.some(o=>o.x===r.x+dx&&o.y===r.y+dy)) r.doors[s]={t:'door',note:''};
      });
    }
    if (!Array.isArray(r.entities)) r.entities=[];
    r.entities.forEach(en => {
      if (!Array.isArray(en.attrs))   en.attrs   = [];
      if (!Array.isArray(en.actions)) en.actions = [];
      if (!en.category)    en.category    = 'npc';
      if (!en.disposition) en.disposition = '中立';
    });
  });

  // ── bg 迁移 ──────────────────────────────────────────────
  d.players.forEach((_,i) => {
    const b = d.bg[i] || (d.bg[i] = blankBg(i));
    if (!Array.isArray(b.skills))       b.skills       = [];
    if (!Array.isArray(b.goals))        b.goals        = [];
    if (!Array.isArray(b.customFields)) b.customFields = [];
    if (typeof b.identity !== 'string') b.identity     = '';
    if (typeof b.dead !== 'boolean')    b.dead         = false;
    if (typeof b.color!=='string'||!b.color) b.color   = PALETTE[i%PALETTE.length];
    if (!d.rooms.some(r=>r.id===b.roomId))   b.roomId  = '';
    if (!b.card) b.card = blankCard();

    // ── card.infoFields 迁移（从旧 card.info 的非 name 字段迁入）
    if (!Array.isArray(b.card.infoFields)) {
      const old = b.card.info || {};
      b.card.infoFields = [
        { key: '性别', val: old.gender   || '' },
        { key: '年龄', val: old.age      || '' },
        { key: '职业', val: old.job      || '' },
        { key: '宗教', val: old.religion || '' },
        { key: '星座', val: old.zodiac   || '' },
      ];
    }
    // card.info 只保留 name
    b.card.info = { name: (b.card.info && b.card.info.name) || '' };

    if (!b.card.vals||typeof b.card.vals!=='object') b.card.vals = {};
    if (typeof b.dmNote !== 'string') b.dmNote = '';
  });

  d.bg.length = d.players.length;

  // ── items 迁移 ───────────────────────────────────────────
  const n = d.players.length;
  const fixAll = i => { fixItem(i); i.owners = i.owners.filter(o=>o>=0&&o<n); };
  d.rooms.forEach(r => r.items.forEach(fixAll));
  d.pool.forEach(fixAll);

  return d;
}

function loadLocalData() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return migrate(JSON.parse(s));
  } catch(e) {}
  return migrate(DEFAULT_DATA ? JSON.parse(JSON.stringify(DEFAULT_DATA)) : blankData());
}

function saveData(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
  if (typeof broadcastP2P === 'function') broadcastP2P(d);
}

let D = loadLocalData();

// ── 全局辅助查询函数 ──────────────────────────────────────────
const room      = id  => D.rooms.find(r => r.id===id);
const at        = (x,y) => D.rooms.find(r => r.x===x && r.y===y);
const isGot     = i  => i.owners.length>0 || i.consumed;
const rname     = id => id ? ((room(id)||{}).name||'未命名') : '未定位';
const pcolor    = i  => (D.bg[i]&&D.bg[i].color)||'#888';
const pname     = i  => D.players[i]||('玩家'+(i+1));
const cardUsed  = c  => D.cardCfg.attrs.reduce((s,a)=>s+(+c.vals[a.id]||0),0);
const playersIn = rid => D.players.map((_,i)=>i).filter(i=>D.bg[i].roomId===rid);
const dayLabel  = i  => (D.days[i]&&D.days[i].title) ? D.days[i].title : `Day ${i+1}`;