'use client';

import type { SummaryCalcs } from '@/lib/holdings';

interface HoldingsSummaryProps {
  summary: SummaryCalcs;
}

export default function HoldingsSummary({ summary }: HoldingsSummaryProps) {
  const holdingGainPositive = summary.holdingGain >= 0;
  const gainRatePositive = summary.gainRate >= 0;

  const holdingGainColor = holdingGainPositive ? 'text-red-600' : 'text-green-600';
  const gainRateColor = gainRatePositive ? 'text-red-600' : 'text-green-600';
  const holdingGainSign = holdingGainPositive ? '+' : '';
  const gainRateSign = gainRatePositive ? '+' : '';

  const formatMoney = (value: number) =>
    `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">总资产</p>
        <p className="text-xl font-bold text-gray-900">{formatMoney(summary.totalAssets)}</p>
        <p className="text-xs text-gray-400 mt-1">
          确认 {formatMoney(summary.totalMarketValue)} + 待确认 {formatMoney(summary.totalPending)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益</p>
        <p className={`text-xl font-bold ${holdingGainColor}`}>
          {holdingGainSign}
          {formatMoney(summary.holdingGain)}
        </p>
        <p className="text-xs text-gray-400 mt-1">仅含已确认份额</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益率</p>
        <p className={`text-xl font-bold ${gainRateColor}`}>
          {gainRateSign}
          {summary.gainRate.toFixed(2)}%
        </p>
        <p className="text-xs text-gray-400 mt-1">仅含已确认份额</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">待确认金额</p>
        <p className="text-xl font-bold text-amber-600">{formatMoney(summary.totalPending)}</p>
        <p className="text-xs text-gray-400 mt-1">{summary.totalPendingCount} 期待确认</p>
      </div>
    </div>
  );
}
