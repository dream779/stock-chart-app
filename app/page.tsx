"use client";

import { useEffect, useState } from "react";
import IndexCards from "@/components/IndexCards";
import Chart from "@/components/Chart";

interface HistoricalPoint {
  time: string;
  value: number;
}

const INDICES = [
  { symbol: "^GSPC", name: "标普 500" },
  { symbol: "^NDX", name: "纳斯达克 100" },
];

const RANGES = [
  { label: "最近1周", value: "1w" },
  { label: "最近1个月", value: "1m" },
  { label: "最近3个月", value: "3m" },
  { label: "最近1年", value: "1y" },
];

export default function Home() {
  const [range, setRange] = useState("1y");
  const [histories, setHistories] = useState<Record<string, HistoricalPoint[]>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchHistories(selectedRange: string) {
    setLoading(true);
    setError("");

    try {
      const results = await Promise.all(
        INDICES.map(async (index) => {
          const encodedSymbol = encodeURIComponent(index.symbol);
          const res = await fetch(`/api/historical/${encodedSymbol}?range=${selectedRange}`);
          const json = await res.json();

          if (!json.success) {
            throw new Error(`${index.name}: ${json.error || "获取历史数据失败"}`);
          }

          return { symbol: index.symbol, data: json.data as HistoricalPoint[] };
        })
      );

      const map: Record<string, HistoricalPoint[]> = {};
      results.forEach((item) => {
        map[item.symbol] = item.data;
      });

      setHistories(map);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchHistories(range);
  }, [range]);

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">美股基金行情看板</h1>
      <p className="text-gray-500 mb-8">查看标普 500、纳斯达克 100 指数走势</p>

      <IndexCards />

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
          <h2 className="text-lg font-semibold">历史走势</h2>
          <div className="flex flex-wrap gap-2">
            {RANGES.map((r) => (
              <button
                key={r.value}
                onClick={() => setRange(r.value)}
                disabled={loading}
                className={`px-3 py-1 text-sm rounded-full transition ${
                  range === r.value
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700 disabled:bg-gray-50"
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="flex items-center justify-center h-40 text-gray-500">
            加载中...
          </div>
        )}

        {error && !loading && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
            {error}
          </div>
        )}

        {!loading && (
          <div className="space-y-6">
            {INDICES.map((index) => {
              const data = histories[index.symbol] || [];
              return (
                <Chart
                  key={index.symbol}
                  data={data}
                  title={`${index.name} (${index.symbol}) - ${RANGES.find((r) => r.value === range)?.label}`}
                />
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
