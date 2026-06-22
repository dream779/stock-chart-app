# 美股基金行情看板

一个基于 Next.js + TypeScript + Lightweight Charts 的自选基金行情展示项目，查看基金净值、估算涨跌幅与历史走势。

## 功能特性

- 📊 使用 **Lightweight Charts** 绘制走势图
- ⏱️ 支持 **最近 1 周 / 1 个月 / 3 个月 / 1 年** 多个时间维度切换
- 🏦 基金自选：输入基金代码加入自选列表，查看净值、估算净值与涨跌幅
- 📉 基金详情：查看自选基金历史净值走势，支持周期切换
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

## 免责声明

本项目仅用于学习和个人参考，展示的数据来源于天天基金（东方财富），可能存在延迟。数据仅供参考，不构成任何投资建议。
