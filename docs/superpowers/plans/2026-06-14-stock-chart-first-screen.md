# 美股基金行情看板首屏优化 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 精简首页上半部分，让单个历史走势图表在首屏完整可见，并通过点击指数卡片在标普 500 与纳斯达克 100 之间切换。

**Architecture:** 将 `IndexCards` 改造为受控组件（接收 `selectedSymbol` / `onSelect`），卡片本身负责展示与切换；`page.tsx` 管理当前选中指数并用 flex 布局把图表区域撑满剩余视口；`Chart` 组件支持容器自适应高度。

**Tech Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, lightweight-charts

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `components/IndexCards.tsx` | Modify | 压缩卡片、移除股票代码、更新时间放到名称后、支持点击切换、显示激活态 |
| `app/page.tsx` | Modify | 移除标题/副标题、引入选中状态、flex 占满视口、只渲染单个图表 |
| `components/Chart.tsx` | Modify | 支持 `className` 与容器自适应高度，替代固定 360px |

---

### Task 1: 改造 IndexCards 为可选中、更紧凑的卡片

**Files:**
- Modify: `components/IndexCards.tsx`

**目标：** 卡片更小、可点击、有激活态，只保留必要信息。

- [ ] **Step 1: 添加 props 并移除股票代码与底部更新时间**

```tsx
interface IndexCardsProps {
  selectedSymbol: string;
  onSelect: (symbol: string) => void;
}

export default function IndexCards({ selectedSymbol, onSelect }: IndexCardsProps) {
```

- [ ] **Step 2: 修改卡片渲染为紧凑可点击样式**

替换 return 中的卡片 JSX 为：

```tsx
return (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
    {indices.map((index) => {
      const isSelected = index.symbol === selectedSymbol;
      const isPositive = index.change >= 0;
      const colorClass = isPositive ? "text-red-600" : "text-green-600";
      const bgClass = isPositive ? "bg-red-50" : "bg-green-50";

      return (
        <div
          key={index.symbol}
          onClick={() => onSelect(index.symbol)}
          className={`bg-white rounded-lg shadow p-3 cursor-pointer transition ${
            isSelected
              ? "ring-2 ring-blue-600 bg-blue-50"
              : "hover:bg-gray-50"
          }`}
        >
          <div className="flex justify-between items-start mb-1">
            <div className="text-sm font-semibold text-gray-900 leading-tight">
              {index.displayName}
              <span className="ml-2 text-xs font-normal text-gray-400">
                · 更新于 {formatUpdateTime(index.lastUpdated)}
              </span>
            </div>
            <span className="text-[10px] px-1.5 py-0.5 bg-gray-100 rounded text-gray-500">
              {index.marketState}
            </span>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold">
              {index.price
                ? index.price.toLocaleString("en-US", { maximumFractionDigits: 2 })
                : "--"}
            </span>
            {index.price > 0 && (
              <span className={`text-xs font-medium px-2 py-0.5 rounded ${bgClass} ${colorClass}`}>
                {isPositive ? "+" : ""}
                {index.change.toFixed(2)} ({isPositive ? "+" : ""}
                {index.changePercent.toFixed(2)}%)
              </span>
            )}
          </div>
          {index.error && (
            <p className="text-xs text-red-500 mt-1">数据获取失败</p>
          )}
        </div>
      );
    })}
  </div>
);
```

- [ ] **Step 3: 同步修改 loading 骨架屏高度**

将骨架屏 `h-32` 改为 `h-24`，`p-6` 改为 `p-3`，与真实卡片高度接近：

```tsx
<div key={i} className="bg-white rounded-lg shadow p-3 h-24 animate-pulse" />
```

- [ ] **Step 4: 启动开发服务器做视觉检查**

Run:
```bash
cd /Users/liuyunlong/Desktop/MyProjects/stock-chart-app
pnpm dev
```

打开 http://localhost:3000，确认：
- 卡片高度明显降低。
- 股票代码已消失。
- 更新时间在指数名称同一行。
- CLOSED 标签变小。

- [ ] **Step 5: Commit**

```bash
git add components/IndexCards.tsx
git commit -m "feat: 压缩指数卡片，支持点击选中状态"
```

---

### Task 2: 页面布局改造：单图表、占满视口

**Files:**
- Modify: `app/page.tsx`

**目标：** 去掉标题、引入选中状态、只渲染一个图表、让图表区域撑满剩余视口。

- [ ] **Step 1: 添加选中状态并移除页面标题**

在 `Home` 组件顶部添加：

```tsx
const [selectedSymbol, setSelectedSymbol] = useState("^GSPC");
```

删除：

```tsx
<h1 className="text-3xl font-bold mb-2">美股基金行情看板</h1>
<p className="text-gray-500 mb-8">查看标普 500、纳斯达克 100 指数走势</p>
```

- [ ] **Step 2: 将 `<main>` 改为 flex 占满视口并传入选中状态**

```tsx
return (
  <main className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-4">
    <IndexCards selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />

    <div className="bg-white rounded-lg shadow p-4 flex flex-col flex-1 min-h-0">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
        <h2 className="text-base font-semibold">历史走势</h2>
        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => setRange(r.value)}
              disabled={loading}
              className={`px-3 py-1 text-sm rounded-full transition ${
                range === r.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center flex-1 text-gray-500">
          加载中...
        </div>
      )}

      {error && !loading && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-3">
          {error}
        </div>
      )}

      {!loading && (
        <div className="flex-1 min-h-0">
          <Chart
            data={histories[selectedSymbol] || []}
            title={`${INDICES.find((i) => i.symbol === selectedSymbol)?.name} - ${
              RANGES.find((r) => r.value === range)?.label
            }`}
            stats={stats[selectedSymbol]}
            className="h-full"
          />
        </div>
      )}
    </div>
  </main>
);
```

- [ ] **Step 3: 验证页面首屏可见图表**

刷新 http://localhost:3000，确认：
- 页面顶部没有主/副标题。
- 只显示一个图表（默认标普 500）。
- 首屏完整显示图表，无纵向滚动条。
- 点击纳斯达克 100 卡片切换到对应图表。

- [ ] **Step 4: Commit**

```bash
git add app/page.tsx
git commit -m "feat: 单图表布局，卡片切换，图表占满剩余视口"
```

---

### Task 3: Chart 组件支持自适应高度

**Files:**
- Modify: `components/Chart.tsx`

**目标：** 让图表跟随父容器高度，而不是写死 360px。

- [ ] **Step 1: 扩展 props 并改用 ResizeObserver**

```tsx
interface ChartProps {
  data: { time: string; value: number }[];
  title?: string;
  stats?: {
    currentValue: number;
    changePercent: number;
  };
  className?: string;
}

export default function Chart({ data, title, stats, className }: ChartProps) {
```

- [ ] **Step 2: 修改 chart 创建逻辑为自适应尺寸**

在 `useEffect` 中替换固定 height 和 resize 逻辑为：

```tsx
const chart = createChart(chartContainerRef.current, {
  layout: {
    background: { type: ColorType.Solid, color: "#ffffff" },
    textColor: "#333333",
  },
  grid: {
    vertLines: { color: "#f0f0f0" },
    horzLines: { color: "#f0f0f0" },
  },
  crosshair: { mode: 1 },
  rightPriceScale: { borderColor: "#e0e0e0" },
  timeScale: { borderColor: "#e0e0e0", timeVisible: false },
  width: chartContainerRef.current.clientWidth,
  height: chartContainerRef.current.clientHeight,
});

const series = chart.addAreaSeries({
  lineColor: "#2563eb",
  topColor: "rgba(37, 99, 235, 0.3)",
  bottomColor: "rgba(37, 99, 235, 0.05)",
  lineWidth: 2,
});

chartRef.current = chart;
seriesRef.current = series;

const updateSize = () => {
  if (chartContainerRef.current && chartRef.current) {
    chartRef.current.applyOptions({
      width: chartContainerRef.current.clientWidth,
      height: chartContainerRef.current.clientHeight,
    });
  }
};

window.addEventListener("resize", updateSize);

const resizeObserver = new ResizeObserver(updateSize);
resizeObserver.observe(chartContainerRef.current);
```

并在 cleanup 中移除：

```tsx
return () => {
  window.removeEventListener("resize", updateSize);
  resizeObserver.disconnect();
  chart.remove();
};
```

- [ ] **Step 3: 调整外层布局为 flex 撑满容器**

```tsx
return (
  <div className={`flex flex-col h-full ${className || ""}`}>
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-2">
      {title && <h3 className="text-base font-semibold text-gray-900">{title}</h3>}
      {stats && (
        <div className="flex items-baseline gap-2">
          <span className="text-xl font-bold text-gray-900">
            {formatNumber(stats.currentValue)}
          </span>
          <span
            className={`text-sm font-medium px-2 py-0.5 rounded ${
              isPositive
                ? "bg-red-50 text-red-600"
                : "bg-green-50 text-green-600"
            }`}
          >
            {isPositive ? "+" : ""}
            {stats.changePercent.toFixed(2)}%
          </span>
        </div>
      )}
    </div>
    <div ref={chartContainerRef} className="flex-1 min-h-0" />
  </div>
);
```

- [ ] **Step 4: 验证图表自适应**

刷新页面，确认：
- 图表高度随窗口大小变化自动调整。
- 切换时间范围后图表仍然撑满容器。
- 无控制台 ResizeObserver 报错。

- [ ] **Step 5: Commit**

```bash
git add components/Chart.tsx
git commit -m "feat: Chart 组件支持容器自适应高度"
```

---

### Task 4: 构建与最终验证

**Files:**
- Modify: 无

- [ ] **Step 1: 运行 TypeScript / Next.js 构建**

```bash
cd /Users/liuyunlong/Desktop/MyProjects/stock-chart-app
pnpm build
```

Expected: 构建成功，无类型错误。

- [ ] **Step 2: 最终人工验收清单**

在 http://localhost:3000 检查：
- [ ] 顶部无主标题、副标题。
- [ ] 两张指数卡片紧凑并排（移动端堆叠）。
- [ ] 卡片内无股票代码，更新时间在名称后。
- [ ] CLOSED 标签缩小显示。
- [ ] 默认显示标普 500 图表。
- [ ] 点击纳斯达克 100 卡片切换到对应图表。
- [ ] 时间范围切换（1周/1月/3月/1年）对当前选中指数生效。
- [ ] 首屏完整显示图表，无需滚动。
- [ ] 窗口缩放时图表自适应。

- [ ] **Step 3: Commit（如有 lint/format 自动修复）**

```bash
git diff --stat
# 确认变更范围符合预期后
git add .
git commit -m "feat: 首屏优化完成 - 精简卡片、单图表、占满视口"
```
