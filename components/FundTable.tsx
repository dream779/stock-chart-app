'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/watchlist-api';

interface FundRow {
  code: string;
  name: string;
  nav: number;
  estimatedNav: number | null;
  changePercent: number | null;
  navDate: string;
  estimateTime: string | null;
  lastUpdated: string;
  error?: boolean;
}

function formatTime(iso?: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FundTable() {
  const router = useRouter();
  const [codes, setCodes] = useState<string[]>([]);
  const [input, setInput] = useState('');
  const [funds, setFunds] = useState<FundRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const data = await getWatchlist();
        setCodes(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '读取自选失败');
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  useEffect(() => {
    if (codes.length === 0) {
      setFunds([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');

    Promise.all(
      codes.map(async (code) => {
        try {
          const res = await fetch(`/api/fund/${encodeURIComponent(code)}`);
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.message || '获取失败');
          }
          return { ...(json.data as FundRow) };
        } catch {
          return {
            code,
            name: code,
            nav: 0,
            estimatedNav: null,
            changePercent: null,
            navDate: '',
            estimateTime: null,
            lastUpdated: '',
            error: true,
          };
        }
      })
    )
      .then((rows) => {
        if (!cancelled) setFunds(rows);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : '请求失败');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [codes]);

  async function handleAdd() {
    const normalized = input.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setError('基金代码必须为6位数字');
      return;
    }
    if (codes.includes(normalized)) {
      setError('该基金已在自选列表中');
      return;
    }
    try {
      await addToWatchlist(normalized);
      setCodes([normalized, ...codes]);
      setInput('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    }
  }

  async function handleRemove(code: string) {
    try {
      await removeFromWatchlist(code);
      setCodes(codes.filter((c) => c !== code));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="输入6位基金代码"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          onClick={handleAdd}
          disabled={input.trim().length !== 6}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          加入自选
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
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
              {loading && codes.length === 0 ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={i}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : codes.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    暂无自选基金，请输入基金代码添加
                  </td>
                </tr>
              ) : (
                funds.map((fund) => {
                  const isPositive = fund.changePercent !== null ? fund.changePercent >= 0 : true;
                  const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

                  return (
                    <tr
                      key={fund.code}
                      onClick={() => router.push(`/fund/${fund.code}`)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                        {fund.name || fund.code}
                        {fund.error && (
                          <span className="ml-2 text-xs text-red-500">(获取失败)</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500">{fund.code}</td>
                      <td className="px-4 py-3">{fund.nav > 0 ? fund.nav.toFixed(4) : '--'}</td>
                      <td className="px-4 py-3">
                        {fund.estimatedNav !== null ? fund.estimatedNav.toFixed(4) : '--'}
                      </td>
                      <td className={`px-4 py-3 font-medium ${colorClass}`}>
                        {fund.changePercent !== null ? (
                          <>
                            {isPositive ? '+' : ''}
                            {fund.changePercent.toFixed(2)}%
                          </>
                        ) : (
                          '--'
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-500 text-xs">
                        {fund.estimateTime || formatTime(fund.lastUpdated)}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemove(fund.code);
                          }}
                          className="text-gray-400 hover:text-red-600 transition"
                          title="删除"
                        >
                          ×
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
