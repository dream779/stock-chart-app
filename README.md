# 美股指数行情看板

一个基于 Next.js + TypeScript + Lightweight Charts 的美股指数展示项目，查看标普 500、纳斯达克 100 指数的行情与历史走势。

## 功能特性

- 📈 实时展示 **标普 500**（`^GSPC`）和 **纳斯达克 100**（`^NDX`）指数数据
- 📊 使用 **Lightweight Charts** 绘制走势图
- ⏱️ 支持 **最近 1 周 / 1 个月 / 3 个月 / 1 年** 多个时间维度切换
- 🚀 已配置 **Vercel** 自动部署
- 🧪 支持 Mock 数据模式，方便本地开发和界面预览
- 💾 API 层内存缓存：行情数据缓存 2 分钟，历史数据缓存 1 小时，减少外部 API 调用

## 技术栈

- [Next.js 14](https://nextjs.org/)（App Router）
- [TypeScript](https://www.typescript.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [Lightweight Charts](https://tradingview.github.io/lightweight-charts/)
- [yahoo-finance2](https://github.com/gadicc/node-yahoo-finance2)

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

如果你所在的网络无法直接访问 Yahoo Finance，可以开启 Mock 数据模式：

```bash
USE_MOCK_DATA=true pnpm dev
```

开启后，所有行情数据将使用程序生成的模拟数据，方便你预览界面和调试功能。

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

### 注意事项

- 在 Vercel 上默认使用 **真实 Yahoo Finance 数据**，不需要设置 `USE_MOCK_DATA`
- Vercel 的 Serverless 环境在海外，通常可以正常访问 Yahoo Finance
- API 已内置缓存，行情缓存 2 分钟，历史数据缓存 1 小时
- 如果遇到 403 或访问失败，可以在 Vercel 的 Environment Variables 中设置 `USE_MOCK_DATA=true` 暂时切换到 Mock 模式

## 项目结构

```
stock-chart-app/
├── app/
│   ├── api/
│   │   ├── historical/[symbol]/   # 历史数据接口（带缓存）
│   │   ├── quote/[symbol]/        # 实时行情接口（带缓存）
│   │   └── indices/               # 标普500 + 纳斯达克100接口（带缓存）
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx                   # 主页面
├── components/
│   ├── Chart.tsx                  # Lightweight Charts 图表组件
│   ├── IndexCards.tsx             # 指数卡片
│   └── QuoteCard.tsx              # 行情卡片（已停用，保留备用）
├── lib/
│   └── yahoo.ts                   # Yahoo Finance 数据封装 + 缓存
├── next.config.js
├── package.json
├── tailwind.config.ts
├── tsconfig.json
├── vercel.json
└── README.md
```

## API 接口

| 接口                                   | 说明                         | 示例                           |
| -------------------------------------- | ---------------------------- | ------------------------------ |
| `GET /api/indices`                     | 获取标普500、纳斯达克100数据 | `/api/indices`                 |
| `GET /api/quote/:symbol`               | 获取单个标的实时行情         | `/api/quote/QQQ`               |
| `GET /api/historical/:symbol?range=1y` | 获取历史走势数据             | `/api/historical/VOO?range=1y` |

支持的时间范围：`1w`（1周）、`1m`（1个月）、`3m`（3个月）、`1y`（1年）

## 缓存说明

- **行情数据**（`/api/indices`、`/api/quote/:symbol`）：内存缓存 2 分钟
- **历史数据**（`/api/historical/:symbol`）：内存缓存 1 小时
- 缓存只在 Serverless 实例存活期间有效，实例冷启动后会重新获取
- Mock 数据模式下同样会缓存

## 后续可扩展

- [ ] 添加定投账本和收益率计算
- [ ] 添加 PWA 支持，可添加到手机主屏幕
- [ ] 接入 Capacitor 打包成原生 App
- [ ] 接入邮件/推送提醒
- [ ] 接入 Massive（原 Polygon.io）等更稳定的数据源

## 免责声明

本项目仅用于学习和个人参考，展示的数据来源于 Yahoo Finance，可能存在延迟。数据仅供参考，不构成任何投资建议。
