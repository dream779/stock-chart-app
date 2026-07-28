import { getCache, setCache } from './cache';

const USE_MOCK = process.env.USE_MOCK_DATA === 'true';

const HISTORICAL_TTL = 60 * 60 * 1000;
const REQUEST_TIMEOUT_MS = 10_000;

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

interface EastMoneyHistoryItem {
  x: number;
  y: number | null;
}

interface SinaEstimatePoint {
  symbol?: string;
  min_time?: string | null;
  pre_date?: string | null;
  pre_nav?: string | number | null;
  growthrate?: string | number | null;
  pre_nav2?: string | number | null;
  growthrate2?: string | number | null;
}

interface SinaEstimateResponse {
  result?: {
    status?: {
      code?: number;
    };
    data?: {
      networth?: SinaEstimatePoint[];
    };
  };
}

interface SinaEstimate {
  estimatedNav: number;
  changePercent: number;
  date: string;
  time: string;
}

interface LatestConfirmedFundData {
  name: string;
  date: string;
  nav: number;
  changePercent: number | null;
}

function formatDate(date: Date): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Shanghai',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function formatShanghaiDate(date: Date = new Date()): string {
  return formatDate(date);
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

function toNumber(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function validateFundCode(code: string): void {
  if (!/^\d{6}$/.test(code)) {
    throw new Error('基金代码必须为6位数字');
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

export function parseFundHistoryResponse(text: string, range: string): FundHistoricalPoint[] {
  const start = text.indexOf('Data_netWorthTrend = ');
  if (start === -1) {
    throw new Error('无法解析基金历史净值响应：缺少 Data_netWorthTrend');
  }

  const arrText = text.slice(start + 21).split(';')[0];

  let raw: EastMoneyHistoryItem[];
  try {
    raw = JSON.parse(arrText) as EastMoneyHistoryItem[];
  } catch {
    throw new Error('无法解析基金历史净值响应：JSON 解析失败');
  }

  const periodStart = getPeriodStart(range);
  const startTime = periodStart.getTime();

  return raw
    .filter((item) => {
      return item.y !== null && item.x >= startTime;
    })
    .map((item) => ({
      time: formatDate(new Date(item.x)),
      value: Number((item.y as number).toFixed(4)),
    }));
}

export interface LatestConfirmedNav {
  date: string;
  nav: number;
}

function parseFundName(text: string): string {
  const match = text.match(/(?:var\s+)?fS_name\s*=\s*("(?:\\.|[^"\\])*")\s*;/);
  if (!match) return '';
  try {
    return JSON.parse(match[1]) as string;
  } catch {
    return '';
  }
}

function parseLatestConfirmedFundData(text: string): LatestConfirmedFundData | null {
  const start = text.indexOf('Data_netWorthTrend = ');
  if (start === -1) return null;

  const arrText = text.slice(start + 21).split(';')[0];
  let raw: EastMoneyHistoryItem[];
  try {
    raw = JSON.parse(arrText) as EastMoneyHistoryItem[];
  } catch {
    return null;
  }

  const valid = raw.filter(
    (item): item is EastMoneyHistoryItem & { y: number } =>
      item.y !== null && item.y !== undefined && Number.isFinite(Number(item.y))
  );
  if (valid.length === 0) return null;

  const latest = valid[valid.length - 1];
  const previous = valid.length > 1 ? valid[valid.length - 2] : null;
  const nav = Number(latest.y);
  const previousNav = previous ? Number(previous.y) : null;
  const changePercent =
    previousNav !== null && previousNav > 0 ? ((nav - previousNav) / previousNav) * 100 : null;

  return {
    name: parseFundName(text),
    date: formatDate(new Date(latest.x)),
    nav,
    changePercent,
  };
}

async function getLatestConfirmedFundData(code: string): Promise<LatestConfirmedFundData | null> {
  const normalizedCode = code.trim();
  validateFundCode(normalizedCode);

  if (USE_MOCK) {
    return {
      name: getMockFundInfo(normalizedCode).name,
      date: formatDate(new Date()),
      nav: 1.0,
      changePercent: null,
    };
  }

  const url = `https://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?v=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: { Referer: 'https://fund.eastmoney.com/' },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) return null;

  const text = await res.text();
  return parseLatestConfirmedFundData(text);
}

export async function getLatestConfirmedNav(code: string): Promise<LatestConfirmedNav | null> {
  const data = await getLatestConfirmedFundData(code);
  return data ? { date: data.date, nav: data.nav } : null;
}

export function parseSinaEstimateResponse(text: string, expectedCode: string): SinaEstimate | null {
  const openParen = text.indexOf('(');
  const closeParen = text.lastIndexOf(')');
  if (openParen === -1 || closeParen <= openParen) return null;

  let raw: SinaEstimateResponse;
  try {
    raw = JSON.parse(text.slice(openParen + 1, closeParen)) as SinaEstimateResponse;
  } catch {
    return null;
  }

  if (raw.result?.status?.code !== 0) return null;
  const points = raw.result.data?.networth;
  if (!Array.isArray(points)) return null;

  for (let i = points.length - 1; i >= 0; i--) {
    const point = points[i];
    if (point.symbol && point.symbol !== expectedCode) continue;
    if (!point.pre_date || !point.min_time) continue;

    const primaryNav = toNumber(point.pre_nav);
    const primaryGrowth = toNumber(point.growthrate);
    const secondaryNav = toNumber(point.pre_nav2);
    const secondaryGrowth = toNumber(point.growthrate2);
    const estimatedNav = primaryNav ?? secondaryNav;
    const growthRate = primaryGrowth ?? secondaryGrowth;

    if (estimatedNav === null || estimatedNav <= 0 || growthRate === null) continue;

    return {
      estimatedNav,
      changePercent: growthRate * 100,
      date: point.pre_date,
      time: `${point.pre_date} ${point.min_time}`,
    };
  }

  return null;
}

async function getSinaFundEstimate(code: string): Promise<SinaEstimate | null> {
  const callback = `jsonp_fund_${code}_${Date.now()}`;
  const url =
    'https://stock.finance.sina.com.cn/fundInfo/api/openapi.php/' +
    `FdFundService.getEstimateNetworthPic?symbol=${encodeURIComponent(code)}` +
    `&callback=${callback}&_=${Date.now()}`;
  const res = await fetch(url, {
    cache: 'no-store',
    headers: {
      Referer: 'https://finance.sina.com.cn/',
      'User-Agent': 'Mozilla/5.0',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`新浪基金估值接口请求失败: ${res.status}`);
  }

  return parseSinaEstimateResponse(await res.text(), code);
}

export async function getFundQuote(code: string): Promise<FundQuoteData> {
  const normalizedCode = code.trim();
  validateFundCode(normalizedCode);

  if (USE_MOCK) {
    return mockFundQuote(normalizedCode);
  }

  const [estimateResult, confirmedResult] = await Promise.allSettled([
    getSinaFundEstimate(normalizedCode),
    getLatestConfirmedFundData(normalizedCode),
  ]);

  const confirmed = confirmedResult.status === 'fulfilled' ? confirmedResult.value : null;
  const candidateEstimate = estimateResult.status === 'fulfilled' ? estimateResult.value : null;
  const estimate = candidateEstimate?.date === formatShanghaiDate() ? candidateEstimate : null;

  if (!confirmed && !estimate) {
    const estimateError =
      estimateResult.status === 'rejected'
        ? estimateResult.reason instanceof Error
          ? estimateResult.reason.message
          : String(estimateResult.reason)
        : '';
    const confirmedError =
      confirmedResult.status === 'rejected'
        ? confirmedResult.reason instanceof Error
          ? confirmedResult.reason.message
          : String(confirmedResult.reason)
        : '';
    throw new Error(
      [estimateError, confirmedError].filter(Boolean).join('；') || '基金估值和最新净值均不可用'
    );
  }

  return {
    code: normalizedCode,
    name: confirmed?.name || normalizedCode,
    nav: confirmed?.nav ?? estimate?.estimatedNav ?? 0,
    estimatedNav: estimate?.estimatedNav ?? null,
    changePercent: estimate?.changePercent ?? confirmed?.changePercent ?? null,
    navDate: confirmed?.date ?? estimate?.date ?? '',
    estimateTime: estimate?.time ?? null,
    lastUpdated: new Date().toISOString(),
  };
}

export async function getFundHistory(
  code: string,
  range: string = '1y'
): Promise<FundHistoricalPoint[]> {
  const normalizedCode = code.trim();
  validateFundCode(normalizedCode);

  const normalizedRange = ['1w', '1m', '3m', '1y'].includes(range) ? range : '1y';
  const cacheKey = `fund:history:${normalizedCode}:${normalizedRange}`;
  const cached = getCache<FundHistoricalPoint[]>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = generateMockFundHistory(normalizedCode, normalizedRange);
    setCache(cacheKey, data, HISTORICAL_TTL);
    return data;
  }

  // East Money-provided endpoint, called server-side only.
  const url = `https://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?v=${Date.now()}`;
  const res = await fetch(url, {
    headers: {
      Referer: 'https://fund.eastmoney.com/',
    },
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });

  if (!res.ok) {
    throw new Error(`天天基金历史净值接口请求失败: ${res.status}`);
  }

  const text = await res.text();
  const data = parseFundHistoryResponse(text, normalizedRange);
  setCache(cacheKey, data, HISTORICAL_TTL);
  return data;
}
