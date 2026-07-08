# 美股基金行情看板

一个基于 Next.js + TypeScript + Lightweight Charts 的自选基金行情展示项目，查看基金净值、估算涨跌幅与历史走势。

## 功能特性

- 📊 使用 **Lightweight Charts** 绘制走势图
- ⏱️ 支持 **最近 1 周 / 1 个月 / 3 个月 / 1 年** 多个时间维度切换
- 🏦 基金自选：输入基金代码加入自选列表，查看净值、估算净值与涨跌幅
- 📉 基金详情：查看自选基金历史净值走势，支持周期切换
- 🧾 持仓收益：录入持仓份额/成本，记录每日收益快照；添加持仓只需填基金代码，名称由东方财富自动查询写入
- 🚀 已配置 **Vercel** 自动部署
- 🧪 支持 Mock 数据模式，方便本地开发和界面预览
- 💾 API 层内存缓存：行情数据缓存 2 分钟，历史数据缓存 1 小时，减少外部 API 调用

## 技术栈

- [Next.js 14](https://nextjs.org/)（App Router）
- [TypeScript](https://www.typescript.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)

## 本地开发

### 1. 安装依赖

```bash
pnpm install
```

### 2. 启动开发服务器

```bash
pnpm dev
```

访问 http://localhost:3000

### 3. Mock 数据模式（可选）

如果你所在的网络无法直接访问天天基金（东方财富），可以开启 Mock 数据模式：

```bash
USE_MOCK_DATA=true pnpm dev
```

开启后，基金数据将使用程序生成的模拟数据，方便你预览界面和调试功能。基金 Mock 数据预置了 `017641`、`016452` 两只基金的基础净值与名称。

## 部署到 Vercel

### 方式一：通过 Vercel CLI

```bash
# 全局安装 Vercel CLI
npm i -g vercel

# 登录并部署
cd stock-chart-app
vercel
```

### 方式二：通过 GitHub + Vercel 自动部署（推荐）

1. 把本项目推送到 GitHub
2. 登录 [Vercel Dashboard](https://vercel.com/dashboard)
3. 点击 "Add New Project"，选择你的仓库
4. 框架预设选择 **Next.js**
5. 点击 Deploy

## 注意事项

- API 已内置缓存，行情缓存 2 分钟，历史数据缓存 1 小时
- 如果遇到天天基金接口访问失败，可以在 Vercel 的 Environment Variables 中设置 `USE_MOCK_DATA=true` 暂时切换到 Mock 模式

## 项目结构

```
stock-chart-app/
├── app/
│   ├── api/
│   │   ├── dca/                          # 定投相关接口
│   │   │   ├── route.ts                  # 定投计划 CRUD
│   │   │   ├── returns/route.ts          # 定投收益汇总
│   │   │   ├── settle/route.ts           # 手动结算
│   │   │   ├── snapshot/route.ts         # 当日净值快照
│   │   │   └── today-gain/route.ts       # 当日收益
│   │   ├── fund/                         # 基金接口（带缓存）
│   │   │   ├── [code]/route.ts           # 单只基金实时估值/净值
│   │   │   └── historical/[code]/route.ts # 基金历史净值
│   │   ├── holdings/route.ts             # 持仓收益接口
│   │   └── watchlist/route.ts            # 自选基金接口
│   ├── fund/[code]/page.tsx              # 基金详情页
│   ├── holdings/page.tsx                 # 持仓收益页
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                          # 自选基金首页
├── components/
│   ├── Chart.tsx                          # Lightweight Charts 图表组件
│   ├── DcaPlanSection.tsx                 # 定投计划区块
│   ├── DcaStatusBadge.tsx                 # 定投状态徽标
│   ├── FundTable.tsx                      # 基金自选表格
│   ├── HoldingForm.tsx                    # 持仓表单
│   ├── HoldingsSummary.tsx                # 持仓汇总
│   ├── HoldingsTable.tsx                  # 持仓明细表
│   ├── NavBar.tsx                         # 顶部导航栏
│   ├── QuoteCard.tsx                      # 行情卡片
│   └── ReturnHistoryChart.tsx             # 收益历史图表
├── lib/
│   ├── db.ts                              # 低文件 KV 持久化
│   ├── dca.ts                             # 定投领域逻辑
│   ├── dca-api.ts                         # 定投接口封装
│   ├── dca-history.ts                     # 定投历史聚合
│   ├── eastmoney.ts                       # 天天基金数据封装 + 缓存
│   ├── holdings.ts                        # 持仓领域逻辑
│   ├── holdings-api.ts                    # 持仓接口封装
│   └── watchlist-api.ts                   # 自选基金接口封装
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── README.md
```

## API 接口

| 接口                                      | 说明                         | 示例                                   |
| ----------------------------------------- | ---------------------------- | -------------------------------------- |
| `GET /api/fund/:code`                     | 获取单只基金实时估值与净值   | `/api/fund/017641`                     |
| `GET /api/fund/historical/:code?range=1y` | 获取基金历史净值走势         | `/api/fund/historical/017641?range=1m` |
| `POST /api/ai/summarize`                  | 调用 MiniMax M3 生成基金总结 | `/api/ai/summarize`                    |
| `GET /api/summaries`                      | 总结页数据：按天分组的最近 14 天卡片 | `/api/summaries`                       |
| `POST /api/summaries/regenerate`          | 手动重跑今日所有基金的总结（UPSERT） | `/api/summaries/regenerate`           |

支持的时间范围：`1w`（1周）、`1m`（1个月）、`3m`（3个月）、`1y`（1年）

## 缓存说明

- **行情数据**（`/api/fund/:code`）：内存缓存 2 分钟
- **历史数据**（`/api/fund/historical/:code`）：内存缓存 1 小时
- 缓存只在 Serverless 实例存活期间有效，实例冷启动后会重新获取
- Mock 数据模式下同样会缓存

## 后续可扩展

- [ ] 添加定投账本和收益率计算
- [ ] 添加 PWA 支持，可添加到手机主屏幕
- [ ] 接入 Capacitor 打包成原生 App
- [ ] 接入邮件/推送提醒
- [ ] 接入 Massive（原 Polygon.io）等更稳定的数据源

## AI 总结（开发中）

每日基金复盘由 MiniMax `MiniMax-M3` 模型生成，调用方需在服务端配置以下环境变量（参考 `.env.example`）：

```bash
ANTHROPIC_BASE_URL=https://api.minimaxi.com/anthropic
ANTHROPIC_API_KEY=<your-minimax-api-key>
```

调用示例：

```bash
curl -sS -X POST http://localhost:3000/api/ai/summarize \
  -H 'Content-Type: application/json' \
  -d '{
    "fundCode": "017641",
    "fundName": "广发中证光伏产业指数A",
    "context": "今日光伏板块上涨 1.5%，硅料价格小幅回落，海外贸易摩擦有升温迹象。"
  }' | jq
```

成功响应会包含 `sections.summary` / `sections.advice` / `sections.table` 与 `usage`。模型输出仅供参考，不构成任何投资建议。

### 每日总结页面

定时调度当前已暂停，不会自动生成。需要在 `/summaries` 页面手动点击右上角「重跑今日」按钮（POST `/api/summaries/regenerate`）才会给每只持仓基金生成 AI 总结，保存到 `fund_summaries` 表，保留 14 天后清理。

- 入口：`/summaries`
- 手动重跑：页面右上角「重跑今日」按钮（POST `/api/summaries/regenerate`），会跳过节假日跳过逻辑并强制覆盖当日记录
- 卡片删除：每张卡片头部「删除本日」可物理清除该日所有基金记录（不可恢复，确认后删除）
- 节假日行为：法定节假日跳过；周末照常生成（基于 `chinese-days` + BJT 周末判定）
- **数据源**：每只基金先抓取东方财富移动 API（基金基本信息 + 阶段收益 + 经理持仓/主题），再用 Tavily 搜索近 7 天新闻，最后注入 prompt 一起交给 LLM 生成总结。LLM 仅整合，不外推。

Vercel 部署需配置环境变量：

| 变量 | 必需 | 说明 |
| --- | --- | --- |
| `ANTHROPIC_API_KEY` | 是 | MiniMax M3 API Key |
| `ANTHROPIC_BASE_URL` | 是 | `https://api.minimaxi.com/anthropic` |
| `TAVILY_API_KEY` | 否 | Tavily Search API key（https://tavily.com 免费 1000 req/月）。缺省则 news 区块静默跳过，summary 仍正常生成 |

## 免责声明

本项目仅用于学习和个人参考，展示的数据来源于天天基金（东方财富），可能存在延迟。数据仅供参考，不构成任何投资建议。
