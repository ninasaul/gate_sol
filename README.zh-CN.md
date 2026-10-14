# GateSol

[English](./README.md) | **中文**

Solana 链 Meme 币纸面交易机器人，核心目标：**硬门槛过滤垃圾币**。

系统拆成 **六个智能模块**。开仓前完整跑筛选；巨鲸进场只观察、不买入。风控遵循非对称收益：快速斩断亏损，让利润奔跑。

架构为 **双进程**：

- **Bot**（`tsx`）：采集 / 筛选 / 纸面执行，并暴露 `BOT_API_PORT`（默认 3940）上的 `/api/state` 与 `/api/events`（SSE）
- **看板**（Next.js + Tailwind + TS）：端口 `WEB_PORT`（默认 3939），通过 rewrite 代理 API

---

## 六个智能模块

| # | 模块 | 文件 | 职责 |
|---|------|------|------|
| 1 | 数据采集器 | `src/modules/data-collector.ts` | 发现新币/新池子 |
| 2 | 安全审计器 | `src/modules/security-auditor.ts` | 貔貅、mint/freeze、metadata |
| 3 | 流动性校验器 | `src/modules/liquidity-checker.ts` | 流动性、LP 锁、池龄 |
| 4 | 持仓分析器 | `src/modules/holder-analyzer.ts` | 项目方、前 10、鲸鱼 |
| 5 | 策略引擎 | `src/modules/strategy-engine.ts` | `SKIP` / `OBSERVE` / `BUY` |
| 6 | 执行器 | `src/modules/executor.ts` | 纸面开仓、止损、移动止盈 |

```
数据源 → [1 采集] → [2 安全] → [3 流动性] → [4 持仓] → [5 策略] → [6 执行]
                              └────────── 三道硬性筛选 ──────────┘
```

## 开仓前筛选

| 规则 | 结果 |
|------|------|
| 流动性 &lt; 50,000 USD | 排除 |
| LP 未锁 / 未燃烧 | 不碰 |
| 项目方持仓 &gt; 7% | 跳过 |
| 前 10 持仓 &gt; 35% | 跳过 |
| 貔貅 / 未弃 mint·freeze | 排除 |
| 巨鲸进场（持仓 &gt;= 5%） | **仅观察** |
| 全部硬性通过 | 纸面买入 |

阈值均可在 `.env` 调整。

## 发现源（live）

`live` 模式下，默认使用 **链上日志扫链** 发现新币：

- Pump.fun 创建 事件
- Raydium AMM v4 `initialize2`、CPMM `CreatePool`

解析出的 mint 经 RugCheck + 报价富化后进入六模块流水线。

设置 `CHAIN_SCAN_ENABLED=false` 可回退到 GeckoTerminal `new_pools` 轮询。

**RPC 说明：** 公共 `mainnet-beta` 对 `logsSubscribe` / `getParsedTransaction` 很容易限流。建议使用 Helius、QuickNode 等支持 WebSocket 的节点。

## 交易 / 风控（纸面）

- 止损 `-10%`
- 涨幅 `+30%` 后改用移动止损 `-20%`（让利润奔跑）
- 最大同时持仓与仓位大小可通过环境变量配置

## 快速开始

```bash
# 安装依赖（本仓库使用本地 .pnpm-store）
pnpm install --store-dir .pnpm-store

cp .env.example .env

# 离线 demo（无 API，默认 RUN_DURATION_MS 后结束并写报告）
pnpm demo

# 双进程：Bot API + Next 看板（推荐）
pnpm dev
# 浏览器打开 http://localhost:3939

# live 链上数据 + 看板
pnpm dev:live

# 仅 Bot + API
pnpm bot:demo
pnpm bot:live

# 仅 Next（需先有 Bot API）
pnpm web

# 单测 / 类型检查 / Lint
pnpm test
pnpm typecheck
pnpm lint
```

运行时状态写入 **`data/runtime.json`**（重启可恢复持仓 / 成交 / 信号）；结束汇总仍写入 **`data/report.json`**。

## Web 看板

Next.js App Router + Tailwind 指挥台风格（支持深色 / 浅色主题）。

- 顶栏：运行模式、SSE 连接、时钟、主题切换
- 持仓、观察列表、拒绝原因、筛选阈值
- 盈利趋势图、实时信号流、成交记录

技术：Bot 进程提供 API/SSE；Next 通过 [`next.config.ts`](next.config.ts) rewrite 代理 `/api/*`。

## 配置

复制 `.env.example` 为 `.env`。关键项：

```bash
MODE=demo
SOLANA_RPC_URL=https://api.mainnet-beta.solana.com
CHAIN_SCAN_ENABLED=true
CHAIN_SCAN_PROGRAMS=pump,raydium
BOT_API_PORT=3940
WEB_PORT=3939
MIN_LIQUIDITY_USD=50000
REQUIRE_LP_LOCKED=true
MAX_DEV_HOLDING_PCT=7
WHALE_HOLDING_PCT=5
MOON_ACTIVATE_PCT=30
STOP_LOSS_PCT=10
TRAILING_STOP_PCT=20
MAX_CONCURRENT_POSITIONS=5
```

完整项见 [`.env.example`](./.env.example)。

## 目录结构

```
src/                 # Bot 核心（六模块 + Pipeline + API）
app/                 # Next.js App Router
components/          # 看板 React 组件
lib/                 # 前端工具与图标
tests/               # vitest 单测
data/                # runtime.json / report.json
public/assets/       # 静态资源
```

## 从纸面到实盘

当前为纸面交易：`executor.ts` 不接触私钥。实盘需：

1. 更可靠的实时数据源（付费 RPC + 交易流）
2. Jupiter Swap 接入
3. 私钥仅通过环境变量注入，切勿提交到仓库

交易有风险。建议先用纸面模式长期验证胜率与盈亏因子。

## License

MIT
