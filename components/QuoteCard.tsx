"use client";

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

interface QuoteCardProps {
  data: QuoteData;
}

export default function QuoteCard({ data }: QuoteCardProps) {
  const isPositive = data.change >= 0;
  const colorClass = isPositive ? "text-red-600" : "text-green-600";
  const bgClass = isPositive ? "bg-red-50" : "bg-green-50";

  return (
    <div className="bg-white rounded-lg shadow p-6 mb-6">
      <div className="flex justify-between items-start mb-2">
        <div>
          <h2 className="text-2xl font-bold">{data.name}</h2>
          <p className="text-sm text-gray-500">{data.symbol}</p>
        </div>
        <span className="text-xs px-2 py-1 bg-gray-100 rounded text-gray-600">
          {data.marketState}
        </span>
      </div>
      <div className="flex items-baseline gap-3 mb-4">
        <span className="text-4xl font-bold">
          {data.price
            ? `${data.currency === "CNY" ? "¥" : "$"}${data.price.toLocaleString("en-US", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 4,
              })}`
            : "--"}
        </span>
        {data.price > 0 && (
          <span className={`text-base font-medium px-3 py-1 rounded ${bgClass} ${colorClass}`}>
            {isPositive ? "+" : ""}
            {data.change.toFixed(2)} ({isPositive ? "+" : ""}
            {data.changePercent.toFixed(2)}%)
          </span>
        )}
      </div>
      <div className="text-xs text-gray-400">
        昨收: {data.previousClose.toFixed(2)} · 更新时间: {new Date(data.lastUpdated).toLocaleString("zh-CN")}
      </div>
    </div>
  );
}
