'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RegenerateButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleClick() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/summaries/regenerate', { method: 'POST' });
      const json = await res.json();
      if (!json.success) throw new Error(json.message || '重跑失败');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={loading}
        className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition disabled:bg-blue-300 disabled:cursor-not-allowed"
      >
        {loading ? '生成中…' : '重跑今日'}
      </button>
      {error && <span className="text-xs text-red-600">{error}</span>}
    </div>
  );
}