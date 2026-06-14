# 基金自选模块 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 在现有美股指数看板基础上，新增基金自选列表页与基金详情页，使用天天基金（东方财富）接口获取基金净值与估值数据。

**Architecture:** 新增 `lib/eastmoney.ts` 负责天天基金接口的抓取、JSONP/JS 文本解析、缓存和 Mock；新增 Next.js API Routes 做服务端代理；新增 `NavBar`、`FundTable` 组件与 `/fund`、`/fund/[code]` 页面；自选基金列表通过 `localStorage` 持久化。

**Tech Stack:** Next.js 14 App Router、TypeScript、Tailwind CSS、lightweight-charts

---

## File Structure

| 文件                                      | 职责                               |
| ----------------------------------------- | ---------------------------------- |
| `lib/eastmoney.ts`                        | 天天基金数据获取、解析、缓存、Mock |
| `app/api/fund/[code]/route.ts`            | 单只基金实时估值/净值接口          |
| `app/api/fund/historical/[code]/route.ts` | 基金历史净值接口                   |
| `components/NavBar.tsx`                   | 顶部导航栏（美股指数 / 基金）      |
| `components/FundTable.tsx`                | 基金自选表格 + 添加基金输入框      |
| `app/fund/page.tsx`                       | 基金自选列表页                     |
| `app/fund/[code]/page.tsx`                | 基金详情页                         |
| `app/page.tsx`                            | 现有美股指数页，加入 NavBar        |
| `app/layout.tsx`                          | 更新页面标题与描述                 |
| `AGENTS.md`                               | 更新项目说明                       |
| `README.md`                               | 更新功能与 API 说明                |

---

## Task 1: 创建天天基金数据层 `lib/eastmoney.ts`

**Files:**

- Create: `lib/eastmoney.ts`

### Step 1.1: 写入 `lib/eastmoney.ts`

```typescript
import YahooFinance from 'yahoo-finance2';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

interface CacheItem<T> {
  data: T;
  expiry: number;
}

const cache = new Map<string, CacheItem<unknown>>();
const QUOTE_TTL = 2 * 60 * 1000;
const HISTORICAL_TTL = 60 * 60 * 1000;

function getCache<T>(key: string): T | null {
  const item = cache.get(key);
  if (!item) return null;
  if (Date.now() > item.expiry) {
    cache.delete(key);
    return null;
  }
  return item.data as T;
}

function setCache<T>(key: string, data: T, ttlMs: number) {
  cache.set(key, { data, expiry: Date.now() + ttlMs });
}

export interface FundQuoteData {
  code: string;
  name: string;
  nav: number;
  estimatedNav: number | null;
  changePercent: number | null;
  navDate: string;
  estimateTime: string | null;
  lastUpdated: string;
}

export interface FundHistoricalPoint {
  time: string;
  value: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getPeriodStart(range: string): Date {
  const now = new Date();
  switch (range) {
    case '1w':
      return new Date(now.setDate(now.getDate() - 7));
    case '1m':
      return new Date(now.setMonth(now.getMonth() - 1));
    case '3m':
      return new Date(now.setMonth(now.getMonth() - 3));
    case '1y':
      return new Date(now.setFullYear(now.getFullYear() - 1));
    default:
      return new Date(now.setFullYear(now.getFullYear() - 1));
  }
}

const MOCK_FUND_BASE: Record<string, { name: string; baseNav: number }> = {
  '017641': { name: '广发中证光伏产业指数A', baseNav: 0.85 },
  '016452': { name: '华夏中证新能源汽车指数A', baseNav: 0.92 },
};

function getMockFundInfo(code: string): { name: string; baseNav: number } {
  return (
    MOCK_FUND_BASE[code] || {
      name: `${code} (Mock)`,
      baseNav: 1.0,
    }
  );
}

export function mockFundQuote(code: string): FundQuoteData {
  const info = getMockFundInfo(code);
  const baseNav = info.baseNav;
  const previousNav = baseNav * (1 + (Math.random() - 0.5) * 0.02);
  const change = baseNav - previousNav;
  const changePercent = (change / previousNav) * 100;

  return {
    code,
    name: info.name,
    nav: Number(baseNav.toFixed(4)),
    estimatedNav: Number((baseNav * (1 + changePercent / 100)).toFixed(4)),
    changePercent: Number(changePercent.toFixed(2)),
    navDate: formatDate(new Date()),
    estimateTime: '15:00',
    lastUpdated: new Date().toISOString(),
  };
}

export function generateMockFundHistory(code: string, range: string): FundHistoricalPoint[] {
  const start = getPeriodStart(range);
  const end = new Date();
  const points: FundHistoricalPoint[] = [];
  const baseNav = getMockFundInfo(code).baseNav;
  let nav = baseNav * 0.95;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * baseNav * 0.015;
    nav = Math.max(nav + change, baseNav * 0.3);
    points.push({
      time: formatDate(new Date(d)),
      value: Number(nav.toFixed(4)),
    });
  }

  return points;
}

export function parseFundQuoteResponse(text: string): FundQuoteData {
  const match = text.match(/jsonpgz\((\{[\s\S]*?\})\);?/);
  if (!match) {
    throw new Error('无法解析基金估值响应');
  }

  const raw = JSON.parse(match[1]);

  return {
    code: raw.fundcode || '',
    name: raw.name || '',
    nav: raw.dwjz ? Number(raw.dwjz) : 0,
    estimatedNav: raw.gsz ? Number(raw.gsz) : null,
    changePercent: raw.gszzl !== '' && raw.gszzl !== null ? Number(raw.gszzl) : null,
    navDate: raw.jzrq || '',
    estimateTime: raw.gztime || null,
    lastUpdated: new Date().toISOString(),
  };
}

export function parseFundHistoryResponse(text: string, range: string): FundHistoricalPoint[] {
  const match = text.match(/Data_netWorthTrend\s*=\s*(\[[\s\S]*?\]);/);
  if (!match) {
    throw new Error('无法解析基金历史净值响应');
  }

  const raw = JSON.parse(match[1]);
  const start = getPeriodStart(range);
  const startTime = start.getTime();

  return raw
    .filter((item: { x: number; y: number | null }) => {
      return item.y !== null && item.x >= startTime;
    })
    .map((item: { x: number; y: number }) => ({
      time: formatDate(new Date(item.x)),
      value: Number(item.y.toFixed(4)),
    }));
}

export async function getFundQuote(code: string): Promise<FundQuoteData> {
  const normalizedCode = code.trim();
  const cacheKey = `fund:quote:${normalizedCode}`;
  const cached = getCache<FundQuoteData>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = mockFundQuote(normalizedCode);
    setCache(cacheKey, data, QUOTE_TTL);
    return data;
  }

  const url = `http://fundgz.1234567.com.cn/js/${normalizedCode}.js?rt=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Referer: 'http://fund.eastmoney.com/',
    },
  });

  if (!res.ok) {
    throw new Error(`天天基金接口请求失败: ${res.status}`);
  }

  const text = await res.text();
  const data = parseFundQuoteResponse(text);
  setCache(cacheKey, data, QUOTE_TTL);
  return data;
}

export async function getFundHistory(
  code: string,
  range: string = '1y'
): Promise<FundHistoricalPoint[]> {
  const normalizedCode = code.trim();
  const normalizedRange = ['1w', '1m', '3m', '1y'].includes(range) ? range : '1y';
  const cacheKey = `fund:history:${normalizedCode}:${normalizedRange}`;
  const cached = getCache<FundHistoricalPoint[]>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = generateMockFundHistory(normalizedCode, normalizedRange);
    setCache(cacheKey, data, HISTORICAL_TTL);
    return data;
  }

  const url = `http://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?v=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Referer: 'http://fund.eastmoney.com/',
    },
  });

  if (!res.ok) {
    throw new Error(`天天基金历史净值接口请求失败: ${res.status}`);
  }

  const text = await res.text();
  const data = parseFundHistoryResponse(text, normalizedRange);
  setCache(cacheKey, data, HISTORICAL_TTL);
  return data;
}
```

### Step 1.2: 验证解析函数

在终端执行以下内联脚本，直接测试解析逻辑：

```bash
cd /Users/liuyunlong/Desktop/MyProjects/stock-chart-app
node -e "
const quoteText = 'jsonpgz({\"fundcode\":\"017641\",\"name\":\"测试基金\",\"jzrq\":\"2024-06-13\",\"dwjz\":\"1.2300\",\"gsz\":\"1.2350\",\"gszzl\":\"0.41\",\"gztime\":\"2024-06-14 15:00\"});';
const match = quoteText.match(/jsonpgz\\((\\{[\\s\\S]*?\\});?/);
const raw = JSON.parse(match[1]);
console.log({
  code: raw.fundcode,
  name: raw.name,
  nav: Number(raw.dwjz),
  estimatedNav: Number(raw.gsz),
  changePercent: Number(raw.gszzl),
  navDate: raw.jzrq,
  estimateTime: raw.gztime,
});
"
```

Expected: 输出包含 `code: '017641'`, `name: '测试基金'`, `nav: 1.23`, `estimatedNav: 1.235`, `changePercent: 0.41` 的对象。

完整函数验证留到 Task 2 完成后通过 curl `/api/fund/017641` 进行端到端测试。

### Step 1.3: 提交

```bash
git add lib/eastmoney.ts
git commit -m "feat: add eastmoney fund data layer with parsing and mock"
```

---

## Task 2: 创建单只基金接口 `/api/fund/[code]`

**Files:**

- Create: `app/api/fund/[code]/route.ts`

### Step 2.1: 创建目录并写入文件

```bash
mkdir -p app/api/fund/[code]
```

写入 `app/api/fund/[code]/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { getFundQuote } from '@/lib/eastmoney';

interface Params {
  params: { code: string };
}

export async function GET(_request: Request, { params }: Params) {
  try {
    const code = params.code;
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: '基金代码格式错误，应为 6 位数字' },
        { status: 400 }
      );
    }

    const data = await getFundQuote(code);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`Fund quote API error for ${params.code}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: '获取基金数据失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

### Step 2.2: 验证接口

启动开发服务器：

```bash
pnpm dev
```

另开终端执行：

```bash
curl -s 'http://localhost:3000/api/fund/017641' | python3 -m json.tool
```

Expected: 返回 `success: true` 和基金数据。若网络问题导致失败，改用 Mock 模式验证：

```bash
USE_MOCK_DATA=true pnpm dev
```

### Step 2.3: 提交

```bash
git add app/api/fund/[code]/route.ts
git commit -m "feat: add fund quote API route"
```

---

## Task 3: 创建基金历史净值接口 `/api/fund/historical/[code]`

**Files:**

- Create: `app/api/fund/historical/[code]/route.ts`

### Step 3.1: 创建目录并写入文件

```bash
mkdir -p app/api/fund/historical/[code]
```

写入 `app/api/fund/historical/[code]/route.ts`：

```typescript
import { NextResponse } from 'next/server';
import { getFundHistory } from '@/lib/eastmoney';

interface Params {
  params: { code: string };
}

export async function GET(request: Request, { params }: Params) {
  try {
    const code = params.code;
    if (!code || !/^\d{6}$/.test(code)) {
      return NextResponse.json(
        { success: false, error: '基金代码格式错误，应为 6 位数字' },
        { status: 400 }
      );
    }

    const { searchParams } = new URL(request.url);
    const range = searchParams.get('range') || '1y';

    const data = await getFundHistory(code, range);
    return NextResponse.json({ success: true, data });
  } catch (error) {
    console.error(`Fund historical API error for ${params.code}:`, error);
    return NextResponse.json(
      {
        success: false,
        error: '获取基金历史净值失败',
        message: error instanceof Error ? error.message : String(error),
      },
      { status: 500 }
    );
  }
}
```

### Step 3.2: 验证接口

```bash
curl -s 'http://localhost:3000/api/fund/historical/017641?range=1m' | python3 -m json.tool
```

Expected: 返回 `success: true` 和数组形式的历史净值数据。

### Step 3.3: 提交

```bash
git add app/api/fund/historical/[code]/route.ts
git commit -m "feat: add fund historical API route"
```

---

## Task 4: 创建顶部导航组件 `components/NavBar.tsx`

**Files:**

- Create: `components/NavBar.tsx`

### Step 4.1: 写入组件

```typescript
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const NAV_ITEMS = [
  { label: '美股指数', href: '/' },
  { label: '基金', href: '/fund' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-white border-b border-gray-200 mb-4">
      <div className="max-w-5xl mx-auto px-4">
        <div className="flex gap-6 h-12 items-center">
          <span className="font-semibold text-gray-900 mr-2">行情看板</span>
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === '/'
                ? pathname === '/'
                : pathname?.startsWith(item.href) ?? false;

            return (
              <Link
                key={item.href}
                href={item.href}
                className={`text-sm font-medium transition border-b-2 h-full flex items-center ${
                  isActive
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-600 hover:text-gray-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
```

### Step 4.2: 验证

此步骤无需独立验证，在 Task 8 更新 `/` 页面后一起检查。

### Step 4.3: 提交

```bash
git add components/NavBar.tsx
git commit -m "feat: add NavBar component"
```

---

## Task 5: 创建基金自选表格组件 `components/FundTable.tsx`

**Files:**

- Create: `components/FundTable.tsx`

### Step 5.1: 写入组件

```typescript
'use client';

import { useState } from 'react';

export interface FundItem {
  code: string;
  name: string;
  nav: number;
  estimatedNav: number | null;
  changePercent: number | null;
  navDate: string;
  estimateTime: string | null;
  error?: boolean;
}

interface FundTableProps {
  funds: FundItem[];
  loading?: boolean;
  onAdd: (code: string) => void;
  onDelete: (code: string) => void;
}

function formatTime(item: FundItem): string {
  if (item.estimateTime) return item.estimateTime;
  return item.navDate;
}

export default function FundTable({
  funds,
  loading,
  onAdd,
  onDelete,
}: FundTableProps) {
  const [input, setInput] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const code = input.trim();
    if (!/^\d{6}$/.test(code)) {
      alert('请输入 6 位数字基金代码');
      return;
    }
    onAdd(code);
    setInput('');
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit} className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="请输入基金代码，如 017641"
          maxLength={6}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <button
          type="submit"
          disabled={loading}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition"
        >
          添加
        </button>
      </form>

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">基金名称</th>
                <th className="px-4 py-3">代码</th>
                <th className="px-4 py-3">单位净值</th>
                <th className="px-4 py-3">估算净值</th>
                <th className="px-4 py-3">估算涨跌幅</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {funds.length === 0 && !loading && (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    请输入基金代码添加自选基金，例如 017641
                  </td>
                </tr>
              )}
              {funds.map((fund) => {
                const isPositive =
                  fund.changePercent !== null ? fund.changePercent >= 0 : true;
                const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                return (
                  <tr
                    key={fund.code}
                    className="hover:bg-gray-50 cursor-pointer transition"
                    onClick={() => {
                      window.location.href = `/fund/${fund.code}`;
                    }}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {fund.error ? '数据获取失败' : fund.name || '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">{fund.code}</td>
                    <td className="px-4 py-3">
                      {fund.nav > 0 ? fund.nav.toFixed(4) : '--'}
                    </td>
                    <td className="px-4 py-3">
                      {fund.estimatedNav ? fund.estimatedNav.toFixed(4) : '--'}
                    </td>
                    <td className={`px-4 py-3 font-medium ${colorClass}`}>
                      {fund.changePercent !== null
                        ? `${isPositive ? '+' : ''}${fund.changePercent.toFixed(2)}%`
                        : '--'}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      {formatTime(fund) || '--'}
                    </td>
                    <td
                      className="px-4 py-3 text-right"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => onDelete(fund.code)}
                        className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition"
                      >
                        删除
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

### Step 5.2: 提交

```bash
git add components/FundTable.tsx
git commit -m "feat: add FundTable component"
```

---

## Task 6: 创建基金自选列表页 `/fund`

**Files:**

- Create: `app/fund/page.tsx`

### Step 6.1: 创建目录并写入页面

```bash
mkdir -p app/fund
```

写入 `app/fund/page.tsx`：

```typescript
'use client';

import { useEffect, useState } from 'react';
import NavBar from '@/components/NavBar';
import FundTable, { FundItem } from '@/components/FundTable';

const WATCHLIST_KEY = 'fund-watchlist';
const DEFAULT_FUNDS = ['017641', '016452'];

export default function FundPage() {
  const [watchlist, setWatchlist] = useState<string[]>([]);
  const [funds, setFunds] = useState<FundItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(WATCHLIST_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          setWatchlist(parsed);
        } else {
          setWatchlist(DEFAULT_FUNDS);
        }
      } catch {
        setWatchlist(DEFAULT_FUNDS);
      }
    } else {
      setWatchlist(DEFAULT_FUNDS);
    }
    setInitialized(true);
  }, []);

  useEffect(() => {
    if (!initialized || watchlist.length === 0) {
      setFunds([]);
      return;
    }

    localStorage.setItem(WATCHLIST_KEY, JSON.stringify(watchlist));

    async function fetchFunds() {
      setLoading(true);
      setError('');

      try {
        const results = await Promise.all(
          watchlist.map(async (code) => {
            try {
              const res = await fetch(`/api/fund/${code}`);
              const json = await res.json();
              if (!json.success) {
                throw new Error(json.error || '获取失败');
              }
              return json.data as FundItem;
            } catch (err) {
              console.error(`Failed to fetch fund ${code}:`, err);
              return {
                code,
                name: '',
                nav: 0,
                estimatedNav: null,
                changePercent: null,
                navDate: '',
                estimateTime: null,
                error: true,
              } as FundItem;
            }
          })
        );

        setFunds(results);
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败');
      } finally {
        setLoading(false);
      }
    }

    fetchFunds();
  }, [watchlist, initialized]);

  function handleAdd(code: string) {
    if (watchlist.includes(code)) {
      alert('该基金已在自选列表中');
      return;
    }
    setWatchlist((prev) => [...prev, code]);
  }

  function handleDelete(code: string) {
    setWatchlist((prev) => prev.filter((c) => c !== code));
  }

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-lg font-semibold text-gray-900">自选基金</h1>
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-3 text-sm">
              {error}
            </div>
          )}

          <FundTable
            funds={funds}
            loading={loading}
            onAdd={handleAdd}
            onDelete={handleDelete}
          />
        </div>
      </div>
    </main>
  );
}
```

### Step 6.2: 验证页面

启动开发服务器后访问 `http://localhost:3000/fund`。

Expected: 页面显示预置基金 `017641`、`016452` 的数据表格。

### Step 6.3: 提交

```bash
git add app/fund/page.tsx
git commit -m "feat: add fund watchlist page"
```

---

## Task 7: 创建基金详情页 `/fund/[code]`

**Files:**

- Create: `app/fund/[code]/page.tsx`

### Step 7.1: 创建目录并写入页面

```bash
mkdir -p 'app/fund/[code]'
```

写入 `app/fund/[code]/page.tsx`：

```typescript
'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import Chart from '@/components/Chart';
import { FundQuoteData, FundHistoricalPoint } from '@/lib/eastmoney';

const RANGES = [
  { label: '最近1周', value: '1w' },
  { label: '最近1个月', value: '1m' },
  { label: '最近3个月', value: '3m' },
  { label: '最近1年', value: '1y' },
];

interface FundDetailPageProps {
  params: { code: string };
}

export default function FundDetailPage({ params }: FundDetailPageProps) {
  const { code } = params;
  const [quote, setQuote] = useState<FundQuoteData | null>(null);
  const [history, setHistory] = useState<FundHistoricalPoint[]>([]);
  const [range, setRange] = useState('1y');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/fund/${code}`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '获取基金数据失败');
        }
        setQuote(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    }

    fetchQuote();
  }, [code]);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      try {
        const res = await fetch(`/api/fund/historical/${code}?range=${range}`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '获取历史数据失败');
        }
        setHistory(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [code, range]);

  const isPositive = quote?.changePercent !== null ? (quote?.changePercent ?? 0) >= 0 : true;
  const stats =
    history.length > 0
      ? {
          currentValue: history[history.length - 1].value,
          changePercent:
            history.length > 1
              ? ((history[history.length - 1].value - history[0].value) /
                  history[0].value) *
                100
              : 0,
        }
      : undefined;

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <Link
          href="/fund"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          ← 返回自选列表
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">
                {quote?.name || '--'}
              </h1>
              <p className="text-sm text-gray-500">{code}</p>
            </div>
            <div className="flex items-baseline gap-3">
              <div className="text-right">
                <p className="text-xs text-gray-500">单位净值</p>
                <p className="text-xl font-bold text-gray-900">
                  {quote?.nav ? quote.nav.toFixed(4) : '--'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">估算净值</p>
                <p className="text-xl font-bold text-gray-900">
                  {quote?.estimatedNav ? quote.estimatedNav.toFixed(4) : '--'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">估算涨跌幅</p>
                <p
                  className={`text-xl font-bold ${
                    isPositive ? 'text-red-600' : 'text-green-600'
                  }`}
                >
                  {quote?.changePercent !== null && quote?.changePercent !== undefined
                    ? `${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%`
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">历史净值走势</h2>
            <div className="flex flex-wrap gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  disabled={loading}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    range === r.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50'
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

          {!loading && (
            <div className="flex-1 min-h-0">
              <Chart
                data={history}
                title={`${quote?.name || code} - ${
                  RANGES.find((r) => r.value === range)?.label
                }`}
                stats={stats}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
```

### Step 7.2: 验证页面

访问 `http://localhost:3000/fund/017641`。

Expected: 页面显示基金信息、周期切换按钮和历史净值走势图。

### Step 7.3: 提交

```bash
git add 'app/fund/[code]/page.tsx'
git commit -m "feat: add fund detail page"
```

---

## Task 8: 更新美股指数页 `/` 加入导航栏并调整布局

**Files:**

- Modify: `app/page.tsx`

### Step 8.1: 修改 `app/page.tsx`

在文件顶部导入 `NavBar`：

```typescript
import NavBar from '@/components/NavBar';
```

将 `return` 中的外层 `<main>` 改为包裹在 `<>` 和 `NavBar` 中：

旧代码：

```tsx
return (
    <main className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-4">
```

新代码：

```tsx
return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />
      <div className="h-[calc(100vh-64px)] flex flex-col max-w-5xl mx-auto px-4 py-4">
```

并相应关闭 `</div>` 和 `</main>`：

旧结尾：

```tsx
    </main>
  );
```

新结尾：

```tsx
      </div>
    </main>
  );
```

### Step 8.2: 验证

访问 `http://localhost:3000/`。

Expected: 页面顶部出现导航栏，美股指数内容正常显示，图表高度占满剩余视口。

### Step 8.3: 提交

```bash
git add app/page.tsx
git commit -m "feat: integrate NavBar into index page"
```

---

## Task 9: 更新 `app/layout.tsx` 元数据

**Files:**

- Modify: `app/layout.tsx`

### Step 9.1: 修改元数据

```typescript
export const metadata: Metadata = {
  title: '美股基金行情看板',
  description: '查看标普500、纳斯达克100及自选基金数据',
};
```

### Step 9.2: 提交

```bash
git add app/layout.tsx
git commit -m "chore: update layout metadata for funds"
```

---

## Task 10: 更新文档

**Files:**

- Modify: `AGENTS.md`
- Modify: `README.md`

### Step 10.1: 更新 `AGENTS.md`

在“主要功能”部分增加：

```markdown
- 基金自选：输入基金代码加入自选列表，表格展示净值、估算净值与涨跌幅
- 基金详情：点击自选基金查看历史净值走势，支持 1周/1月/3月/1年 周期切换
```

在“目录结构”部分增加：

```markdown
│ ├── fund/ # 基金页面
│ │ ├── page.tsx # 基金自选列表页
│ │ └── [code]/ # 基金详情页（动态路由）
│ │ └── page.tsx
```

在 `components` 下增加：

```markdown
│ ├── NavBar.tsx # 顶部导航栏
│ ├── FundTable.tsx # 基金自选表格
```

在 `lib` 下增加：

```markdown
│ └── eastmoney.ts # 天天基金数据获取、解析、缓存和 Mock
```

在“API 接口”表格中增加：

```markdown
| `/api/fund/[code]` | GET | 返回单只基金的实时估值与净值 |
| `/api/fund/historical/[code]?range=1y` | GET | 返回基金历史净值走势 |
```

在“Mock 数据模式”部分增加：

```markdown
基金 Mock 数据预置了 `017641`、`016452` 两只基金的基础净值与名称，便于本地预览。
```

### Step 10.2: 更新 `README.md`

在功能介绍部分增加基金功能说明；在 API 文档部分增加 `/api/fund/[code]` 和 `/api/fund/historical/[code]`。

### Step 10.3: 提交

```bash
git add AGENTS.md README.md
git commit -m "docs: update AGENTS.md and README.md for fund module"
```

---

## Task 11: 最终验证

### Step 11.1: 格式检查

```bash
pnpm format:check
```

Expected: 无格式错误。如果有，运行 `pnpm format` 自动修复。

### Step 11.2: Lint 检查

```bash
pnpm lint
```

Expected: 无 ESLint 错误。

### Step 11.3: 类型检查

```bash
pnpm build
```

Expected: 构建成功。如果网络不稳定，使用：

```bash
USE_MOCK_DATA=true pnpm build
```

### Step 11.4: 端到端验证

启动开发服务器：

```bash
pnpm dev
```

1. 访问 `http://localhost:3000/`，确认美股指数页正常。
2. 点击导航栏“基金”，进入 `http://localhost:3000/fund`，确认预置基金表格显示。
3. 输入基金代码 `000001` 点击添加，确认加入列表。
4. 点击表格行，进入详情页，确认图表和周期切换正常。
5. 点击删除，确认该基金从列表移除且 `localStorage` 更新。

### Step 11.5: 提交

```bash
git add -A
git commit -m "chore: final lint and build verification"
```

---

## Spec Coverage Check

| 需求                         | 实现任务                                               |
| ---------------------------- | ------------------------------------------------------ |
| 两个页面：美股指数、基金     | Task 4 (NavBar), Task 6 (`/fund`), Task 8 (更新 `/`)   |
| 输入基金代码加入自选         | Task 5 (FundTable), Task 6 (`/fund` localStorage)      |
| 表格展示基金基本信息与涨跌幅 | Task 5 (FundTable)                                     |
| 点击列表项进入详情页         | Task 5 (行点击跳转), Task 7 (`/fund/[code]`)           |
| 详情页展示图表与周期切换     | Task 7 (`/fund/[code]` + Chart)                        |
| 使用天天基金接口             | Task 1 (lib/eastmoney.ts), Task 2, Task 3 (API Routes) |
| 预置基金 017641、016452      | Task 6 (`DEFAULT_FUNDS`)                               |
| Mock 兜底                    | Task 1 (`USE_MOCK` 判断与 Mock 函数)                   |
| 文档更新                     | Task 10                                                |

## Placeholder Scan

- 无 `TBD`、`TODO`、未完成的步骤。
- 每个任务包含完整代码或精确命令。
- 类型和函数名在各任务中保持一致：`FundQuoteData`、`FundHistoricalPoint`、`getFundQuote`、`getFundHistory`。
