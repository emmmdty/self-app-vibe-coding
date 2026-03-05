# self-app-vibe-coding

## 项目简介

这是一个用于集中管理多个练习项目和应用原型的仓库，目标是统一版本管理流程、规范提交记录，并持续迭代各子项目。

## 目录结构

```text
self-apps/
├─ git-learning/
├─ money-one-liner/
├─ myAgent/
├─ texas-holdem-multiplayer/
├─ todo-kimi25/
└─ todoList/
```

> 说明：`sqlite_mcp_server.db` 为本地数据库文件，已加入忽略规则，不纳入版本管理。

## 快速开始

1. 克隆仓库

```bash
git clone https://github.com/emmmdty/self-app-vibe-coding.git
cd self-app-vibe-coding
```

2. 进入任一子项目目录并安装依赖（如 Node 项目）

```bash
cd todoList
npm install
npm run dev
```

3. 不同子项目请按各自目录中的脚本和配置运行。

## 版本管理约定

- 默认主分支：`main`
- 日常开发建议使用功能分支：`feature/<name>`、`fix/<name>`
- 提交信息建议采用简洁前缀：`feat:`、`fix:`、`chore:`、`docs:`、`refactor:`、`test:`
- 合并前确保：
  - 不提交 `node_modules`、日志、环境变量、数据库和构建产物
  - 提交信息可读且与改动一致

## 许可证

本仓库采用 [MIT License](./LICENSE)。
