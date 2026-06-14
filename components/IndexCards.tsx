"use client";

import { useEffect, useState } from "react";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";
import timezone from "dayjs/plugin/timezone";

interface IndexData {
  symbol: string;
  displayName: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  marketState: string;
  currency: string;
  lastUpdated: string;
  error?: boolean;
}

dayjs.extend(utc);
dayjs.extend(timezone);

function formatUpdateTime(iso?: string): string {
  if (!iso) return "--";
  const d = dayjs(iso);
  if (!d.isValid()) return "--";
  // 美股最后更新日期按美东时间（America/New_York）显示，精确到天
  return d.tz("America/New_York").format("YYYY-MM-DD");
}

export default function IndexCards() {
  const [indices, setIndices] = useState<IndexData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch("/api/indices")
      .then((res) => res.json())
      .then((result) => {
        if (result.success) {
          setIndices(result.data);
        } else {
          setError(result.error || "获取指数数据失败");
        }
      })
      .catch((err) => {
        setError(err.message || "网络错误");
      })
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {[1, 2].map((i) => (
          <div key={i} className="bg-white rounded-lg shadow p-6 h-32 animate-pulse" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-4 mb-6">
        {error}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
      {indices.map((index) => {
        const isPositive = index.change >= 0;
        const colorClass = isPositive ? "text-red-600" : "text-green-600";
        const bgClass = isPositive ? "bg-red-50" : "bg-green-50";

        return (
          <div key={index.symbol} className="bg-white rounded-lg shadow p-6">
            <div className="flex justify-between items-start mb-2">
              <div>
                <h2 className="text-xl font-bold">{index.displayName}</h2>
                <p className="text-sm text-gray-500">{index.symbol}</p>
              </div>
              <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
                {index.marketState}
              </span>
            </div>
            <div className="flex items-baseline gap-3">
              <span className="text-3xl font-bold">
                {index.price ? index.price.toLocaleString("en-US", { maximumFractionDigits: 2 }) : "--"}
              </span>
              {index.price > 0 && (
                <span className={`text-sm font-medium px-2 py-1 rounded ${bgClass} ${colorClass}`}>
                  {isPositive ? "+" : ""}
                  {index.change.toFixed(2)} ({isPositive ? "+" : ""}
                  {index.changePercent.toFixed(2)}%)
                </span>
              )}
            </div>
            <div className="flex items-center justify-between mt-4">
              {index.error ? (
                <p className="text-xs text-red-500">数据获取失败</p>
              ) : (
                <div />
              )}
              <p className="text-xs text-gray-400">
                更新于 {formatUpdateTime(index.lastUpdated)}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
