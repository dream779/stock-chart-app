"use client";

import { useState } from "react";
import IndexCards from "@/components/IndexCards";
import QuoteCard from "@/components/QuoteCard";
import Chart from "@/components/Chart";

interface QuoteData {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  previousClose: number;
  marketState: string;
  currency: string;
  lastUpdated: string;
}

interface HistoricalPoint {
  time: string;
  value: number;
}

const RANGES = [
  { label: "1个月", value: "1m" },
  { label: "3个月", value: "3m" },
  { label: "6个月", value: "6m" },
  { label: "1年", value: "1y" },
  { label: "5年", value: "5y" },
];

const PRESETS = [
  { label: "QQQ", symbol: "QQQ" },
  { label: "VOO", symbol: "VOO" },
  { label: "AAPL", symbol: "AAPL" },
  { label: "TSLA", symbol: "TSLA" },
];

export default function Home() {
  const [symbol, setSymbol] = useState("");
  const [range, setRange] = useState("1y");
  const [quote, setQuote] = useState<QuoteData | null>(null);
  const [history, setHistory] = useState<HistoricalPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function fetchData(inputSymbol: string) {
    if (!inputSymbol.trim()) return;

    setLoading(true);
    setError("");
    setQuote(null);
    setHistory([]);

    try {
      const encodedSymbol = encodeURIComponent(inputSymbol.trim().toUpperCase());
      const [quoteRes, historyRes] = await Promise.all([
        fetch(`/api/quote/${encodedSymbol}`),
        fetch(`/api/historical/${encodedSymbol}?range=${range}`),
      ]);

      const quoteJson = await quoteRes.json();
      const historyJson = await historyRes.json();

      if (!quoteJson.success) {
        throw new Error(quoteJson.error || "获取行情失败");
      }

      setQuote(quoteJson.data);
      setHistory(historyJson.success ? historyJson.data : []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "请求失败");
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    fetchData(symbol);
  }

  return (
    <main className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-3xl font-bold mb-2">美股基金行情看板</h1>
      <p className="text-gray-500 mb-8">查看标普500、纳斯达克100及自选股票基金走势</p>

      <IndexCards />

      <div className="bg-white rounded-lg shadow p-6 mb-6">
        <h2 className="text-lg font-semibold mb-4">查询自选标的</h2>
        <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            value={symbol}
            onChange={(e) => setSymbol(e.target.value.toUpperCase())}
            placeholder="输入代码，如 QQQ、VOO、AAPL、TSLA"
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:bg-blue-300 transition"
          >
            {loading ? "查询中..." : "查询"}
          </button>
        </form>

        <div className="flex flex-wrap gap-2 mb-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.symbol}
              onClick={() => {
                setSymbol(preset.symbol);
                fetchData(preset.symbol);
              }}
              className="px-3 py-1 text-sm bg-gray-100 hover:bg-gray-200 rounded-full transition"
            >
              {preset.label}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap gap-2">
          {RANGES.map((r) => (
            <button
              key={r.value}
              onClick={() => {
                setRange(r.value);
                if (symbol) fetchData(symbol);
              }}
              className={`px-3 py-1 text-sm rounded-full transition ${
                range === r.value
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
          {error}
        </div>
      )}

      {quote && <QuoteCard data={quote} />}

      {history.length > 0 && (
        <Chart
          data={history}
          title={`${quote?.name || symbol} 历史走势 (${RANGES.find((r) => r.value === range)?.label})`}
        />
      )}

      {history.length === 0 && quote && !loading && (
        <div className="bg-yellow-50 border border-yellow-200 text-yellow-700 rounded-lg p-4">
          暂无历史数据
        </div>
      )}
    </main>
  );
}
