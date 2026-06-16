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

interface EastMoneyQuotePayload {
  fundcode?: string;
  name?: string;
  dwjz?: string;
  gsz?: string;
  gszzl?: string;
  jzrq?: string;
  gztime?: string;
}

interface EastMoneyHistoryItem {
  x: number;
  y: number | null;
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

export function parseFundQuoteResponse(text: string): FundQuoteData {
  const start = text.indexOf('jsonpgz(');
  if (start === -1) {
    throw new Error('无法解析基金估值响应：缺少 jsonpgz 回调');
  }

  const jsonText = text.slice(start + 8).replace(/\);\s*$/, '');

  let raw: EastMoneyQuotePayload;
  try {
    raw = JSON.parse(jsonText) as EastMoneyQuotePayload;
  } catch {
    throw new Error('无法解析基金估值响应：JSON 解析失败');
  }

  return {
    code: raw.fundcode || '',
    name: raw.name || '',
    nav: toNumber(raw.dwjz) ?? 0,
    estimatedNav: toNumber(raw.gsz),
    changePercent: toNumber(raw.gszzl),
    navDate: raw.jzrq || '',
    estimateTime: raw.gztime || null,
    lastUpdated: new Date().toISOString(),
  };
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

export async function getLatestConfirmedNav(code: string): Promise<LatestConfirmedNav | null> {
  const normalizedCode = code.trim();
  validateFundCode(normalizedCode);

  if (USE_MOCK) {
    return { date: formatDate(new Date()), nav: 1.0 };
  }

  const url = `http://fund.eastmoney.com/pingzhongdata/${normalizedCode}.js?v=${Date.now()}`;
  const res = await fetch(url, {
    headers: { Referer: 'http://fund.eastmoney.com/' },
  });

  if (!res.ok) return null;

  const text = await res.text();
  const start = text.indexOf('Data_netWorthTrend = ');
  if (start === -1) return null;

  const arrText = text.slice(start + 21).split(';')[0];
  let raw: EastMoneyHistoryItem[];
  try {
    raw = JSON.parse(arrText) as EastMoneyHistoryItem[];
  } catch {
    return null;
  }

  for (let i = raw.length - 1; i >= 0; i--) {
    const item = raw[i];
    if (item.y !== null && item.y !== undefined) {
      return {
        date: formatDate(new Date(item.x)),
        nav: Number(item.y),
      };
    }
  }
  return null;
}

export async function getFundQuote(code: string): Promise<FundQuoteData> {
  const normalizedCode = code.trim();
  validateFundCode(normalizedCode);

  const cacheKey = `fund:quote:${normalizedCode}`;
  const cached = getCache<FundQuoteData>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = mockFundQuote(normalizedCode);
    setCache(cacheKey, data, QUOTE_TTL);
    return data;
  }

  // Fetch gz (name + intraday estimate) and pingzhongdata (latest confirmed
  // NAV) in parallel — gz's `dwjz` lags ~1 day behind the official NAV, so we
  // override it with pingzhongdata's latest non-null entry after both return.
  const [gzResult, confirmed] = await Promise.allSettled([
    fetch(`http://fundgz.1234567.com.cn/js/${normalizedCode}.js?rt=${Date.now()}`, {
      headers: { Referer: 'http://fund.eastmoney.com/' },
    }).then(async (res) => {
      if (!res.ok) throw new Error(`天天基金接口请求失败: ${res.status}`);
      return res.text();
    }),
    getLatestConfirmedNav(normalizedCode),
  ]);

  if (gzResult.status === 'rejected') {
    throw new Error(gzResult.reason instanceof Error ? gzResult.reason.message : String(gzResult.reason));
  }

  const data = parseFundQuoteResponse(gzResult.value);

  if (confirmed.status === 'fulfilled' && confirmed.value) {
    data.nav = confirmed.value.nav;
    data.navDate = confirmed.value.date;
  }

  setCache(cacheKey, data, QUOTE_TTL);
  return data;
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
