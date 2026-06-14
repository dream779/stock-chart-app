import YahooFinance from "yahoo-finance2";

const yahooFinance = new YahooFinance({
  suppressNotices: ["yahooSurvey"],
});

const USE_MOCK = process.env.USE_MOCK_DATA === "true";

// 内存缓存：行情 2 分钟，历史数据 1 小时
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

export interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketState: string;
  currency: string;
  lastUpdated: string;
}

export interface HistoricalPoint {
  time: string;
  value: number;
}

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0];
}

function getPeriodStart(range: string): Date {
  const now = new Date();
  switch (range) {
    case "1w":
      return new Date(now.setDate(now.getDate() - 7));
    case "1m":
      return new Date(now.setMonth(now.getMonth() - 1));
    case "3m":
      return new Date(now.setMonth(now.getMonth() - 3));
    case "6m":
      return new Date(now.setMonth(now.getMonth() - 6));
    case "1y":
      return new Date(now.setFullYear(now.getFullYear() - 1));
    case "5y":
      return new Date(now.setFullYear(now.getFullYear() - 5));
    default:
      return new Date(now.setFullYear(now.getFullYear() - 1));
  }
}

function generateMockHistory(range: string, basePrice: number): HistoricalPoint[] {
  const start = getPeriodStart(range);
  const end = new Date();
  const points: HistoricalPoint[] = [];
  let price = basePrice * 0.85;

  for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
    if (d.getDay() === 0 || d.getDay() === 6) continue;
    const change = (Math.random() - 0.48) * basePrice * 0.02;
    price = Math.max(price + change, basePrice * 0.3);
    points.push({
      time: formatDate(new Date(d)),
      value: Number(price.toFixed(2)),
    });
  }

  return points;
}

function getMockBasePrice(symbol: string): number {
  const map: Record<string, number> = {
    "^GSPC": 5350,
    "^NDX": 19200,
    QQQ: 470,
    VOO: 485,
    SPY: 555,
    AAPL: 195,
    TSLA: 245,
    MSFT: 425,
    GOOGL: 175,
    NVDA: 880,
  };
  return map[symbol.toUpperCase()] || 100;
}

function mockQuote(symbol: string): QuoteData {
  const base = getMockBasePrice(symbol);
  const previousClose = base * (1 + (Math.random() - 0.5) * 0.02);
  const change = base - previousClose;
  const changePercent = (change / previousClose) * 100;

  return {
    symbol: symbol.toUpperCase(),
    name: `${symbol.toUpperCase()} (Mock)`,
    price: Number(base.toFixed(2)),
    change: Number(change.toFixed(2)),
    changePercent: Number(changePercent.toFixed(2)),
    previousClose: Number(previousClose.toFixed(2)),
    marketState: "REGULAR",
    currency: "USD",
    lastUpdated: new Date().toISOString(),
  };
}

export async function getQuote(symbol: string): Promise<QuoteData> {
  const cacheKey = `quote:${symbol.toUpperCase()}`;
  const cached = getCache<QuoteData>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = mockQuote(symbol);
    setCache(cacheKey, data, QUOTE_TTL);
    return data;
  }

  const result = await yahooFinance.quote(symbol);

  const data: QuoteData = {
    symbol: result.symbol,
    name: result.longName || result.shortName || result.symbol,
    price: result.regularMarketPrice ?? 0,
    change: result.regularMarketChange ?? 0,
    changePercent: result.regularMarketChangePercent ?? 0,
    previousClose: result.regularMarketPreviousClose ?? 0,
    marketState: result.marketState || "UNKNOWN",
    currency: result.currency || "USD",
    lastUpdated: result.regularMarketTime?.toISOString() ?? new Date().toISOString(),
  };

  setCache(cacheKey, data, QUOTE_TTL);
  return data;
}

export async function getHistorical(
  symbol: string,
  range: string = "1y"
): Promise<HistoricalPoint[]> {
  const cacheKey = `historical:${symbol.toUpperCase()}:${range}`;
  const cached = getCache<HistoricalPoint[]>(cacheKey);
  if (cached) return cached;

  if (USE_MOCK) {
    const data = generateMockHistory(range, getMockBasePrice(symbol));
    setCache(cacheKey, data, HISTORICAL_TTL);
    return data;
  }

  const period1 = getPeriodStart(range);
  const period2 = new Date();

  const result = await yahooFinance.historical(symbol, {
    period1,
    period2,
    interval: "1d",
  });

  const data = result
    .filter((item) => item.close !== null && item.close !== undefined)
    .map((item) => ({
      time: formatDate(item.date),
      value: item.close as number,
    }));

  setCache(cacheKey, data, HISTORICAL_TTL);
  return data;
}
