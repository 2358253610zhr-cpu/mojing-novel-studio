# 墨境 AI 小说创作平台 · 云端 MVP v0.1

这是一个不依赖本地 Codex / Node / Python 的云端部署版本。部署完成后，只需要浏览器即可使用。

## 当前已完成

- 深色小说创作工作台
- 项目中心
- 新建小说向导
- 世界观、人物、大纲、章节、伏笔、记忆库模块
- 章节编辑器
- 本地自动保存（浏览器 LocalStorage）
- 项目 JSON 导入 / 导出
- AI 助手界面
- 云端 `/api/ai` 代理接口骨架
- Render 部署配置

## 本地不是必须

如果电脑无法安装 Codex，直接把整个项目上传到 GitHub，再在 Render 中从仓库创建 Web Service 即可。

## Render 配置

- Runtime: Node
- Build Command: 留空
- Start Command: `node server.js`
- Health Check: `/api/health`

AI 环境变量：

- `AI_API_URL`：兼容 Chat Completions 的 API 根地址
- `AI_API_KEY`：API 密钥
- `AI_MODEL`：模型名

> 密钥必须放在云端环境变量中，不要写到 `app.js` 或浏览器中。

## 数据说明

v0.1 先使用浏览器 LocalStorage，目的是最快形成可运行产品。下一阶段接 PostgreSQL 后，将迁移到账号级云端存储、版本历史、跨设备同步、小说记忆检索。
