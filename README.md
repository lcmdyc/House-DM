#House-DM TRPG 模组 DM 工作台

一个运行在浏览器里的 TRPG（桌面角色扮演游戏）DM 辅助工具，支持地图编辑、玩家管理、日程推进、物资分配、多人协作等功能，并内置模组库，可一键导入预制模组。

> 🔗 在线访问：[https://lcmdyc.github.io/House-DM](https://lcmdyc.github.io/House-DM)

> 🔗 测试自用：[https://rawcdn.githack.com/lcmdyc/House-DM/backup-latest/index.html](https://rawcdn.githack.com/lcmdyc/House-DM/backup-latest/index.html)
---

## ✨ 功能特性

- 🗺️ **地图编辑器** — 自由绘制房间、连接通道、放置实体
- 👥 **玩家管理** — 管理玩家属性、背景、车卡，支持自定义属性栏
- 📅 **日程推进** — 按天管理事件表，一键推进剧情
- 🎒 **物资总览** — 统一管理道具与线索，支持分配给玩家
- 📜 **运行日志** — 自动记录模组运行过程中的关键操作
- 📖 **导出手册** — 生成 DM 完整手册或玩家发放版，支持打印/PDF
- 🔗 **多人协作** — 基于 PeerJS 的实时 P2P 同步，DM 与玩家共享视图
- 📦 **模组库** — 在线浏览并一键导入预制模组
- 🌙 **深色/浅色主题** — 支持一键切换

---

## 📁 项目结构

```
/
├── index.html              # 主页面
├── style.css               # 样式
├── js/
│   ├── app.js              # 核心逻辑
│   ├── data.js             # 数据结构与存储
│   ├── theme.js            # 主题切换
│   ├── p2p.js              # 多人协作
│   └── handbook.js         # 手册导出
├── modules/
│   ├── index.json          # 模组库索引
│   └── *.json              # 模组文件
└── README.md
```

---

## 📦 模组库

### 浏览与导入

点击顶栏 **📦 模组库** 按钮，即可浏览所有已收录的模组，点击「⬇ 导入此模组」一键加载。

> ⚠️ 导入会覆盖当前数据，建议先点「💾 导出备份」保存当前进度。

### 上传新模组

1. 用工具编辑好模组，点「💾 导出备份」得到 `xxx.json`
2. 将 `xxx.json` 上传到仓库 `modules/` 目录
3. 编辑 `modules/index.json`，在数组中新增一条记录：

```json
{
  "name": "模组名称",
  "desc": "简介文字",
  "players": "3-5人",
  "duration": "约3小时",
  "tags": ["标签1", "标签2"],
  "file": "modules/xxx.json",
  "author": "作者名",
  "version": "1.0"
}
```

### index.json 字段说明

| 字段 | 必填 | 说明 |
|---|---|---|
| `name` | ✅ | 模组名称 |
| `file` | ✅ | JSON 文件路径（相对仓库根目录） |
| `desc` | 推荐 | 简介，显示在卡片上 |
| `players` | 可选 | 如 `"3-5人"` |
| `duration` | 可选 | 如 `"约3小时"` |
| `tags` | 可选 | 标签数组，如 `["恐怖", "解谜"]` |
| `author` | 可选 | 作者名 |
| `version` | 可选 | 版本号 |

---

## 💾 数据说明

- 模组数据自动保存在浏览器 `localStorage`，**清除浏览器数据会导致丢失**
- 建议定期点击「💾 导出备份」将数据保存为本地 JSON 文件
- 可通过「📂 导入」恢复备份

---

## 🔗 多人协作

1. DM 点击「🔗 启动多人协作」，复制邀请链接
2. 玩家打开链接即可实时同步 DM 的地图与状态
3. 基于 [PeerJS](https://peerjs.com/)，无需服务器，纯 P2P 连接
