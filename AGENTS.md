# AGENTS.md

本文档面向 AI 编程助手。如果你刚刚拿到这个项目，请先阅读本文，了解项目结构、技术栈、构建方式和开发约定。

## 项目概述

`stock-chart-app` 是一个美股指数行情看板，基于 Next.js 14 + TypeScript + Tailwind CSS 构建。前端使用 [Lightweight Charts](https://tradingview.github.io/lightweight-charts/) 绘制走势图，后端通过 [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2) 获取标普 500（`^GSPC`）和纳斯达克 100（`^NDX`）的实时行情与历史数据；场外基金数据来自天天基金（`fundgz.1234567.com.cn` 与 `fund.eastmoney.com`）。

主要功能：

- 展示标普 500、纳斯达克 100 的实时行情卡片
- 支持在最近 1 周 / 1 个月 / 3 个月 / 1 年之间切换历史走势
- 使用 Lightweight Charts 绘制面积图
- 基金自选：输入基金代码加入自选列表，表格展示净值、估算净值与涨跌幅；数据持久化到服务端 Postgres
- 基金详情：点击自选基金查看历史净值走势，支持 1 周 / 1 个月 / 3 个月 / 1 年 周期切换
- 持仓收益：录入基金持仓（份额、持仓成本价），系统按当前 NAV 实时计算确认市值、持有收益、收益率；数据持久化到服务端 Postgres
- **定投跟踪（DCA）**：对每只持仓可绑定一个定投计划（每日 / 每周 / 每月 + 金额 + 开始日期 + T+1 / T+2 确认日），打开 `/holdings` 页面时自动按 FIFO 结算已到确认日的期次、重算加权平均成本价、把「待确认」金额结转为「已确认」份额
- **历史收益持久化**：每次结算后往 `daily_returns` 表写一行快照（NAV、市值、成本、收益、收益率），2 年后即便外部数据源不再可用，自有数据库也保留完整收益曲线
- 内置内存缓存，减少外部 API 调用
- 提供 Mock 数据模式，便于本地开发和界面预览

## 技术栈

- **框架**：Next.js 14（App Router）
- **语言**：TypeScript 5.4
- **样式**：Tailwind CSS 3.4 + PostCSS + autoprefixer
- **图表**：lightweight-charts 4.x
- **数据源**：yahoo-finance2 3.x
- **数据库**：Vercel Marketplace Neon Postgres（通过 `@vercel/postgres` SDK 访问，存持仓、定投计划、定投期次、每日收益快照）
- **时间处理**：dayjs（持仓、定投、节假日计算）
- **节假日感知**：[chinese-days](https://github.com/vsme/chinese-days) — T+1 / T+2 结算日计算时跳过周末 + 法定节假日 + 调休补班
- **包管理器**：pnpm
- **代码检查**：ESLint 8（`eslint-config-next` + `eslint-config-prettier`）
- **代码格式化**：Prettier 3
- **部署平台**：Vercel（已通过 `vercel.json` 配置）

## 目录结构

```
stock-chart-app/
├── app/                          # Next.js App Router
│   ├── api/                      # API Routes（服务端）
│   │   ├── fund/                 # 基金接口
│   │   │   ├── [code]/           # 单只基金实时估值/净值
│   │   │   └── historical/[code]/ # 基金历史净值
│   │   ├── dca/                  # 定投接口
│   │   │   ├── route.ts          # 定投计划 CRUD（GET/POST/DELETE）
│   │   │   ├── settle/route.ts   # POST { code }：结算 T+N 期次 + 写快照
│   │   │   └── returns/route.ts  # GET ?code=&range=：返回 daily_returns 数组
│   │   ├── historical/[symbol]/  # 获取历史数据
│   │   ├── holdings/             # 持仓 CRUD（GET/POST/DELETE，连 Postgres）
│   │   ├── watchlist/            # 自选基金 CRUD（GET/POST/DELETE，连 Postgres）
│   │   ├── indices/              # 获取标普 500 + 纳斯达克 100 行情
│   │   └── quote/[symbol]/       # 获取单个标的行情
│   ├── fund/                     # 基金页面
│   │   ├── page.tsx              # 基金自选列表页
│   │   └── [code]/               # 基金详情页（动态路由）
│   │       └── page.tsx
│   ├── holdings/                 # 持仓收益页面
│   │   └── page.tsx              # 持仓收益主页面（mount 时 fan-out 触发 /api/dca/settle）
│   ├── globals.css               # 全局样式 + Tailwind 指令
│   ├── layout.tsx                # 根布局
│   └── page.tsx                  # 首页（客户端组件）
├── components/                   # React 组件
│   ├── Chart.tsx                 # Lightweight Charts 走势图组件
│   ├── FundTable.tsx             # 基金自选表格
│   ├── HoldingsSummary.tsx       # 持仓总览卡片（总资产 / 持有收益 / 收益率 / 待确认）
│   ├── HoldingsTable.tsx         # 持仓明细表格（点击行展开历史收益图）
│   ├── HoldingForm.tsx           # 添加/编辑持仓表单（嵌入 DcaPlanSection）
│   ├── DcaPlanSection.tsx        # 定投计划子表单（金额 / 频率 / 起始日 / T+1·T+2）
│   ├── DcaStatusBadge.tsx        # 表格行内的「定投」徽标 + 待确认信息
│   ├── ReturnHistoryChart.tsx    # 单只基金历史收益曲线（基于 daily_returns）
│   ├── IndexCards.tsx            # 指数行情卡片列表
│   ├── NavBar.tsx                # 顶部导航栏
│   └── QuoteCard.tsx             # 单个行情卡片（当前未使用，保留备用）
├── lib/                          # 工具库/数据层
│   ├── eastmoney.ts              # 天天基金数据获取、解析、缓存和 Mock
│   ├── holdings.ts               # 持仓类型 + 收益计算（calculateHolding / calculateSummary）
│   ├── holdings-api.ts           # 持仓 API 客户端封装（调用 /api/holdings）
│   ├── dca.ts                    # 定投引擎：类型、generatePeriodDates、addBusinessDays（chinese-days）、settlePlanForCode、writeDailySnapshot、getReturnHistory
│   ├── dca-api.ts                # 定投 API 客户端封装（调用 /api/dca, /api/dca/settle）
│   ├── dca-history.ts            # 历史收益 API 客户端封装（调用 /api/dca/returns）
│   ├── watchlist-api.ts          # 自选基金 API 客户端封装（调用 /api/watchlist）
│   ├── db.ts                     # Postgres 客户端与建表（holdings / watchlist / dca_plans / dca_transactions / daily_returns）
│   └── yahoo.ts                  # Yahoo Finance 封装、缓存和 Mock 数据
├── public/                       # 静态资源
├── next.config.js                # Next.js 配置
├── tailwind.config.ts            # Tailwind 配置
├── tsconfig.json                 # TypeScript 配置
├── .eslintrc.json                # ESLint 配置
├── .prettierrc.json              # Prettier 配置
├── .prettierignore               # Prettier 忽略文件
├── postcss.config.js             # PostCSS 配置
├── vercel.json                   # Vercel 部署配置
└── package.json                  # 依赖与脚本
```

## 构建与运行命令

本项目使用 `pnpm` 作为包管理器。

```bash
# 安装依赖
pnpm install

# 本地开发服务器（默认 http://localhost:3000）
pnpm dev

# 生产构建
pnpm build

# 启动生产服务器（需先执行 build）
pnpm start

# ESLint 检查
pnpm lint

# 自动修复 ESLint 可修复的问题
pnpm lint:fix

# Prettier 格式化全部文件
pnpm format

# 检查 Prettier 格式（CI 常用）
pnpm format:check
```

> **注意**：ESLint 配置继承自 `next/core-web-vitals` 和 `next/typescript`，并通过 `eslint-config-prettier` 关闭与 Prettier 冲突的规则。`pnpm lint` 会检查类型相关规则（如 `@typescript-eslint/no-unused-vars`）和 Next.js 推荐规则；`pnpm format` 会按 `.prettierrc.json` 格式化项目文件。

构建时页面会尝试静态生成并调用 `/api/indices`。如果当前网络无法访问 Yahoo Finance，构建日志中会出现 `Failed to get crumb, status 403` 等报错，但通常不影响构建产物本身。若需要避免此问题，可在构建时开启 Mock 模式：

```bash
USE_MOCK_DATA=true pnpm build
```

## Mock 数据模式

当网络无法访问 Yahoo Finance 或需要稳定数据做 UI 调试时，可开启 Mock 模式：

```bash
USE_MOCK_DATA=true pnpm dev
USE_MOCK_DATA=true pnpm build
```

在 Vercel 中可通过环境变量 `USE_MOCK_DATA=true` 开启。Mock 数据逻辑位于 `lib/yahoo.ts`，包含 `mockQuote()` 和 `generateMockHistory()`，会为常见标的（`^GSPC`、`^NDX`、QQQ、VOO、SPY、AAPL 等）生成模拟价格与历史走势。

基金 Mock 数据预置了 `017641`、`016452` 两只基金的基础净值与名称，便于本地预览。

## API 接口

| 路由                                   | 方法 | 说明                                   |
| -------------------------------------- | ---- | -------------------------------------- |
| `/api/indices`                         | GET  | 返回标普 500 + 纳斯达克 100 的行情数组 |
| `/api/quote/[symbol]`                  | GET  | 返回单个标的实时行情                   |
| `/api/historical/[symbol]?range=1y`    | GET  | 返回指定时间范围的历史走势数据         |
| `/api/fund/[code]`                     | GET  | 返回单只基金的实时估值与净值           |
| `/api/fund/historical/[code]?range=1y` | GET  | 返回基金历史净值走势                   |
| `/api/holdings`                         | GET  | 返回所有持仓                            |
| `/api/holdings`                         | POST | 新增或更新持仓（按 code upsert）        |
| `/api/holdings?code=xxx`                | DELETE | 删除指定 code 的持仓                  |
| `/api/watchlist`                        | GET  | 返回自选基金代码列表（按 added_at DESC）|
| `/api/watchlist`                        | POST | 添加自选基金（body `{code}`，6 位数字校验）|
| `/api/watchlist?code=xxx`               | DELETE | 从自选中移除指定 code                |
| `/api/dca`                              | GET  | 返回所有 active 定投计划 + 每只的待确认笔数和金额 |
| `/api/dca`                              | POST | 新增或更新定投计划（`{code, amountPerPeriod, frequency, startDate, confirmationDays}`，1-5 之间）|
| `/api/dca?code=xxx`                     | DELETE | 软删指定 code 的定投计划（`active=false`，保留历史 dca_transactions）|
| `/api/dca/settle`                       | POST | 结算指定 code 的 T+N 已到期期次 + 写当日快照（`{code}`，返回 `{settled, pendingCount, pendingAmount, nav}`）|
| `/api/dca/returns?code=xxx&range=3m`    | GET  | 返回 `daily_returns` 中该 code 的历史快照（`range` ∈ `1m` `3m` `6m` `1y` `all`）|

支持的时间范围：`1w`、`1m`、`3m`、`1y`（代码中同时保留 `6m`、`5y` 的处理但未在前端展示）。

接口统一返回格式：

```json
{ "success": true, "data": [...] }
```

或错误时：

```json
{ "success": false, "error": "...", "message": "..." }
```

## 缓存策略

`lib/yahoo.ts` 和 `lib/eastmoney.ts` 中均实现了简单的内存缓存（`Map<string, CacheItem>`）：

- 美股行情数据（quote）：缓存 2 分钟（`QUOTE_TTL = 2 * 60 * 1000`）
- 美股历史数据（historical）：缓存 1 小时（`HISTORICAL_TTL = 60 * 60 * 1000`）
- 基金行情数据：缓存 2 分钟
- 基金历史数据：缓存 1 小时

缓存仅在 Serverless 实例存活期间有效，实例冷启动后缓存失效。Mock 模式下同样会走缓存逻辑。

## 定投跟踪（DCA）与历史收益持久化

每只持仓可以绑定一个定投计划（`dca_plans`），自动维护每期的生成、结算与状态机。核心数据流：

```
打开 /holdings 页面
  ├─ GET /api/holdings → 当前 holdings 列表
  ├─ GET /api/dca → 当前 active 定投计划 + pending 汇总
  ├─ 对每只持仓 POST /api/dca/settle
  │    └─ lib/dca.ts: settlePlanForCode(code, today)
  │         ├─ 1. backfillMissingTransactions(plan, today)
  │         │    └─ 生成 [start_date, min(today, start_date+365d)] 内尚未存在的
  │         │       交易日期（按 daily / weekly / monthly 频率），跳过非交易日
  │         ├─ 2. 找出 pending 中确认日 ≤ today 的候选项（FIFO 升序）
  │         │    └─ 确认日 = chinese-days.findWorkday(transaction_date, confirmationDays)
  │         │       跳过周末 + 法定节假日 + 调休
  │         ├─ 3. 对每个候选项按当前 NAV 结算：
  │         │    shares_added = amount / nav
  │         │    new_cost = (old_cost × old_shares + amount) / new_shares
  │         │    UPDATE dca_transactions SET status='settled' ...
  │         │    UPDATE holdings SET shares, cost_price = ...
  │         └─ 4. writeDailySnapshot(code, today, nav)
  │              └─ INSERT INTO daily_returns ... ON CONFLICT (code, snapshot_date) DO NOTHING
  └─ 重新拉取 holdings + dca，更新 UI，显示「本次自动结算 N 期」banner
```

关键设计点：
- **T+1 / T+2 动态**：`dca_plans.confirmation_days`（1-5），表单让用户选 T+1 / T+2
- **节假日**：`chinese-days` 的 `isWorkday` / `findWorkday` 自动跳过周末 + 法定节假日
- **成本加权平均**：每次结算重算 `(old_cost × old_shares + dca_amount) / new_shares`
- **历史收益独立存储**：`daily_returns` 表每日一行，2 年后即便外部 NAV 接口失效，自有数据也保留完整收益曲线
- **快照幂等**：`UNIQUE (code, snapshot_date)` + `ON CONFLICT DO NOTHING`，同一天重复打开页面不会重复写
- **软删计划**：`DELETE /api/dca?code=xxx` 只把 `active` 置 false，历史 `dca_transactions` 保留
- **级联清理**：删除 holding 时 `dca_plans` / `dca_transactions` / `daily_returns` 通过 `ON DELETE CASCADE` 自动清理

## 代码组织约定

- **App Router 路由**：API 放在 `app/api/**/route.ts`，页面放在 `app/page.tsx`，布局放在 `app/layout.tsx`。
- **客户端组件**：所有 React 组件和 `page.tsx` 都使用 `"use client"` 指令，因为需要浏览器 API（fetch、`ResizeObserver`、DOM 操作等）。
- **服务端数据层**：`lib/yahoo.ts` 负责与 Yahoo Finance 交互、数据转换、缓存和 Mock；`lib/eastmoney.ts` 负责天天基金接口的抓取、JSONP/JS 文本解析、缓存和 Mock；`lib/dca.ts` 负责定投引擎（生成期次、计算确认日、结算、写快照）；`lib/holdings.ts` 负责持仓收益计算（`calculateHolding` / `calculateSummary`）；`lib/holdings-api.ts` / `lib/dca-api.ts` / `lib/dca-history.ts` / `lib/watchlist-api.ts` 负责调用各自 API 读写服务端 Postgres；`lib/db.ts` 导出共享的 `sql` 客户端与 `ensureSchema()`，统一管理所有表结构。API Routes 只负责参数解析和 HTTP 响应。
- **路径别名**：`tsconfig.json` 中配置 `"@/*": ["./*"]`，导入项目内部模块时优先使用 `@/components/...`、`@/lib/...`。
- **TypeScript**：启用 `strict: true`，使用类型别名定义组件 Props 和接口。
- **ESLint/Prettier**：提交前建议运行 `pnpm lint` 和 `pnpm format:check`；本地开发可使用 `pnpm format` 自动统一代码风格。
- **样式**：优先使用 Tailwind 工具类，全局样式仅在 `app/globals.css` 中定义。

## 颜色与涨跌语义

项目中沿用 A 股/港股习惯：

- **红色（red-600 / bg-red-50）**：表示上涨/正收益
- **绿色（green-600 / bg-green-50）**：表示下跌/负收益

相关样式统一在 `IndexCards.tsx` 和 `Chart.tsx` 中通过 `isPositive` 条件类名控制，不要误用为西方市场的绿涨红跌。

## 环境变量

| 变量名          | 说明                                                | 默认值  |
| --------------- | --------------------------------------------------- | ------- |
| `USE_MOCK_DATA` | 设置为 `true` 时启用 Mock 数据模式                  | `false` |
| `POSTGRES_URL` 等  | Vercel Marketplace Neon 集成自动注入，无需手动配置 | - |

本地开发时通过 `.env.local` 设置（已被 `.gitignore` 忽略）：

```bash
USE_MOCK_DATA=true
```

Vercel 部署时可在 Project Settings > Environment Variables 中配置。Neon 集成（Storage > Neon）已通过 Vercel Marketplace 安装，会自动向 Production / Preview / Development 注入 `POSTGRES_URL` / `POSTGRES_PRISMA_URL` / `POSTGRES_URL_NON_POOLING` / `POSTGRES_USER` / `POSTGRES_PASSWORD` / `POSTGRES_HOST` / `POSTGRES_DATABASE` 等变量。首次访问任一数据接口时由 `lib/db.ts` 的 `ensureSchema()` 自动建表（`CREATE TABLE IF NOT EXISTS`），目前包含 5 张表：

- `holdings`（持仓）— `code` PK，含 `shares` / `cost_price` 等字段
- `watchlist`（自选基金代码）— `code` PK + `added_at`
- `dca_plans`（定投计划）— `code` FK，含 `amount_per_period` / `frequency` / `start_date` / `confirmation_days` / `active`，对 `code` 唯一活跃计划加 `UNIQUE WHERE active=TRUE` 约束
- `dca_transactions`（定投期次账本）— `plan_id` FK，含 `transaction_date` / `amount` / `status` / `settled_at` / `nav_at_settle` / `shares_added`，`(plan_id, transaction_date)` 唯一
- `daily_returns`（每日收益快照）— `code` + `snapshot_date` 唯一，含 `nav` / `settled_shares` / `settled_market_value` / `cost_price` / `total_cost` / `pending_amount` / `pending_count` / `realized_gain` / `gain_rate`

`holdings` 表的 `amount` 和 `pending_amount` 列保留但不读（早期版本字段），后续迁移会 `DROP COLUMN`。

## 测试策略

当前项目 **没有配置测试框架和测试文件**。若后续需要添加测试，推荐按以下方向引入：

- 单元测试：`lib/yahoo.ts`、`lib/eastmoney.ts` 中的 `getPeriodStart`、`formatDate`、Mock 数据生成逻辑；`lib/dca.ts` 中的 `generatePeriodDates`（日/周/月）、`addBusinessDays`（chinese-days 集成）、`isTradingDay`、FIFO 结算算法
- 组件测试：`IndexCards`、`Chart`、`FundTable`、`NavBar`、`HoldingsSummary`、`HoldingsTable`、`HoldingForm`、`DcaPlanSection`、`DcaStatusBadge`、`ReturnHistoryChart` 等 UI 组件
- API 测试：基金相关 API Routes（`/api/fund/[code]`、`/api/fund/historical/[code]`）、定投相关（`/api/dca` `/api/dca/settle` `/api/dca/returns`）及原有指数 API 的响应格式和缓存行为
- 集成测试：定投场景覆盖（按日 / 按周 / 按月、T+1 / T+2、跨春节/国庆的节假日、连续多日幂等）

常见可选方案：Jest + React Testing Library，或 Vitest。

## 安全与部署注意事项

- **不要提交 `.env.local`**：已包含在 `.gitignore` 中。
- **不要提交 `.env*` 文件**：包含 `POSTGRES_*` 凭据，已在 `.gitignore` 中忽略。
- **数据源依赖**：Yahoo Finance 在国内部分网络环境下可能 403/无法访问。生产部署在 Vercel（海外 Serverless）通常可正常访问；若不可用，请切到 Mock 模式。
- **缓存非持久化**：Serverless 冷启动会清空内存缓存，极端情况下可能重新触发外部 API 请求。
- **没有认证/授权**：当前 API 全部公开，不要在此项目中处理敏感金融账户或个人隐私数据。
- **免责声明**：本项目仅用于学习参考，数据存在延迟，不构成投资建议。

## Vercel 部署

`vercel.json` 已配置框架为 `nextjs`：

```json
{
  "framework": "nextjs",
  "buildCommand": "next build",
  "devCommand": "next dev",
  "installCommand": "pnpm install"
}
```

推荐通过 GitHub + Vercel 自动部署。首次部署时选择 Next.js 框架预设即可，无需额外配置。

## 修改前必读

- 修改 API 响应格式时，请同步更新 `README.md` 中的 API 说明和本文件。
- 修改缓存时间或新增 Yahoo Finance / 天天基金 API 调用时，注意 Serverless 内存/执行时间限制。
- 若新增指数或标的，除了在 `app/api/indices/route.ts` 和 `app/page.tsx` 的 `INDICES` 数组中添加，还应在 `lib/yahoo.ts` 的 `getMockBasePrice` 中补充 Mock 基础价，保证 Mock 模式可用。
- 若新增基金或标的，应在 `lib/eastmoney.ts` 的 `MOCK_FUND_BASE` 中补充 Mock 基础价与名称，保证 Mock 模式可用。
- 修改 `lib/dca.ts` 的 `settlePlanForCode` 或 `generatePeriodDates` 时，注意**幂等性**：已 `settled` 的行不会被二次处理；已 `recorded` 的快照不会重复写。新加状态前确认不会破坏 FIFO 顺序与快照去重。
- 修改 `dca_plans` schema（如新增列、调整 CHECK 约束）时，记得同步更新 `HoldingForm` 表单字段、`DcaPlanSection` 子组件、以及「`hasExistingPlan` 时锁定 shares/costPrice」的逻辑。
- 删除 holding 时 `dca_plans` / `dca_transactions` / `daily_returns` 通过 `ON DELETE CASCADE` 自动清，不要在 holding route 中手动 cascade。
