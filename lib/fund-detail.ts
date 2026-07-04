// lib/fund-detail.ts
// Wraps 3 East Money mobile-API endpoints to gather fund basic info,
// period returns, and (when available) top-10 holdings + sector themes.
// All endpoints are publicly accessible without auth (mobile client only).

import { getCache, setCache } from './cache';

const FUND_DETAIL_TTL = 6 * 60 * 60 * 1000; // 6h
const MOBILE_HEADERS = {
  Referer: 'https://m.1234567.com.cn/',
  'User-Agent': 'Mozilla/5.0 (iPhone)',
};

function validateFundCode(code: string): void {
  if (!/^\d{6}$/.test(code.trim())) {
    throw new Error('fundCode 必须为 6 位数字');
  }
}

function safeNumber(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

function safeNumberOrNull(v: unknown): number | null {
  if (v === '--' || v === '' || v == null) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

interface RawDetail {
  SHORTNAME?: string;
  FULLNAME?: string;
  FTYPE?: string;
  ENDNAV?: string | number;
  FEGMRQ?: string;
  JJJL?: string;
  ESTABDATE?: string;
  RLEVEL_SZ?: string;
  BENCH?: string;
  PERFCMP?: string;
  INVTGT?: string;
}

interface RawPeriodItem {
  title?: string;
  syl?: string;
  avg?: string;
  hs300?: string;
  rank?: string;
  sc?: string;
}

interface RawManagerItem {
  MGRID?: string;
  MGRNAME?: string;
}

interface RawPosItem {
  GPDM?: string;
  GPJC?: string;
  JZBL?: string;
  INDEXNAME?: string;
}

interface RawSubStyleItem {
  DLMC?: string;
  CCBL?: string;
  AVRBL?: string;
}

interface RawApiResponse<T> {
  Datas?: T | null;
  Success?: boolean;
  ErrCode?: number;
  ErrMsg?: string;
}

const RANGE_LABELS: Record<string, string> = {
  Z: '近 1 周',
  Y: '近 1 月',
  '3Y': '近 3 月',
  '6Y': '近 6 月',
  '1N': '近 1 年',
  '2N': '近 2 年',
  '3N': '近 3 年',
  '5N': '近 5 年',
  JN: '今年来',
  LN: '成立来',
};

async function fetchJson<T>(url: string): Promise<T | null> {
  try {
    const res = await fetch(url, { headers: MOBILE_HEADERS });
    if (!res.ok) {
      console.warn(`[fund-detail] HTTP ${res.status} from ${url}`);
      return null;
    }
    const body = (await res.json()) as RawApiResponse<T>;
    if (!body.Success) {
      console.warn(`[fund-detail] ${url} failed: ${body.ErrMsg ?? body.ErrCode}`);
      return null;
    }
    return (body.Datas as T) ?? null;
  } catch (err) {
    console.warn(`[fund-detail] ${url} threw:`, err);
    return null;
  }
}

function parseDetail(raw: RawDetail | null): Partial<FundDetail> {
  if (!raw) return {};
  return {
    shortName: raw.SHORTNAME ?? '',
    fullName: raw.FULLNAME ?? '',
    fundType: raw.FTYPE ?? '',
    scale: safeNumber(raw.ENDNAV) / 1e8,
    scaleDate: raw.FEGMRQ ?? '',
    manager: raw.JJJL ?? '',
    inceptionDate: raw.ESTABDATE ?? '',
    bench: (raw.BENCH ?? raw.PERFCMP ?? '').slice(0, 200),
    invTarget: (raw.INVTGT ?? '').slice(0, 200),
    ratingSz: raw.RLEVEL_SZ ?? '',
  };
}

function parsePeriod(raw: RawPeriodItem[] | null): FundPeriodReturn[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((it) => ({
    range: RANGE_LABELS[it.title ?? ''] ?? it.title ?? '',
    yield: safeNumber(it.syl),
    categoryAvg: safeNumber(it.avg),
    hs300: safeNumberOrNull(it.hs300),
    rank: safeNumberOrNull(it.rank),
    total: safeNumberOrNull(it.sc),
  }));
}

function parseHoldings(raw: RawPosItem[] | null): FundHolding[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((p) => p.GPDM && p.GPJC)
    .slice(0, 10)
    .map((p) => ({
      code: String(p.GPDM),
      name: String(p.GPJC),
      theme: p.INDEXNAME ?? '',
      ratio: safeNumber(p.JZBL),
    }));
}

function parseThemes(raw: RawSubStyleItem[] | null): FundTheme[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .slice(0, 5)
    .map((s) => ({
      name: s.DLMC ?? '',
      managerRatio: safeNumber(s.CCBL),
      categoryAvg: safeNumber(s.AVRBL),
    }))
    .filter((t) => t.name);
}

export interface FundHolding {
  code: string;
  name: string;
  theme: string;
  ratio: number;
}

export interface FundTheme {
  name: string;
  managerRatio: number;
  categoryAvg: number;
}

export interface FundPeriodReturn {
  range: string;
  yield: number;
  categoryAvg: number;
  hs300: number | null;
  rank: number | null;
  total: number | null;
}

export interface FundDetail {
  shortName: string;
  fullName: string;
  fundType: string;
  scale: number;
  scaleDate: string;
  manager: string;
  inceptionDate: string;
  bench: string;
  invTarget: string;
  ratingSz: string;
  holdings: FundHolding[];
  themes: FundTheme[];
  periodReturns: FundPeriodReturn[];
}

export async function getFundDetail(code: string): Promise<FundDetail | null> {
  validateFundCode(code);
  const normalizedCode = code.trim();

  const cacheKey = `fund:detail:v1:${normalizedCode}`;
  const cached = getCache<FundDetail>(cacheKey);
  if (cached) return cached;

  const base = 'https://fundmobapi.eastmoney.com/FundMNewApi';
  const ztbase = 'https://fundztapi.eastmoney.com/FundSpecialApiNew';
  const commonParams = '&deviceid=W&plat=Wap&product=EFund&version=2.0.0';

  const detailP = fetchJson<RawDetail>(`${base}/FundMNDetailInformation?FCODE=${normalizedCode}${commonParams}`);
  const periodP = fetchJson<RawPeriodItem[]>(`${base}/FundMNPeriodIncrease?FCODE=${normalizedCode}${commonParams}`);
  const managerP = fetchJson<RawManagerItem[]>(`${base}/FundMNMangerList?FCODE=${normalizedCode}${commonParams}`);

  const [detailRaw, periodRaw, managerRaw] = await Promise.all([detailP, periodP, managerP]);
  const partial = parseDetail(detailRaw);
  if (!partial.shortName) {
    return null;
  }

  let holdings: FundHolding[] = [];
  let themes: FundTheme[] = [];
  const firstMgrId = (managerRaw?.[0]?.MGRID ?? '').split(',')[0];
  if (firstMgrId) {
    const posRaw = await fetchJson<{ Pos?: RawPosItem[]; SubStyle?: RawSubStyleItem[] }>(
      `${ztbase}/FundMSNMangerPosMark?mGRID=${firstMgrId}${commonParams}`
    );
    if (posRaw) {
      holdings = parseHoldings(posRaw.Pos ?? null);
      themes = parseThemes(posRaw.SubStyle ?? null);
    }
  }

  const detail: FundDetail = {
    shortName: partial.shortName ?? '',
    fullName: partial.fullName ?? '',
    fundType: partial.fundType ?? '',
    scale: partial.scale ?? 0,
    scaleDate: partial.scaleDate ?? '',
    manager: partial.manager ?? '',
    inceptionDate: partial.inceptionDate ?? '',
    bench: partial.bench ?? '',
    invTarget: partial.invTarget ?? '',
    ratingSz: partial.ratingSz ?? '',
    holdings,
    themes,
    periodReturns: parsePeriod(periodRaw),
  };

  setCache(cacheKey, detail, FUND_DETAIL_TTL);
  return detail;
}