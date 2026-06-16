export type ReturnRange = '1m' | '3m' | '6m' | '1y' | 'all';

export interface ReturnSnapshot {
  snapshotDate: string;
  nav: number | null;
  settledShares: number;
  settledMarketValue: number;
  costPrice: number;
  totalCost: number;
  pendingAmount: number;
  pendingCount: number;
  realizedGain: number;
  gainRate: number;
}

export async function getReturnHistory(
  code: string,
  range: ReturnRange = '3m'
): Promise<ReturnSnapshot[]> {
  const res = await fetch(`/api/dca/returns?code=${encodeURIComponent(code)}&range=${range}`, {
    cache: 'no-store',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '读取历史收益失败');
  }
  return json.data as ReturnSnapshot[];
}
