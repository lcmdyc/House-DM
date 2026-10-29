// js/data.js

const KEY = 'trpg_module_v1';
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));

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

const SIDES = [['N', '北', 0, -1], ['E', '东', 1, 0], ['S', '南', 0, 1], ['W', '西', -1, 0]];
const OPP = { N: 'S', S: 'N', E: 'W', W: 'E' };
const sideOf = (dx, dy) => SIDES.find(s => s[2] === dx && s[3] === dy)[0];
const DOOR_T = { door: '双向门', open: '敞开通道', lock: '锁住的门', out: '单向门 · 只能出', in: '单向门 · 只能进' };
const DOOR_S = { door: '门', open: '通道', lock: '锁门', out: '单向出', in: '单向进' };
const ARW = { out: { N: '↑', E: '→', S: '↓', W: '←' }, in: { N: '↓', E: '←', S: '↑', W: '→' } };
const doorSym = (t, s) => t === 'door' ? '门' : t === 'open' ? '通' : t === 'lock' ? '锁' : ARW[t][s];

const newEntity = () => ({
  id: uid(),
  name: '新实体/遭遇',
  category: 'npc',
  disposition: '中立',
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

function loadLocalData() {
  try {
    const s = localStorage.getItem(KEY);
    if (s) return migrate(JSON.parse(s));
  } catch (e) {}
  return migrate(DEFAULT_DATA ? JSON.parse(JSON.stringify(DEFAULT_DATA)) : blankData());
}

// ══════════════【WebRTC / PeerJS 多人中继广播联机引擎】══════════════
let peer = null;
let p2pConnections = [];
let targetHostId = new URLSearchParams(window.location.search).get('peer') || null;
let myPeerId = null;
const isHost = !targetHostId; // URL里没带peer参数即为房主

function updateP2PBtn() {
  const btn = document.getElementById('p2pBtn');
  if (!btn) return;
  
  if (p2pConnections.length > 0) {
    const totalCount = p2pConnections.length + 1; // 加上自己
    btn.textContent = `🟢 联机中 (${totalCount}人在线)`;
    btn.style.borderColor = 'var(--item)';
  } else if (targetHostId) {
    btn.textContent = '🔄 正在连接房主...';
    btn.style.borderColor = 'var(--accent)';
  } else if (myPeerId) {
    btn.textContent = '📋 邀请多人协作';
    btn.style.borderColor = 'var(--accent)';
  } else {
    btn.textContent = '🔗 启动多人协作';
    btn.style.borderColor = 'var(--accent)';
  }
}

function initP2PSync() {
  if (!window.Peer) return;

  peer = new Peer();

  peer.on('open', id => {
    myPeerId = id;
    updateP2PBtn();

    // 协作者模式：连接房主
    if (targetHostId) {
      toast('正在连入房主房间...');
      const conn = peer.connect(targetHostId, { reliable: true });
      setupP2PConn(conn);
    }
  });

  // 房主模式：监听所有加入进来的协作者
  peer.on('connection', conn => {
    setupP2PConn(conn);
  });

  peer.on('error', err => {
    console.error('PeerJS 错误:', err);
    toast('联机状态异常: ' + (err.type || '连接中断'));
  });
}

function setupP2PConn(conn) {
  conn.on('open', () => {
    p2pConnections.push(conn);
    updateP2PBtn();
    toast(`🎉 新成员加入！当前共 ${p2pConnections.length + 1} 人`);

    if (isHost) {
      // 房主将最新模组进度推送给刚进房的人
      conn.send({ type: 'FULL_SYNC', data: D });
    }
  });

  conn.on('data', msg => {
    if (!msg || typeof msg !== 'object') return;

    if (msg.type === 'FULL_SYNC' || msg.type === 'DIFF_SYNC') {
      D = migrate(msg.data);
      localStorage.setItem(KEY, JSON.stringify(D));
      toast('⚡ 收到房间实时同步修改');
      if (typeof renderAllViews === 'function') renderAllViews();

      // ⭐ 核心重点：如果当前自己是房主，把这个改动中继转播给房里的其他所有人！
      if (isHost) {
        p2pConnections.forEach(otherConn => {
          if (otherConn !== conn && otherConn.open) {
            otherConn.send({ type: 'DIFF_SYNC', data: D });
          }
        });
      }
    }
  });

  conn.on('close', () => {
    p2pConnections = p2pConnections.filter(c => c !== conn);
    updateP2PBtn();
    toast(`有成员退出了房间 (剩余 ${p2pConnections.length + 1} 人)`);
  });
}

// 广播给房间内的所有连接端
function broadcastP2P(data) {
  p2pConnections.forEach(conn => {
    if (conn.open) {
      conn.send({ type: 'DIFF_SYNC', data });
    }
  });
}

// 点击顶部邀请按钮
function handleP2PAction() {
  if (!myPeerId) {
    toast('联机网络初始化中，请稍等片刻...');
    return;
  }
  
  // 始终以房主的 ID 作为固定链接
  const hostId = isHost ? myPeerId : targetHostId;
  const u = new URL(window.location.href);
  u.searchParams.set('peer', hostId);
  const shareLink = u.toString();

  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(shareLink).then(() => {
      toast('📋 邀请链接已复制！无论发给多少人，打开都将进入同一进程');
    });
  } else {
    prompt('请复制以下专属房间链接发给大家：', shareLink);
  }
}

function saveData(d) {
  localStorage.setItem(KEY, JSON.stringify(d));
  broadcastP2P(d);
}

// 初始数据加载
let D = loadLocalData();

const room = id => D.rooms.find(r => r.id === id);
const at = (x, y) => D.rooms.find(r => r.x === x && r.y === y);
const isGot = i => i.owners.length > 0 || i.consumed;
const rname = id => id ? ((room(id) || {}).name || '未命名') : '未定位';
const pcolor = i => (D.bg[i] && D.bg[i].color) || '#888';
const pname = i => D.players[i] || ('玩家' + (i + 1));
const cardUsed = c => D.cardCfg.attrs.reduce((s, a) => s + (+c.vals[a.id] || 0), 0);
const playersIn = rid => D.players.map((_, i) => i).filter(i => D.bg[i].roomId === rid);
