<p align="center">
  <strong>Workflow Agent Hub</strong>
  <a href="./README.md">English</a>
</p>

<p align="center">
  面向真实执行流的多 Agent 编排工作台。<br/>
  把应用、流程、AI 对话、平台渠道、定时任务、技能与运行控制<br/>
  收口到一个响应式工作界面里统一推进。
</p>

<p align="center">
  <code>git clone https://gitee.com/keyDemo/workflow-agent-hub.git</code>
</p>

<p align="center">
  <img src="./packages/client/src/assets/image1.png" alt="Workflow Agent Hub 演示" width="680"/>
</p>

<p align="center">
  <img src="./packages/client/src/assets/image2.png" alt="Workflow Agent Hub 演示" width="680"/>
</p>

<p align="center">
  <strong>移动端</strong>
</p>

<p align="center">
  <video src="./packages/client/src/assets/video.mp4" width="360" controls></video>
</p>

<p align="center">
  <a href="https://gitee.com/keyDemo/workflow-agent-hub">Gitee 仓库</a>
</p>

---

## 功能特性

### AI 聊天

- 通过 SSE 实时流式输出，支持异步 Run
- 多会话管理 — 创建、重命名、删除、切换会话
- **自建会话数据库** — 本地 SQLite 存储，首次启动时自动从运行时 state.db 同步 api_server 会话
- 按来源分组会话（Telegram、Discord、Slack 等），可折叠手风琴面板
- 活跃会话实时指示器 — 正在进行的会话置顶并显示旋转图标
- 按最新消息时间排序会话列表
- Markdown 渲染，支持语法高亮和代码复制
- 工具调用详情展开（参数 / 结果）
- 文件上传支持
- 文件下载支持 — 支持下载用户上传的文件和 Agent 生成的文件，兼容 local、Docker、SSH、Singularity 等多种 terminal backend
- 会话搜索 — Ctrl+K 全局搜索所有对话
- 全局模型选择器 — 自动从 `~/.hermes/auth.json` 凭证池发现可用模型
- 每个会话显示模型标签和上下文 Token 用量

### 平台渠道

在一个页面统一配置 **8 个平台**：

| 平台 | 功能 |
|---|---|
| Telegram | Bot Token、提及控制、表情回应、自由回复聊天 |
| Discord | Bot Token、提及、自动线程、表情回应、频道白名单/黑名单 |
| Slack | Bot Token、提及控制、Bot 消息处理 |
| WhatsApp | 启用/禁用、提及控制、提及模式 |
| Matrix | Access Token、Homeserver、自动线程、私信提及线程 |
| 飞书 | App ID / Secret、提及控制 |
| 微信 | 扫码登录（浏览器扫码，自动保存凭证） |
| 企业微信 | Bot ID / Secret |

- 凭证管理写入 `~/.hermes/.env`
- 渠道行为设置写入 `~/.hermes/config.yaml`
- 配置变更后自动重启网关
- 每个平台已配置/未配置状态检测

### 用量分析

- Token 总用量明细（输入 / 输出）
- 会话数及日均统计
- 预估费用追踪及缓存命中率
- 模型使用分布图
- 30 天每日趋势（柱状图 + 数据表格）

### 定时任务

- 创建、编辑、暂停、恢复、删除 Cron 任务
- 立即触发执行
- Cron 表达式快捷预设

### 模型管理

- 从凭证池自动发现模型（`~/.hermes/auth.json`）
- 从每个 Provider 端点获取可用模型（`/v1/models`）
- 添加、更新、删除 Provider（预设 & 自定义 OpenAI 兼容）
- OpenAI Codex 和 Nous Portal OAuth 登录
- Provider URL 自动检测，支持非 v1 API 版本（如 `/v4`）
- Provider 级别模型分组，支持切换默认模型

### 多配置文件与网关

- 创建、重命名、删除、切换运行时配置文件（Profile）
- 克隆现有配置文件或从归档导入（`.tar.gz`）
- 导出配置文件用于备份或分享
- 多网关管理 — 按 Profile 启动、停止、监控网关
- 自动端口冲突解决
- 配置文件级别的配置和缓存隔离

### 文件浏览器

- 浏览远程后端文件（local、Docker、SSH、Singularity）
- 上传、下载、重命名、复制、移动和删除文件
- 创建目录
- 查看文件内容，支持语法高亮

### 群聊

- 多 Agent 聊天房间，通过 Socket.IO 实时通信
- @提及路由 — 提及 Agent 触发上下文回复
- 上下文压缩 — 历史消息超过 Token 阈值时自动摘要压缩
- 输入状态和回复进度指示器
- 房间创建、删除和邀请码管理
- Agent 管理 — 添加/移除房间中的 Agent，支持独立 Profile
- SQLite 消息持久化
- 移动端响应式布局，可折叠侧边栏

### 技能与记忆

- 浏览和搜索已安装的技能
- 查看技能详情和附件
- 用户笔记和档案管理

### 日志

- 查看 Agent / Gateway / Error 日志
- 按日志级别、日志文件和关键词过滤
- 结构化日志解析，HTTP 访问日志高亮

### 认证

- 基于 Token 的认证（首次运行自动生成或通过 `AUTH_TOKEN` 环境变量设置）
- 可选的用户名/密码登录 — 通过初始 Token 认证后在设置页面设置
- 可通过 `AUTH_DISABLED=1` 禁用认证

### 设置

- 显示（流式输出、紧凑模式、推理过程、费用显示）
- Agent（最大轮次、超时时间、工具强制执行）
- 记忆（启用/禁用、字符限制）
- 会话重置（空闲超时、定时重置）
- 隐私（PII 脱敏）
- 模型设置（默认模型 & Provider）
- API 服务器配置

### Web 终端

- 集成终端，基于 node-pty 和 @xterm/xterm
- 多会话支持 — 创建、切换、关闭终端会话
- 通过 WebSocket 实时传输键盘输入和 PTY 输出
- 支持窗口大小调整

---

## 快速开始

### npm 安装（推荐）

```bash
git clone https://gitee.com/keyDemo/workflow-agent-hub.git
cd workflow-agent-hub
pnpm install
pnpm dev
```

打开 **http://localhost:8648**

### 一键安装（自动检测系统）

自动安装 Node.js（如未安装）并拉起 Workflow Agent Hub，支持 Debian/Ubuntu/macOS：

```bash
bash <(curl -fsSL https://gitee.com/keyDemo/workflow-agent-hub/raw/main/scripts/setup.sh)
```

### WSL

```bash
bash <(curl -fsSL https://gitee.com/keyDemo/workflow-agent-hub/raw/main/scripts/setup.sh)
pnpm dev
```

> WSL 会自动检测并使用 `hermes gateway run` 进行后台启动（无需 launchd/systemd）。

### Docker Compose

使用仓库内置的 compose 文件联合运行运行时 Agent 服务 + Web UI：

```bash
docker compose up -d --build hermes-agent hermes-webui
docker compose logs -f hermes-webui
```

打开 **http://localhost:6060**

- 运行时持久化数据目录：`./hermes_data`
- Web UI 认证 Token 存储在 `./hermes_data/hermes-web-ui/.token`
- 首次启动并开启认证时，Token 会打印到容器日志中
- 运行参数全部由 `docker-compose.yml` 环境变量驱动

更详细的说明与排错见：[`docs/docker.md`](./docs/docker.md)

### CLI 命令

| 命令 | 说明 |
|---|---|
| `hermes-web-ui start` | 后台启动（守护进程模式） |
| `hermes-web-ui start --port 9000` | 自定义端口启动 |
| `hermes-web-ui stop` | 停止后台进程 |
| `hermes-web-ui restart` | 重启后台进程 |
| `hermes-web-ui status` | 查看运行状态 |
| `hermes-web-ui update` | 更新到最新版本并重启 |
| `hermes-web-ui -v` | 显示版本号 |
| `hermes-web-ui -h` | 显示帮助信息 |

### 自动配置

启动时 BFF 服务器会自动：

- 校验 `~/.hermes/config.yaml` 并补全缺失的 `api_server` 字段
- 修改时备份原配置到 `config.yaml.bak`
- 检测并启动网关（如未运行）
- 解决端口冲突（清理残留进程）
- 启动成功后自动打开浏览器

---

## 开发

### 本地调试启动

```bash
git clone https://gitee.com/keyDemo/workflow-agent-hub.git
cd workflow-agent-hub
npm install
npm run dev
```

`npm run dev` 会同时启动两个进程：

- 前端 Vite：http://localhost:5173/#/hermes/chat
- BFF 服务器：http://localhost:8648（自动检测/启动运行时网关，并代理到对应 Profile 的网关端口）

本地调试时请优先打开前端地址 `http://localhost:5173/#/hermes/chat`。Vite 已配置代理，前端请求会转发到本地 BFF：

- `/api/*`、`/v1/*`、`/health`、`/upload`、`/webhook` → `http://127.0.0.1:8648`
- `/socket.io` → `http://127.0.0.1:8648`（WebSocket）

认证默认开启。首次启动时，BFF 终端会打印：

```text
Auth enabled — token: <your-token>
```

也可以从本机文件读取：

```bash
cat ~/.hermes-web-ui/.token
```

拿到 token 后，可以在登录页粘贴，也可以直接打开：

```text
http://localhost:5173/?token=<your-token>#/hermes/chat
```

如果只想临时关闭认证方便调试：

```bash
AUTH_DISABLED=1 npm run dev
```

需要分别调试前后端时，可以拆开运行：

```bash
npm run dev:server   # Koa BFF，默认 http://localhost:8648
npm run dev:client   # Vite 前端，默认 http://localhost:5173
```

常用检查命令：

```bash
npm run build
npm run test
```

如果 8648 或 5173 被占用，请先停止旧的开发进程，或用 `PORT=9000 npm run dev:server` 临时更换 BFF 端口；更换后也要同步调整 `vite.config.ts` 中的 `BACKEND`。

### 本地生产态验证

需要用构建产物做一次接近发布环境的验证时：

```bash
npm run build
PORT=8648 node dist/server/index.js
```

打开 **http://localhost:8648**。如果想验证全局 CLI 的后台启动流程，可以在仓库根目录执行：

```bash
npm link
hermes-web-ui start
hermes-web-ui status
hermes-web-ui stop
```

### 仓库隔离运行

当你正在当前仓库里持续开发时，建议把 Web UI 数据目录切到仓库内的隔离目录，避免无意间复用其他守护进程或历史环境的 `~/.hermes-web-ui` 数据：

```bash
npm run dev:isolated
```

如果要做构建产物验证，也建议使用同一套隔离目录：

```bash
npm run build
HERMES_WEBUI_HOME=.runtime/.hermes-web-ui PORT=8648 node dist/server/index.js
cat .runtime/.hermes-web-ui/.token
```

本地 CLI 入口同样支持这个覆盖方式：

```bash
HERMES_WEBUI_HOME=.runtime/.hermes-web-ui node ./bin/hermes-web-ui.mjs start
```

## 架构

```
浏览器 → BFF (Koa, :8648) → 运行时网关 (:8642)
                ↓
           运行时 CLI (会话、日志、版本)
                ↓
           ~/.hermes/config.yaml  (渠道行为配置)
           ~/.hermes/auth.json    (凭证池)
           腾讯 iLink API         (微信扫码登录)
```

前端采用 **多 Agent 可扩展架构** — 当前运行时相关代码仍按命名空间组织在 `hermes/` 目录下（API、组件、视图、Store），可以方便地并行接入新的 Agent。

BFF 层负责：API 代理（含路径重写）、SSE 流式推送、文件上传与下载（多 Backend 支持：local/Docker/SSH/Singularity）、通过 CLI 管理会话 CRUD、配置/凭证管理、微信扫码登录、模型发现、技能/记忆管理、日志读取和静态文件服务。

## 技术栈

**前端：** Vue 3 + TypeScript + Vite + Naive UI + Pinia + Vue Router + vue-i18n + SCSS + markdown-it + highlight.js

**后端：** Koa 2（BFF 服务器）+ node-pty（Web 终端）

## Star 历史

仓库地址：https://gitee.com/keyDemo/workflow-agent-hub

## 赞助

如果你觉得这个项目对你有帮助，欢迎支持我：

<a href="https://ifdian.net/a/ekko8888"><img src="https://img.shields.io/badge/Sponsor-%E7%88%B1%E5%8F%91%E7%94%B5-orange?style=flat-square" alt="Sponsor"/></a>

## 许可证

[MIT](./LICENSE)
