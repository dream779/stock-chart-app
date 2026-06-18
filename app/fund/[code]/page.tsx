'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import NavBar from '@/components/NavBar';
import Chart from '@/components/Chart';
import type { FundQuoteData, FundHistoricalPoint } from '@/lib/eastmoney';

const RANGES = [
  { label: '最近1周', value: '1w' },
  { label: '最近1个月', value: '1m' },
  { label: '最近3个月', value: '3m' },
  { label: '最近1年', value: '1y' },
];

interface FundDetailPageProps {
  params: { code: string };
}

export default function FundDetailPage({ params }: FundDetailPageProps) {
  const { code } = params;
  const [quote, setQuote] = useState<FundQuoteData | null>(null);
  const [history, setHistory] = useState<FundHistoricalPoint[]>([]);
  const [range, setRange] = useState('1y');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    async function fetchQuote() {
      try {
        const res = await fetch(`/api/fund/${encodeURIComponent(code)}`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '获取基金数据失败');
        }
        setQuote(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败');
      }
    }

    fetchQuote();
  }, [code]);

  useEffect(() => {
    async function fetchHistory() {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(`/api/fund/historical/${encodeURIComponent(code)}?range=${range}`);
        const json = await res.json();
        if (!json.success) {
          throw new Error(json.error || '获取历史数据失败');
        }
        setHistory(json.data);
      } catch (err) {
        setError(err instanceof Error ? err.message : '请求失败');
      } finally {
        setLoading(false);
      }
    }

    fetchHistory();
  }, [code, range]);

  const isPositive = quote?.changePercent !== null ? (quote?.changePercent ?? 0) >= 0 : true;
  const stats =
    history.length > 0
      ? {
          currentValue: history[history.length - 1].value,
          changePercent:
            history.length > 1
              ? ((history[history.length - 1].value - history[0].value) / history[0].value) * 100
              : 0,
        }
      : undefined;

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        <Link
          href="/fund"
          className="inline-flex items-center text-sm text-blue-600 hover:text-blue-800"
        >
          ← 返回自选列表
        </Link>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">{quote?.name || '--'}</h1>
              <p className="text-sm text-gray-500">{code}</p>
            </div>
            <div className="flex items-baseline gap-4">
              <div className="text-right">
                <p className="text-xs text-gray-500">单位净值</p>
                <p className="text-xl font-bold text-gray-900">
                  {quote?.nav ? quote.nav.toFixed(4) : '--'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">估算净值</p>
                <p className="text-xl font-bold text-gray-900">
                  {quote?.estimatedNav !== null && quote?.estimatedNav !== undefined
                    ? quote.estimatedNav.toFixed(4)
                    : '--'}
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500">估算涨跌幅</p>
                <p
                  className={`text-xl font-bold ${isPositive ? 'text-red-600' : 'text-green-600'}`}
                >
                  {quote?.changePercent !== null && quote?.changePercent !== undefined
                    ? `${isPositive ? '+' : ''}${quote.changePercent.toFixed(2)}%`
                    : '--'}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow p-4 flex flex-col min-h-[400px]">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
            <h2 className="text-base font-semibold">历史净值走势</h2>
            <div className="flex flex-wrap gap-2">
              {RANGES.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  disabled={loading}
                  className={`px-3 py-1 text-sm rounded-full transition ${
                    range === r.value
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {loading && (
            <div className="flex items-center justify-center flex-1 text-gray-500">加载中...</div>
          )}

          {!loading && (
            <div className="flex-1 min-h-0">
              <Chart
                data={history}
                stats={stats}
                className="h-full"
              />
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
