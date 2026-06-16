const BASE = '/api/dca';

export type DcaFrequency = 'daily' | 'weekly' | 'monthly';

export interface DcaPlan {
  id: number;
  code: string;
  amountPerPeriod: number;
  frequency: DcaFrequency;
  startDate: string;
  confirmationDays: number;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  pendingCount?: number;
  pendingAmount?: number;
}

export interface SettleResult {
  settled: number;
  pendingCount: number;
  pendingAmount: number;
  nav: number | null;
  error?: 'no_plan' | 'no_quote';
}

export async function getDcaPlans(): Promise<DcaPlan[]> {
  const res = await fetch(BASE, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '读取定投计划失败');
  }
  return json.data as DcaPlan[];
}

export async function saveDcaPlan(input: {
  code: string;
  amountPerPeriod: number;
  frequency: DcaFrequency;
  startDate: string;
  confirmationDays: number;
}): Promise<DcaPlan> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(input),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '保存定投计划失败');
  }
  return json.data as DcaPlan;
}

export async function deleteDcaPlan(code: string): Promise<void> {
  const res = await fetch(`${BASE}?code=${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '删除定投计划失败');
  }
}

export async function settleDcaCode(code: string): Promise<SettleResult> {
  const res = await fetch(`${BASE}/settle`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '结算定投失败');
  }
  return json.data as SettleResult;
}
