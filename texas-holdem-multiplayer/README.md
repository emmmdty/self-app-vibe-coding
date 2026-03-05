# Texas Holdem Multiplayer (MVP Demo)

多人德州扑克在线小游戏（H5，本地运行），支持 2–10 人联机、虚拟筹码、房间邀请链接、all-in 与边池结算。

> 合规声明：仅学习/娱乐演示，使用系统虚拟筹码（chips），无真实货币交易；不支持充值、提现、兑换、支付接入。

## 技术说明
- 基于开源项目 `ptwu/distributed-texasholdem` 二次开发（保留项目基础结构）
- `socket.io`：多人实时同步
- `pokersolver`：摊牌牌型评估
- `Node.js + Express`：单进程本地服务

## 快速启动
```bash
npm install
npm run dev
```

打开：
- `http://localhost:3000`

## 联机方式（本地）
1. 窗口 A 输入昵称，点击“创建房间”
2. 复制邀请链接（`?roomId=xxxx`）
3. 窗口 B 打开链接或输入房间号点击“加入房间”
4. 房主可在开始前设置“初始筹码”
5. 玩家点击 `Ready`
6. 房主点击“开始一手”

## 已实现功能
- 房间系统
- 创建/加入房间（roomId）
- 房间人数限制 2–10（满员提示）
- Ready / 房主开始一手
- 虚拟筹码系统
- 初始筹码（开局前由房主统一设置并锁定）
- 盲注 5/10
- `pot` / 当前最高下注 / 玩家当轮与本手投入
- 对局流程
- 发牌（每人 2 张）+ 公共牌（Flop/Turn/River）
- 下注轮（Preflop / Flop / Turn / River）
- 动作：check / call / raise / fold / all-in
- 边池结算（side pots）
- 摊牌与赢家结算（`pokersolver`）
- 实时同步与恢复
- 服务端权威状态机（server authoritative）
- 断线重连后全量状态同步（按 `roomId + playerId`）
- 微信分享友好（H5）
- 邀请链接复制按钮
- 支持 `?roomId=xxxx` 进入/重连房间
- 输光处理
- 玩家筹码归零后自动转为观战
- 可手动退出房间

## 未实现 / 已降级（MVP）
- 补码（rebuy）
- 锦标赛、多桌、AI 对手
- 微信 JS-SDK 原生分享配置（当前为“复制邀请链接”方案）
- 复杂扑克规则细节（例如完整最小加注重开规则的所有边缘牌例）仍为 MVP 简化实现

## 测试与验证
- 单元测试：边池构建与边池结算
```bash
npm test
```

- 手工联机验证（至少两窗口）：
  - 创建房间 -> 加入房间 -> Ready -> 开局
  - 完成一手（支持 all-in -> 摊牌）
  - 输光玩家自动观战 -> 退出房间

## 项目结构（关键文件）
- `src/app.js`：Socket.IO 服务端入口
- `src/engine/holdemRoom.js`：房间与对局状态机
- `src/engine/payout.js`：边池与摊牌结算
- `src/client/index.html`：H5 页面
- `src/client/main.js`：前端逻辑
- `src/client/style.css`：移动优先样式
- `PLAN.md`：本次实现计划与范围

## 许可
- 保留原上游仓库许可证（MIT）
