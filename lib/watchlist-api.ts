const BASE = '/api/watchlist';

export async function getWatchlist(): Promise<string[]> {
  const res = await fetch(BASE, { cache: 'no-store' });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '读取自选失败');
  }
  return json.data as string[];
}

export async function addToWatchlist(code: string): Promise<void> {
  const res = await fetch(BASE, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ code }),
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '添加自选失败');
  }
}

export async function removeFromWatchlist(code: string): Promise<void> {
  const res = await fetch(`${BASE}?code=${encodeURIComponent(code)}`, {
    method: 'DELETE',
  });
  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message ?? '移除自选失败');
  }
}
