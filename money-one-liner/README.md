# 一句话记账（money-one-liner）

本地可运行的个人理财网页应用，面向大学生和初入职场用户。  
核心目标：一句话完成记账，同时支持手动补录、行内编辑、锁定防误改、筛选分析与导出。

## 核心能力

- 一句话解析记账（规则 / API / 自动三种模式）
- 语音输入（Web Speech 优先，自动降级到 API 转写）
- 手动新增账单（日期、收支、类型、备注、金额）
- 账单行内编辑（直接改日期/收支/类型/备注/金额）
- 账单锁定（锁定后不可编辑、不可删除）
- 网页内规则中心（关键词和优先级可改）
- 搜索筛选（关键词、时间、类型、收支）
- 导出：
  - 当前筛选结果：CSV / JSON
  - 汇总：按类型 / 按日 / 按月 CSV
  - 勾选行导出 CSV
- 本地持久化（IndexedDB）

## API 安全策略

- 浏览器端不存储真实 API Key。
- 解析与语音转写统一走本地代理 `server/`。
- API Key 仅保存在本机 `server/config/provider.local.json`（已加入 `.gitignore`）。
- 页面只显示 `已配置/未配置`，不回显密钥明文。

## 默认模型与兼容预设

默认使用：

- preset: `deepseek`
- upstream base URL: `https://api.deepseek.com`
- parse model: `deepseek-chat`

内置 OpenAI 风格兼容预设：

- `deepseek`
- `openai`
- `groq`
- `openrouter`
- `dashscope_intl`
- `dashscope_cn`
- `custom`

## 快速开始

### 1. 配置代理（可选）

仅当你要用 API 解析/转写时需要：

```bash
cd server
copy .env.example .env
```

编辑 `server/.env`（可只填 key，其它用默认）：

```env
OPENAI_API_KEY=sk-your-key
OPENAI_PRESET=deepseek
OPENAI_BASE_URL=https://api.deepseek.com
OPENAI_PARSE_MODEL=deepseek-chat
OPENAI_TRANSCRIBE_MODEL=whisper-1
PROXY_PORT=8787
```

### 2. 一键启动（Windows）

双击 `start-bookkeeping.bat`：

- 启动前端静态页面 `http://127.0.0.1:5173/index.html`
- 若检测到 Node 和 `server/src/index.js`，自动拉起本地代理

### 3. 手动启动（可选）

前端：

```bash
python -m http.server 5173
```

代理：

```bash
cd server
npm run start
```

## 页面使用说明

- **快速记账**：一句话输入或语音输入。
- **手动新增账单**：直接填日期、收支、类型、备注、金额。
- **账单明细**：
  - 行内直接编辑并点 `保存`
  - 点 `锁定` 后该条不能编辑/删除
  - 点 `解锁` 恢复可编辑
- **筛选**：关键词 + 时间 + 类型 + 收支组合筛选，统计面板随筛选联动。
- **导出**：
  - 当前筛选 CSV/JSON
  - 按类型/按日/按月汇总 CSV
  - 勾选行导出 CSV
- **代理与 API 设置**：
  - 可改 preset / upstream baseURL / 模型
  - API Key 只支持“更新”，不回显旧值

## 测试

```bash
npm test
```

## 目录结构

```text
money-one-liner/
  index.html
  styles.css
  start-bookkeeping.bat
  src/
    api/
    analytics/
    domain/
    export/
    migrations/
    parser/
    repository/
    rules/
    ui/
    voice/
  server/
    .env.example
    config/
    package.json
    src/
      configStore.js
      index.js
      providers/
      security/
  tests/
```
