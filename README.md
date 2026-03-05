# self-app-vibe-coding

多项目练习仓库，统一托管多个 Web/Python 原型与学习代码。

## 仓库结构

```text
self-app-vibe-coding/
├─ git-learning/                  # Python/Git 学习样例
├─ money-one-liner/               # 一句话记账应用（前端 + 本地代理）
├─ myAgent/                       # Python 虚拟环境与本地实验目录
├─ texas-holdem-multiplayer/      # 多人德州扑克 H5 Demo
├─ todo-kimi25/                   # 待办应用（TS 源码 + 编译产物）
└─ todoList/                      # 待办应用（Vite + Vitest + Playwright）
```

> 说明：数据库与依赖目录（如 `*.db`、`node_modules/`）已在根 `.gitignore` 中忽略。

## 环境要求

- Node.js 20+（建议 LTS）
- npm 10+
- Python 3.10+（用于 `git-learning` 或本地静态服务）

## 快速开始

```bash
git clone https://github.com/emmmdty/self-app-vibe-coding.git
cd self-app-vibe-coding
```

## 子项目运行指南

### 1) `money-one-liner`

用途：一句话记账 Web 应用，支持本地代理解析。

```bash
cd money-one-liner
npm install
npm test
```

若需启动代理服务：

```bash
cd money-one-liner/server
npm install
npm run start
```

若在 Windows 下一键启动前端 + 代理，可双击：

```text
money-one-liner/start-bookkeeping.bat
```

---

### 2) `texas-holdem-multiplayer`

用途：多人德州扑克（虚拟筹码）本地联机 Demo。

```bash
cd texas-holdem-multiplayer
npm install
npm run dev
```

测试命令：

```bash
npm test
```

默认访问：`http://localhost:3000`

---

### 3) `todoList`

用途：基于 Vite 的待办应用，含单元测试与 E2E 测试配置。

```bash
cd todoList
npm install
npm run dev
```

其他常用命令：

```bash
npm run build
npm run test
npm run test:e2e
```

---

### 4) `todo-kimi25`

用途：待办应用（TypeScript 源码已编译到 `js/`）。

```bash
cd todo-kimi25
npm install
npx tsc
```

本项目无内置 `dev` 脚本，可使用任意静态服务器打开 `index.html`。

---

### 5) `git-learning`

用途：Git/Python 基础练习脚本。

```bash
cd git-learning
python hello.py
```

---

### 6) `myAgent`

用途：本地 Python 实验目录（当前仓库中仅包含环境标识与本地状态文件）。

可按需在该目录自定义脚本与运行方式。

## 截图区（待补充）

将截图放到 `docs/screenshots/` 后，替换下列占位链接：

### money-one-liner

![money-one-liner-home](docs/screenshots/money-one-liner-home.png)

### texas-holdem-multiplayer

![texas-holdem-lobby](docs/screenshots/texas-holdem-lobby.png)

### todoList

![todoList-main](docs/screenshots/todoList-main.png)

### todo-kimi25

![todo-kimi25-main](docs/screenshots/todo-kimi25-main.png)

## 版本管理约定

- 默认主分支：`main`
- 建议分支命名：`feature/<topic>`、`fix/<topic>`、`chore/<topic>`
- 提交前建议执行对应项目最小验证（`npm test` / `python ...`）
- 提交信息建议前缀：`feat:`、`fix:`、`docs:`、`refactor:`、`test:`、`chore:`
- 不提交密钥、数据库、构建缓存和依赖目录

## 许可证

本仓库采用 [MIT License](./LICENSE)。
