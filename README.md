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


## 云端同步最小安全修复（v0.2.1）

采用整份快照的乐观锁，不做自动合并或协同编辑。MVP 仍只有 `default` 一个共享工作区；同步密码持有者都能读取、写入同一份数据，尚不提供账号隔离。

- PostgreSQL `app_state.version INTEGER NOT NULL DEFAULT 1`。启动时用 `ALTER TABLE ... ADD COLUMN IF NOT EXISTS` 给现有记录补版本 1；空工作区用版本 0 表示。
- GET `/api/state` 返回 `{ok,state,version,updatedAt}`；空工作区返回 `{ok:true,state:null,version:0,updatedAt:null}`。
- PUT `/api/state` 必须发送 `{state,baseVersion}`。首次创建只允许 `baseVersion:0`，使用 `INSERT ... ON CONFLICT DO NOTHING`；更新使用 `UPDATE ... WHERE key=$1 AND version=$3` 并在同一语句里递增版本。数据库原子判定，无先查后写窗口。
- 成功返回 200 `{ok:true,version,updatedAt}`；版本不匹配返回 409 `{ok:false,error:"STATE_CONFLICT",version,updatedAt,message}`。409 的版本只供提示，不可据此修改基线并自动重试。缺少或非法版本返回 400；旧客户端必须刷新升级。
- 客户端把基线版本与本地快照一同保存在 LocalStorage；冲突时保留本地内容，显示持久提示、暂停自动上传。先导出 JSON 备份，再确认加载云端数据后恢复。无基线且云端有数据时同样暂停，不能只读取新版本就上传旧数据。JSON 导入重置基线；下载不会触发上传；同一页面的同步请求串行。
- `MOJING_ACCESS_TOKEN` 必须配置，GET/PUT `/api/state` 和 POST `/api/ai` 均需正确的 `X-Mojing-Token`。未配置返回 503 `AUTH_NOT_CONFIGURED`，配置后缺少/错误密码返回 401。没有匿名读或写开关。静态页面、`/api/health`、`/api/config` 保持公开，后者只暴露配置布尔值（`tokenRequired:true`、`authConfigured`），不暴露数据或密码。

部署前设置 `DATABASE_URL`、`MOJING_ACCESS_TOKEN`，先部署服务端执行版本列迁移，再刷新客户端。版本列是同步修订号，与应用发布版本和 JSON 格式版本无关。自动迁移要求数据库用户具备 ALTER 权限；失败时同步接口保持不可用。不要在接收新版本写入后回滚至旧的无条件写入服务端。

### 三个最小验收场景

| 场景 | 操作 | 预期 |
| --- | --- | --- |
| 旧版本覆盖新版本 | 读取 v1；另一请求写为 v2；旧客户端携带 baseVersion=1 上传 | 409；云端仍是 v2；本地保留且自动上传暂停；无 baseVersion 的旧协议请求为 400 |
| 并发写入 | 两个请求同时携带相同 baseVersion 写不同内容（首次创建也测试） | 恰好一个 200、一个 409；版本只增加一次，内容为成功请求的数据 |
| 未配置 token | 清空 MOJING_ACCESS_TOKEN，对 state GET/PUT、AI POST 发请求 | 全部 503 AUTH_NOT_CONFIGURED；health/config/静态页面可访问；配置后错误或缺失 token 为 401 |

运行 `npm test` 验证 HTTP 处理器与客户端行为。默认测试使用数据库替身，不能证明真实 PostgreSQL 锁语义。安装依赖后，设置 `TEST_DATABASE_URL` 指向可创建测试 schema 的测试数据库，再运行 `npm test`，执行相同场景的真实 PostgreSQL 集成测试。测试使用独立 schema 并在结束时清理，不要指向生产数据库。
