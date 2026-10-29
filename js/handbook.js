// js/handbook.js

const HB_CSS = `
@page{size:A4;margin:16mm 15mm}
*{box-sizing:border-box}
body{margin:0;padding:14px;color:#1d1d1d;background:#fff;font:13px/1.65 "Songti SC","Noto Serif SC","Source Han Serif SC","SimSun","STSong",serif}
h1,h2,h3,h4{font-family:"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif;margin:0}
.pg,.rm,.player,.hp,.hpb{break-before:page;page-break-before:always}
.ch{break-before:page;page-break-before:always}
.f{break-before:auto!important;page-break-before:auto!important}
.cover{height:240mm;display:flex;flex-direction:column;justify-content:center;align-items:center;text-align:center;border:3px double #333;padding:20mm}
.cover h1{font-size:40px;letter-spacing:6px;margin-bottom:14px}
.cover .sub{font-size:18px;letter-spacing:8px;color:#444;margin-bottom:40px}
.cover .meta{font-size:13px;color:#555;line-height:2}
.cover .dm{margin-top:40px;font-size:12px;color:#777;border-top:1px solid #aaa;padding-top:8px}
.part{font-size:22px;border-bottom:3px solid #222;padding-bottom:6px;margin-bottom:12px;letter-spacing:2px}
h3.sub{font-size:15px;margin:14px 0 6px;padding-left:8px;border-left:5px solid #222}
table{width:100%;border-collapse:collapse;margin:6px 0 10px;font-size:12px}
th,td{border:1px solid #666;padding:4px 7px;vertical-align:top;text-align:left}
th{background:#eee;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-weight:bold;white-space:nowrap}
td.c,th.c{text-align:center}
tr{break-inside:avoid}
.pre{white-space:pre-wrap;word-break:break-all}
.box{display:inline-block;width:12px;height:12px;border:1.5px solid #222;vertical-align:-2px;margin-right:4px}
.box.ck{background:#222}
.ln{border-bottom:1px solid #999;height:24px}
.tx{white-space:pre-wrap;word-break:break-all;border:1px solid #bbb;padding:6px 9px;min-height:30px;background:#fafafa}
.tx.dm{border:1.5px dashed #222;background:#f3f3f3}
.lb{font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:11px;font-weight:bold;color:#444;margin:8px 0 2px;letter-spacing:1px}
.rm h2{font-size:20px;display:flex;align-items:center;gap:10px;margin-bottom:4px}
.no{display:inline-flex;align-items:center;justify-content:center;min-width:30px;height:30px;padding:0 6px;border-radius:50%;background:#222;color:#fff;font-size:15px}
.meta2{font-size:11.5px;color:#444;margin-bottom:4px}
.map{display:grid;gap:14px;margin:14px 8px}
.mc{border:2px solid #222;min-height:84px;padding:20px 22px;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-size:11.5px;position:relative}
.mc.e{border:1px dotted #ddd}
.mc b{display:inline-flex;width:20px;height:20px;border-radius:50%;background:#222;color:#fff;align-items:center;justify-content:center;font-size:11px;margin-right:4px}
.mc .pl{margin-top:3px;font-size:10.5px;color:#444}
.hd{position:absolute;width:16px;height:16px;border:1.5px solid #000;background:#fff;font:bold 10px/13px "PingFang SC","Microsoft YaHei",sans-serif;text-align:center;font-style:normal;color:#000}
.hd.lock{background:#000;color:#fff}.hd.open{border-style:dashed}.hd.out,.hd.in{background:#ccc}
.hd.N{top:3px;left:calc(50% - 8px)}.hd.S{bottom:3px;left:calc(50% - 8px)}.hd.E{right:3px;top:calc(50% - 8px)}.hd.W{left:3px;top:calc(50% - 8px)}
.dot{display:inline-block;width:9px;height:9px;border-radius:50%;border:1px solid #333;margin-right:3px;vertical-align:0}
.player h2,.hp h2,.hpb h2{font-size:20px;border-bottom:2px solid #222;padding-bottom:4px;margin-bottom:8px}
.ph{display:flex;justify-content:space-between;font:11px "PingFang SC","Microsoft YaHei",sans-serif;color:#666;border-bottom:1px solid #aaa;margin-bottom:8px;padding-bottom:2px}
.sheet td.k{background:#f0f0f0;width:16%;font-family:"PingFang SC","Microsoft YaHei",sans-serif;font-weight:bold;white-space:nowrap}
.sheet td.v{width:34%;height:28px}
.note{color:#666;font-size:11.5px}
.toc td.n{width:36px;text-align:center}
.tight{margin:0;padding-left:18px}
.hb-entity{border:1px solid #444;border-radius:4px;padding:8px 10px;margin-top:8px;background:#fdfdfd;break-inside:avoid}
.hb-entity-title{font-size:14px;font-weight:bold;color:#222;margin-bottom:4px;display:flex;justify-content:space-between}
`;

const HB_DUP = `
@page :right{margin:16mm 15mm 16mm 22mm}
@page :left{margin:16mm 22mm 16mm 15mm}
@page{@bottom-center{content:counter(page);font:10px sans-serif;color:#666}}
body.dup .ch,body.dup .hp{break-before:right;page-break-before:right}
body.dup .f{break-before:auto!important;page-break-before:auto!important}
`;

const typeL = t => t === 'clue' ? '线索' : t === 'skill' ? '技能' : '道具';
const hLines = n => '<div class="ln"></div>'.repeat(n);
const hTxt = (s, n = 3, cls = '') => s && String(s).trim() ? `<div class="tx ${cls}">${esc(s)}</div>` : `<div>${hLines(n)}</div>`;
const hBx = on => `<i class="box ${on ? 'ck' : ''}"></i>`;

function bgBlock(i, sv) {
  const b = D.bg[i];
  return `<div class="lb">预设身份</div>${hTxt(b.identity, 4)}
    <div class="lb">技能 / 道具</div>` +
    (b.skills.length ? `<table><tr><th style="width:40px">类型</th><th style="width:22%">名称</th><th>效果 / 使用条件</th></tr>${b.skills.map(s => `<tr><td>${typeL(s.type)}</td><td><b>${esc(s.name)}</b></td><td class="pre">${esc(s.desc)}</td></tr>`).join('')}</table>` : '<p class="note">（无）</p>') +
    `<div class="lb">角色目的</div>` +
    (b.goals.length ? `<ul class="tight" style="list-style:none;padding:0">${b.goals.map(g => `<li>${hBx(sv && g.done)}<span class="pre">${esc(g.text)}</span></li>`).join('')}</ul>` : '<p class="note">（无）</p>');
}

function cardBlock(i, sv) {
  const c = D.bg[i].card, cfg = D.cardCfg;
  let attrRows = '';
  for (let k = 0; k < cfg.attrs.length; k += 2) {
    const a = cfg.attrs[k], b2 = cfg.attrs[k + 1];
    attrRows += `<tr><td class="k">${esc(a.name)}</td><td class="v">${sv ? (+c.vals[a.id] || 0) : ''}</td>${b2 ? `<td class="k">${esc(b2.name)}</td><td class="v">${sv ? (+c.vals[b2.id] || 0) : ''}</td>` : '<td class="k"></td><td class="v"></td>'}</tr>`;
  }
  return `<h3 class="sub" style="margin-top:14px">车卡</h3>
    <table class="sheet">${[0, 2, 4].map(k => `<tr><td class="k">${INFO_FIELDS[k][1]}</td><td class="v">${sv ? esc(c.info[INFO_FIELDS[k][0]]) : ''}</td><td class="k">${INFO_FIELDS[k + 1][1]}</td><td class="v">${sv ? esc(c.info[INFO_FIELDS[k + 1][0]]) : ''}</td></tr>`).join('')}</table>
    <div class="lb">可分配属性点数：${cfg.points} 点${sv ? `（已用 ${cardUsed(c)}，剩余 ${cfg.points - cardUsed(c)}）` : ''}</div>
    <table class="sheet">${attrRows}</table>
    <div class="lb">随身物品</div>${hTxt(sv ? c.items : '', 3)}
    <div class="lb">其他背景（性格、外貌、经历）</div>${hTxt(sv ? c.other : '', 5)}`;
}

function hbHtml(o) {
  const title = D.title || '未命名模组';
  const rooms = [...D.rooms].sort((a, b) => a.y - b.y || a.x - b.x);
  const num = new Map(rooms.map((r, i) => [r.id, i + 1]));
  const pn = i => esc(pname(i));
  const doorList = r => SIDES.filter(([s]) => r.doors[s]);
  const dShort = r => doorList(r).map(([s, l, dx, dy]) => {
    const t = r.doors[s].t, n = at(r.x + dx, r.y + dy);
    return `${l}${DOOR_S[t]}${t === 'in' ? '←' : '→'}${n ? num.get(n.id) : '外'}`;
  }).join('　') || '无';
  const today = new Date().toLocaleDateString('zh-CN');
  let h = '';

  h += `<section class="cover"><h1>${esc(title)}</h1><div class="sub">DM 带团手册</div>
    <div class="meta">玩家 ${D.players.length} 人　·　房间 ${D.rooms.length} 间　·　共 ${D.days.length} 天<br>
    物资 ${D.pool.length + D.rooms.reduce((s, r) => s + r.items.length, 0)} 件<br>印制日期：${today}</div>
    <div class="dm">${o.dm ? '含 DM 专属内容，请勿向玩家展示' : '玩家可阅读版本'}</div></section>`;

  h += `<section class="ch"><div class="part">目 录</div>
    <table class="toc"><tr><th class="c">章节</th><th>内容</th></tr>
    <tr><td class="n">一</td><td>日程与事件</td></tr>
    <tr><td class="n">二</td><td>地图总览（含门与通道）与房间索引</td></tr>
    <tr><td class="n">三</td><td>房间详解（每间房独立一页：场景、实体/遭遇、门、DM 备注、物资）</td></tr>
    ${o.pl ? '<tr><td class="n">四</td><td>玩家角色（预设背景 + 车卡，每人一页）</td></tr>' : ''}
    <tr><td class="n">${o.pl ? '五' : '四'}</td><td>附录：物资总表、属性追踪表、笔记页</td></tr></table>
    <h3 class="sub">玩家一览</h3>
    <table><tr><th class="c">#</th><th>玩家</th><th>角色姓名</th><th>代表色</th>${o.st ? '<th>当前位置</th>' : ''}</tr>
    ${D.players.map((_, i) => `<tr><td class="c">${i + 1}</td><td>${pn(i)}</td><td>${esc(D.bg[i].card.info.name)}</td>
      <td><i class="dot" style="background:${pcolor(i)}"></i>${pcolor(i)}</td>${o.st ? `<td>${D.bg[i].roomId ? num.get(D.bg[i].roomId) + ' ' + esc(rname(D.bg[i].roomId)) : '—'}</td>` : ''}</tr>`).join('')}</table></section>`;

  h += `<section class="ch"><div class="part">一　日程与事件</div>`;
  D.days.forEach((d, i) => {
    h += `<h3 class="sub">Day ${i + 1}</h3><table><tr><th class="c" style="width:28px">✓</th><th style="width:70px">时间</th><th style="width:26%">事件</th><th>详情 / 触发条件</th></tr>` +
      (d.events.length ? d.events.map(e => `<tr><td class="c">${hBx(o.st && e.done)}</td><td>${esc(e.time)}</td><td><b>${esc(e.title) || '（未命名）'}</b></td><td class="pre">${esc(e.detail)}</td></tr>`).join('')
        : `<tr><td colspan="4" class="note">（本日暂无预设事件）</td></tr>`) +
      `<tr><td class="c">${hBx(0)}</td><td></td><td></td><td></td></tr><tr><td class="c">${hBx(0)}</td><td></td><td></td><td></td></tr></table>`;
  });
  h += '</section>';

  h += `<section class="ch"><div class="part">二　地图总览</div>`;
  if (!rooms.length) h += '<p class="note">尚未创建房间。</p>';
  else {
    const xs = rooms.map(r => r.x), ys = rooms.map(r => r.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs), minY = Math.min(...ys), maxY = Math.max(...ys);
    h += `<div class="map" style="grid-template-columns:repeat(${maxX - minX + 1},1fr)">`;
    for (let y = minY; y <= maxY; y++) for (let x = minX; x <= maxX; x++) {
      const r = at(x, y);
      if (!r) { h += '<div class="mc e"></div>'; continue; }
      const here = o.st ? playersIn(r.id) : [];
      h += `<div class="mc"><b>${num.get(r.id)}</b>${esc(r.name) || '未命名'}${here.length ? `<div class="pl">${here.map(i => `<i class="dot" style="background:${pcolor(i)}"></i>${pn(i)}`).join('　')}</div>` : ''}
        ${doorList(r).map(([s]) => `<i class="hd ${r.doors[s].t} ${s}">${doorSym(r.doors[s].t, s)}</i>`).join('')}</div>`;
    }
    h += `</div><p class="note">上北下南，左西右东。房间内侧每条边正中的小方块即该方向的门：<b>门</b>＝双向门　<b>通</b>＝敞开通道（虚线）　<b>锁</b>＝锁住的门（黑底）　<b>箭头</b>＝单向门（灰底，箭头方向为通行方向）。没有标记的边是墙；门不一定通向另一个房间。</p>`;
    h += `<h3 class="sub">房间索引</h3><table><tr><th class="c">编号</th><th>房间</th><th>坐标</th><th>门与出口</th><th class="c">实体</th><th class="c">物资</th></tr>` +
      rooms.map(r => `<tr><td class="c">${num.get(r.id)}</td><td><b>${esc(r.name) || '未命名'}</b></td><td>(${r.x},${r.y})</td><td>${dShort(r)}</td><td class="c">${(r.entities || []).length}</td><td class="c">${r.items.length}</td></tr>`).join('') + '</table>';
  }
  h += '</section>';

  h += `<section class="ch"><div class="part">三　房间详解</div>`;
  if (!rooms.length) h += '<p class="note">尚未创建房间。</p>';
  rooms.forEach((r, idx) => {
    const here = o.st ? playersIn(r.id) : [];
    h += `<div class="rm ${idx ? '' : 'f'}"><h2><span class="no">${num.get(r.id)}</span>${esc(r.name) || '未命名'}</h2>
      <div class="meta2">坐标 (${r.x},${r.y})${here.length ? `　｜　当前在此：${here.map(pn).join('、')}` : ''}</div>
      <div class="lb">场景描述（可念给玩家）</div>${hTxt(r.desc, 3)}`;

    if ((r.entities || []).length) {
      h += `<div class="lb">🎭 场景固定实体 / 遭遇 / NPC</div>`;
      r.entities.forEach(en => {
        h += `<div class="hb-entity">
          <div class="hb-entity-title"><span>【${esc(en.category.toUpperCase())}】${esc(en.name)}</span><span>态度：${esc(en.disposition)}</span></div>
          ${en.desc ? `<div style="font-size:12px;color:#333;margin-bottom:4px"><b>外貌台词：</b>${esc(en.desc)}</div>` : ''}
          ${en.attrs.length ? `<div style="font-size:12px;margin-bottom:4px"><b>属性：</b>${en.attrs.map(a => `<u>${esc(a.name)}: ${esc(a.val)}</u>`).join('　')}</div>` : ''}
          ${en.actions.length ? `<table style="margin-top:4px"><tr><th style="width:30%">交互 / 触发时机</th><th>判定与后果反应</th></tr>${en.actions.map(act => `<tr><td><b>${esc(act.trigger)}</b></td><td class="pre">${esc(act.effect)}</td></tr>`).join('')}</table>` : ''}
          ${o.dm && en.dmNote ? `<div style="font-size:11.5px;color:#555;margin-top:2px">🔒 <b>幕后备注：</b>${esc(en.dmNote)}</div>` : ''}
        </div>`;
      });
    }

    if (o.dm) h += `<div class="lb">🔒 DM 专属内容</div>${hTxt(r.dm, 3, 'dm')}`;
    h += `<div class="lb">物资判定 / 备注</div>${hTxt(r.poolNote, 1)}`;
    h += `<div class="lb">门与通道</div>`;
    const dl = doorList(r);
    h += dl.length ? `<table><tr><th style="width:44px">方位</th><th style="width:100px">类型</th><th style="width:30%">通往</th><th>备注</th></tr>` +
      dl.map(([s, l, dx, dy]) => {
        const d = r.doors[s], n = at(r.x + dx, r.y + dy);
        return `<tr><td>${l}</td><td>${DOOR_T[d.t]}</td><td>${d.t === 'in' ? '来自 ' : ''}${n ? num.get(n.id) + ' ' + esc(n.name || '未命名') : '外部 / 未绘制区域'}</td><td class="pre">${esc(d.note)}</td></tr>`;
      }).join('') + '</table>'
      : '<p class="note">（没有门，封闭空间）</p>';
    h += `<div class="lb">物资清单</div>`;
    if (r.items.length) {
      h += `<table><tr><th class="c" style="width:28px">✓</th><th style="width:40px">类型</th><th style="width:18%">名称</th><th>描述</th><th style="width:22%">获取条件</th><th style="width:16%">${o.st ? '获得者' : '获得者（手写）'}</th></tr>` +
        r.items.map(i => `<tr><td class="c">${hBx(o.st && isGot(i))}</td><td>${typeL(i.type)}</td><td><b>${esc(i.name) || '（未命名）'}</b></td><td class="pre">${esc(i.desc)}</td><td class="pre">${esc(i.cond)}</td>
          <td>${o.st ? (i.consumed ? '已消耗 ' : '') + i.owners.map(pn).join('、') : ''}</td></tr>`).join('') + '</table>';
    } else h += '<p class="note">（此房间没有物资）</p>';
    h += '<div class="lb">本房间记录</div>' + hLines(3) + '</div>';
  });
  h += '</section>';

  if (o.pl) {
    h += `<section class="ch"><div class="part">四　玩家角色</div>`;
    D.players.forEach((_, i) => {
      const b = D.bg[i], c = b.card;
      h += `<div class="player ${i ? '' : 'f'}"><h2><i class="dot" style="background:${b.color};width:14px;height:14px"></i> ${pn(i)}${c.info.name && o.st ? `　<span style="font-size:14px;font-weight:normal">（${esc(c.info.name)}）</span>` : ''}</h2>
        ${bgBlock(i, o.st)}${cardBlock(i, o.st)}</div>`;
    });
    h += '</section>';
  }

  const all = [...D.rooms.flatMap(r => r.items.map(i => ({ i, r }))), ...D.pool.map(i => ({ i, r: null }))];
  h += `<section class="ch"><div class="part">${o.pl ? '五' : '四'}　附录</div>
    <h3 class="sub">A. 物资总表</h3>`;
  h += all.length ? `<table><tr><th class="c" style="width:28px">✓</th><th style="width:40px">类型</th><th style="width:20%">名称</th><th style="width:16%">所在房间</th><th>获取条件</th>${o.st ? '<th>获得者</th>' : ''}</tr>` +
    all.map(({ i, r }) => `<tr><td class="c">${hBx(o.st && isGot(i))}</td><td>${typeL(i.type)}</td><td><b>${esc(i.name) || '（未命名）'}</b></td><td>${r ? num.get(r.id) + ' ' + esc(r.name) : '未分配'}</td><td class="pre">${esc(i.cond)}</td>${o.st ? `<td>${(i.consumed ? '已消耗 ' : '') + i.owners.map(pn).join('、')}</td>` : ''}</tr>`).join('') + '</table>' : '<p class="note">（暂无物资）</p>';
  h += `<h3 class="sub">B. 玩家属性追踪表</h3><p class="note">带团时在格子里手写当前数值，随时涂改。</p>
    <table><tr><th>玩家</th>${D.cardCfg.attrs.map(a => `<th class="c">${esc(a.name)}</th>`).join('')}</tr>` +
    D.players.map((_, i) => `<tr><td><i class="dot" style="background:${pcolor(i)}"></i>${pn(i)}</td>${D.cardCfg.attrs.map(a => `<td class="c" style="height:30px">${o.st ? (+D.bg[i].card.vals[a.id] || 0) : ''}</td>`).join('')}</tr>`).join('') + '</table>';
  h += `<h3 class="sub">C. 事件记录</h3><table><tr><th style="width:60px">Day</th><th style="width:70px">时间</th><th>事件 / 玩家行动 / 备注</th></tr>` +
    Array.from({length: 14}, () => '<tr><td style="height:28px"></td><td></td><td></td></tr>').join('') + '</table></section>';
  h += `<section class="ch"><div class="part">笔记</div>${hLines(30)}</section>`;

  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${esc(title)} · DM 带团手册</title><style>${HB_CSS}${o.dup ? HB_DUP : ''}</style></head><body class="${o.dup ? 'dup' : ''}">${h}</body></html>`;
}

function hpHtml(o) {
  const title = D.title || '未命名模组';
  const head = i => `<div class="ph"><span>${esc(title)}</span><span>玩家角色卡</span></div>
    <h2><i class="dot" style="background:${pcolor(i)};width:14px;height:14px"></i> ${esc(pname(i))}　<span style="font-size:13px;font-weight:normal">玩家姓名：${'＿'.repeat(6)}</span></h2>`;
  const pages = D.players.map((_, i) => {
    const bg = o.bg ? bgBlock(i, false) : '';
    const card = cardBlock(i, o.fill);
    if (o.bg && o.split)
      return `<section class="hp ${i ? '' : 'f'}">${head(i)}<h3 class="sub">角色背景（请保密）</h3>${bg}</section>
              <section class="hpb">${head(i)}${card}</section>`;
    return `<section class="hp ${i ? '' : 'f'}">${head(i)}${bg}${card}</section>`;
  }).join('');
  return `<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>${esc(title)} · 玩家发放版</title><style>${HB_CSS}${o.dup ? HB_DUP : ''}</style></head><body class="${o.dup ? 'dup' : ''}">${pages}</body></html>`;
}
