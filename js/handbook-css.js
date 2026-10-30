// js/handbook-css.js — 手册打印样式常量 (ES6 Module)

export const HB_CSS = `
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
.npc-card{border:1px solid #555;border-radius:4px;padding:10px 12px;margin-top:10px;break-inside:avoid;position:relative}
.npc-card.monster{border-color:#a00;background:#fff8f8}
.npc-card.other{border-color:#777;background:#f8f8f8}
.npc-card-title{font-size:15px;font-weight:bold;display:flex;align-items:center;gap:8px;margin-bottom:5px}
.npc-badge{display:inline-block;font-size:10px;padding:1px 6px;border-radius:10px;background:#333;color:#fff;font-family:"PingFang SC","Microsoft YaHei",sans-serif;vertical-align:1px}
.npc-badge.monster{background:#a00}
.npc-badge.other{background:#777}
.npc-disp{display:inline-block;font-size:11px;padding:1px 6px;border-radius:10px;border:1px solid #888;color:#444;font-family:"PingFang SC","Microsoft YaHei",sans-serif}
.npc-disp.友好{border-color:#4aa8d8;color:#1a6a9a}
.npc-disp.敌对{border-color:#a00;color:#a00}
.npc-color-dot{display:inline-block;width:12px;height:12px;border-radius:50%;border:1px solid #aaa;vertical-align:-2px;margin-right:3px}
.day-block{border:1px solid #bbb;border-radius:4px;padding:8px 12px;margin-top:10px;break-inside:avoid}
.day-title{font-size:15px;font-weight:bold;font-family:"PingFang SC","Microsoft YaHei",sans-serif;margin-bottom:5px}
`;

export const HB_DUP = `
@page :right{margin:16mm 15mm 16mm 22mm}
@page :left{margin:16mm 22mm 16mm 15mm}
@page{@bottom-center{content:counter(page);font:10px sans-serif;color:#666}}
body.dup .ch,body.dup .hp{break-before:right;page-break-before:right}
body.dup .f{break-before:auto!important;page-break-before:auto!important}
`;