import type { Holding } from './holdings';

const BASE = '/api/holdings';

export async function getAllHoldings(): Promise<Holding[]> {
  const res = await fetch(BASE, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '读取持仓失败');
  }
  return json.data as Holding[];
}

export async function saveHolding(holding: Holding): Promise<void> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(holding),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '保存持仓失败');
  }
}

export async function deleteHolding(code: string): Promise<void> {
  const res = await fetch(`${BASE}?code=${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '删除持仓失败');
  }
}
