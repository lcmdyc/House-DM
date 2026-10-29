// js/p2p.js — WebRTC/PeerJS 多人联机引擎

let peer = null;
let p2pConnections = [];
let targetHostId = new URLSearchParams(window.location.search).get('peer') || null;
let myPeerId = null;
const isHost = !targetHostId;

function updateP2PBtn() {
  const btn = document.getElementById('p2pBtn');
  if (!btn) return;
  if (p2pConnections.length > 0) {
    btn.textContent = `🟢 联机中 (${p2pConnections.length + 1}人)`;
    btn.style.color = 'var(--open)';
  } else if (targetHostId && !myPeerId) {
    btn.textContent = '🔄 连接中...';
    btn.style.color = 'var(--accent)';
  } else if (myPeerId) {
    btn.textContent = '📋 复制邀请链接';
    btn.style.color = 'var(--accent)';
  } else {
    btn.textContent = '🔗 启动多人协作';
    btn.style.color = '';
  }
}

function initP2PSync() {
  if (!window.Peer) {
    console.warn('PeerJS 未加载，联机功能不可用');
    return;
  }
  peer = new Peer();

  peer.on('open', id => {
    myPeerId = id;
    updateP2PBtn();
    if (targetHostId) {
      if (typeof toast === 'function') toast('正在连入房主房间...');
      const conn = peer.connect(targetHostId, { reliable: true });
      setupP2PConn(conn);
    } else {
      if (typeof toast === 'function') toast('📡 联机就绪，点击按钮复制邀请链接');
    }
  });

  peer.on('connection', conn => setupP2PConn(conn));

  peer.on('error', err => {
    console.error('PeerJS 错误:', err);
    if (typeof toast === 'function') toast('联机异常: ' + (err.type || '连接中断'));
  });
}

function setupP2PConn(conn) {
  conn.on('open', () => {
    p2pConnections.push(conn);
    updateP2PBtn();
    if (typeof toast === 'function')
      toast(`🎉 新成员加入！当前共 ${p2pConnections.length + 1} 人`);
    if (isHost) conn.send({ type: 'FULL_SYNC', data: D });
  });

  conn.on('data', msg => {
    if (!msg || typeof msg !== 'object') return;
    if (msg.type === 'FULL_SYNC' || msg.type === 'DIFF_SYNC') {
      D = migrate(msg.data);
      localStorage.setItem(KEY, JSON.stringify(D));
      if (typeof toast === 'function') toast('⚡ 收到实时同步');
      if (typeof renderAllViews === 'function') renderAllViews();
      // 房主中继转发
      if (isHost) {
        p2pConnections.forEach(c => {
          if (c !== conn && c.open) c.send({ type: 'DIFF_SYNC', data: D });
        });
      }
    }
  });

  conn.on('close', () => {
    p2pConnections = p2pConnections.filter(c => c !== conn);
    updateP2PBtn();
    if (typeof toast === 'function')
      toast(`有成员退出 (剩余 ${p2pConnections.length + 1} 人)`);
  });
}

function broadcastP2P(data) {
  p2pConnections.forEach(conn => {
    if (conn.open) conn.send({ type: 'DIFF_SYNC', data });
  });
}

function handleP2PAction() {
  if (!myPeerId) {
    if (typeof toast === 'function') toast('联机初始化中，请稍等...');
    return;
  }
  const hostId = isHost ? myPeerId : targetHostId;
  const u = new URL(window.location.href);
  u.searchParams.set('peer', hostId);
  const link = u.toString();

  // 优先用 clipboard API，降级用 prompt
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(link).then(() => {
      if (typeof toast === 'function') toast('📋 邀请链接已复制！发给其他 DM 即可加入');
    }).catch(() => prompt('请手动复制邀请链接：', link));
  } else {
    prompt('请手动复制邀请链接：', link);
  }
}

// 绑定按钮（在 theme.js 之后、app.js 之前加载）
(function () {
  const btn = document.getElementById('p2pBtn');
  if (btn) btn.addEventListener('click', handleP2PAction);
})();
