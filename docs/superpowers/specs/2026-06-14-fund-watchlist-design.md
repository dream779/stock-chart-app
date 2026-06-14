# 基金自选模块设计文档

## 1. 背景与目标

当前 `stock-chart-app` 仅支持美股指数（标普 500、纳斯达克 100）的行情与历史走势。用户希望增加**中国公募基金**的查看能力：

- 通过基金代码查找基金并加入自选列表。
- 列表以表格形式展示基金基本信息与最新涨跌幅。
- 点击列表项进入基金详情页，查看历史净值走势，并支持周期切换。

本设计文档描述基金自选模块的实现方案，数据源采用天天基金（东方财富）公开接口。

## 2. 设计原则

- **职责分离**：美股指数与基金功能拆分为独立页面，使用 Next.js App Router 路由。
- **服务端代理**：天天基金接口为 JSONP/JS 文本，且存在跨域限制，统一通过 Next.js API Routes 在服务端抓取并解析。
- **复用现有能力**：复用 `Chart.tsx` 组件与现有缓存机制，保持 UI 风格一致。
- **Mock 兜底**：保留 `USE_MOCK_DATA=true` 模式，确保网络不可达或构建时仍可正常运行。
- **本地持久化**：自选基金列表保存在浏览器 `localStorage` 中。

## 3. 页面与路由

新增后共 3 个页面：

| 路由           | 页面           | 说明                                           |
| -------------- | -------------- | ---------------------------------------------- |
| `/`            | 美股指数页     | 现有功能，仅增加顶部导航栏                     |
| `/fund`        | 基金自选列表页 | 表格展示自选基金，支持添加/删除                |
| `/fund/[code]` | 基金详情页     | 展示单只基金基本信息 + 历史净值图表 + 周期切换 |

## 4. API 设计

统一返回格式：

```json
{ "success": true, "data": {...} }
```

错误时：

```json
{ "success": false, "error": "...", "message": "..." }
```

### 4.1 获取单只基金实时估值/净值

- **路由**：`GET /api/fund/[code]`
- **示例**：`/api/fund/017641`
- **数据来源**：`http://fundgz.1234567.com.cn/js/{code}.js?rt={timestamp}`
- **返回字段**：

```json
{
  "success": true,
  "data": {
    "code": "017641",
    "name": "基金名称",
    "nav": 1.2345,
    "estimatedNav": 1.236,
    "changePercent": 0.12,
    "navDate": "2024-06-13",
    "estimateTime": "2024-06-14 15:00",
    "lastUpdated": "2024-06-14T07:00:00.000Z"
  }
}
```

### 4.2 获取基金历史净值

- **路由**：`GET /api/fund/historical/[code]?range=1m`
- **示例**：`/api/fund/historical/017641?range=1y`
- **数据来源**：`http://fund.eastmoney.com/pingzhongdata/{code}.js?v={timestamp}`
- **范围**：`1w`、`1m`、`3m`、`1y`
- **返回字段**：

```json
{
  "success": true,
  "data": [
    { "time": "2024-06-10", "value": 1.23 },
    { "time": "2024-06-11", "value": 1.235 }
  ]
}
```

## 5. 后端数据层

新增 `lib/eastmoney.ts`，与 `lib/yahoo.ts` 对称：

- `getFundQuote(code: string): Promise<FundQuoteData>`
  - 请求 `fundgz.1234567.com.cn/js/{code}.js`。
  - 解析 JSONP 回调 `jsonpgz(...)` 中的 JSON 数据。
  - 字段映射：
    - `fundcode` → `code`
    - `name` → `name`
    - `dwjz` → `nav`
    - `gsz` → `estimatedNav`
    - `gszzl` → `changePercent`
    - `jzrq` → `navDate`
    - `gztime` → `estimateTime`

- `getFundHistory(code: string, range: string): Promise<HistoricalPoint[]>`
  - 请求 `fund.eastmoney.com/pingzhongdata/{code}.js`。
  - 使用正则提取 `Data_netWorthTrend = [...]` 数组。
  - 数组项 `{ x: timestamp, y: nav }`，转换为 `{ time: 'YYYY-MM-DD', value: nav }`。
  - 根据 `range` 过滤起始日期。

- 缓存策略：
  - 基金实时估值：缓存 2 分钟。
  - 基金历史净值：缓存 1 小时。

- Mock 数据：
  - 在 `USE_MOCK_DATA=true` 时返回模拟数据。
  - 为预置基金 `017641`、`016452` 提供 Mock 基础价与名称。

## 6. 组件结构

### 6.1 新增组件

| 组件                       | 说明                                       |
| -------------------------- | ------------------------------------------ |
| `components/NavBar.tsx`    | 顶部导航栏，包含“美股指数”和“基金”两个入口 |
| `components/FundTable.tsx` | 基金自选表格 + 添加基金输入框              |

### 6.2 复用组件

- `Chart.tsx`：基金详情页的历史净值走势图。

### 6.3 页面文件

- `app/fund/page.tsx`：基金自选列表页。
- `app/fund/[code]/page.tsx`：基金详情页。
- `app/page.tsx`：加入 `NavBar`，其余逻辑不变。

## 7. UI/UX 设计

### 7.1 顶部导航

- 固定在页面顶部或置于主内容上方。
- 两个 Tab：**美股指数**（链接到 `/`）、**基金**（链接到 `/fund`）。
- 当前页高亮显示（蓝色下划线或背景色）。

### 7.2 `/fund` 基金自选列表页

- **添加基金区域**：
  - 输入框占位符：“请输入基金代码，如 017641”。
  - “添加”按钮。
  - 支持回车键添加。
  - 添加失败时显示错误提示。

- **自选基金表格**：

| 列名       | 说明                                             |
| ---------- | ------------------------------------------------ |
| 基金名称   | 基金全称                                         |
| 基金代码   | 6 位数字代码                                     |
| 单位净值   | 最近披露的单位净值 `nav`                         |
| 估算净值   | 盘中估算净值 `estimatedNav`，非交易时间显示 `--` |
| 估算涨跌幅 | `changePercent`，红涨绿跌                        |
| 更新时间   | `estimateTime` 或 `navDate`                      |
| 操作       | 删除按钮                                         |

- 默认预置基金：`017641`、`016452`。
- 点击表格行跳转到 `/fund/[code]`。
- 空列表时显示提示：“请输入基金代码添加自选基金”。
- 移动端表格支持横向滚动。

### 7.3 `/fund/[code]` 基金详情页

- **返回按钮**：返回 `/fund`。
- **基金信息卡片**：展示基金名称、代码、单位净值、估算净值、估算涨跌幅。
- **周期切换按钮**：最近 1 周 / 1 个月 / 3 个月 / 1 年（与美股页保持一致）。
- **走势图**：复用 `Chart.tsx`，展示历史净值走势。
- 颜色语义沿用 A 股习惯：红涨绿跌。

## 8. 数据流与状态

- **自选列表**：
  - 存储键：`fund-watchlist`。
  - 存储值：基金代码数组，如 `["017641", "016452"]`。
  - 页面加载时从 `localStorage` 读取。
  - 添加/删除时更新 `localStorage` 并重新拉取数据。

- **列表数据获取**：
  - `/fund` 页面加载后，根据自选列表并行请求 `/api/fund/{code}`。
  - 单个基金失败时仅标记该行错误，不影响其他行。

- **详情页数据获取**：
  - `/fund/[code]` 页面加载后，请求 `/api/fund/[code]` 与 `/api/fund/historical/[code]?range=1y`。
  - 默认周期为 `1y`，用户切换时重新请求历史数据。

## 9. 错误处理与降级

- **接口不可用**：天天基金接口可能限流或返回异常，服务端返回 `success: false` 与错误信息。
- **单个基金失败**：表格中该行显示“数据获取失败”，其他行正常展示。
- **Mock 模式**：
  - 环境变量 `USE_MOCK_DATA=true` 时，后端返回 Mock 数据。
  - 便于本地开发、UI 调试以及 Vercel 构建时避免网络问题。
- **构建时**：若网络不稳定，使用 `USE_MOCK_DATA=true pnpm build`。

## 10. 文档更新

实现完成后需更新以下文档：

- `AGENTS.md`
  - 更新“主要功能”增加基金自选。
  - 更新“目录结构”增加 `app/fund/**`、新组件、新 API。
  - 更新“API 接口”增加基金相关接口。
  - 更新“Mock 数据模式”说明基金 Mock。
- `README.md`
  - 增加基金功能说明。
  - 增加基金相关 API 文档。

## 11. 测试建议

- 验证 `/api/fund/017641` 与 `/api/fund/historical/017641?range=1y` 返回格式正确。
- 验证 `USE_MOCK_DATA=true` 时基金接口返回模拟数据。
- 验证添加、删除自选基金后 `localStorage` 正确更新。
- 验证详情页周期切换时历史数据正确刷新。
- 验证单个基金接口失败时，列表其他基金正常展示。

## 12. 风险与注意事项

- 天天基金接口为非官方公开接口，字段或可用性可能变化，需要做好错误处理和 Mock 兜底。
- 基金估值为盘中估算，非最终净值，需在 UI 上明确区分“单位净值”与“估算净值”。
- Vercel Serverless 实例冷启动会清空内存缓存，极端情况下可能重新触发外部 API 请求。
