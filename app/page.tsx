'use client';

import { useEffect, useState } from 'react';
import IndexCards from '@/components/IndexCards';
import Chart from '@/components/Chart';

interface HistoricalPoint {
  time: string;
  value: number;
}

interface PeriodStats {
  currentValue: number;
  startValue: number;
  changePercent: number;
}

const INDICES = [
  { symbol: '^GSPC', name: '标普 500' },
  { symbol: '^NDX', name: '纳斯达克 100' },
];

const RANGES = [
  { label: '最近1周', value: '1w' },
  { label: '最近1个月', value: '1m' },
  { label: '最近3个月', value: '3m' },
  { label: '最近1年', value: '1y' },
];

export default function Home() {
  const [range, setRange] = useState('1y');
  const [selectedSymbol, setSelectedSymbol] = useState('^GSPC');
  const [histories, setHistories] = useState<Record<string, HistoricalPoint[]>>({});
  const [stats, setStats] = useState<Record<string, PeriodStats>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function fetchHistories(selectedRange: string) {
    setLoading(true);
    setError('');

    try {
      const results = await Promise.all(
        INDICES.map(async (index) => {
          const encodedSymbol = encodeURIComponent(index.symbol);
          const res = await fetch(`/api/historical/${encodedSymbol}?range=${selectedRange}`);
          const json = await res.json();

          if (!json.success) {
            throw new Error(`${index.name}: ${json.error || '获取历史数据失败'}`);
          }

          return { symbol: index.symbol, data: json.data as HistoricalPoint[] };
        })
      );

      const map: Record<string, HistoricalPoint[]> = {};
      const newStats: Record<string, PeriodStats> = {};

      results.forEach((item) => {
        map[item.symbol] = item.data;

        const sorted = [...item.data].sort(
          (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime()
        );
        if (sorted.length > 0) {
          const startValue = sorted[0].value;
          const currentValue = sorted[sorted.length - 1].value;
          const changePercent =
            sorted.length > 1 ? ((currentValue - startValue) / startValue) * 100 : 0;
          newStats[item.symbol] = { currentValue, startValue, changePercent };
        }
      });

      setHistories(map);
      setStats(newStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : '请求失败');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistories(range);
  }, [range]);

  return (
    <main className="h-screen flex flex-col max-w-5xl mx-auto px-4 py-4">
      <IndexCards selectedSymbol={selectedSymbol} onSelect={setSelectedSymbol} />

      <div className="bg-white rounded-lg shadow p-4 flex flex-col flex-1 min-h-0">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
          <h2 className="text-base font-semibold">历史走势</h2>
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

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-3">
            {error}
          </div>
        )}

        {!loading && (
          <div className="flex-1 min-h-0">
            <Chart
              data={histories[selectedSymbol] || []}
              title={`${INDICES.find((i) => i.symbol === selectedSymbol)?.name} - ${
                RANGES.find((r) => r.value === range)?.label
              }`}
              stats={stats[selectedSymbol]}
              className="h-full"
            />
          </div>
        )}
      </div>
    </main>
  );
}
