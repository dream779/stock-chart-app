'use client';

import type { SummaryCalcs } from '@/lib/holdings';

interface HoldingsSummaryProps {
  summary: SummaryCalcs;
}

export default function HoldingsSummary({ summary }: HoldingsSummaryProps) {
  const holdingGainPositive = summary.holdingGain >= 0;
  const gainRatePositive = summary.gainRate >= 0;
  const todayGainPositive = summary.totalTodayGain >= 0;

  const holdingGainColor = holdingGainPositive ? 'text-red-600' : 'text-green-600';
  const gainRateColor = gainRatePositive ? 'text-red-600' : 'text-green-600';
  const todayGainColor = todayGainPositive ? 'text-red-600' : 'text-green-600';
  const holdingGainSign = holdingGainPositive ? '+' : '';
  const gainRateSign = gainRatePositive ? '+' : '';
  const todayGainSign = todayGainPositive ? '+' : '';

  const formatMoney = (value: number) =>
    `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const dashSkeleton = (
    <span className="inline-block h-7 w-28 bg-gray-100 rounded animate-pulse align-middle" />
  );

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">总资产</p>
        {summary.hasAnyNav ? (
          <>
            <p className="text-xl font-bold text-gray-900">{formatMoney(summary.totalAssets)}</p>
            <p className="text-xs text-gray-400 mt-1">
              确认 {formatMoney(summary.totalMarketValue)} + 待确认 {formatMoney(summary.totalPending)}
            </p>
          </>
        ) : (
          <>
            {dashSkeleton}
            <p className="text-xs text-gray-400 mt-1">净值加载中…</p>
          </>
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益</p>
        {summary.hasAnyNav ? (
          <>
            <p className={`text-xl font-bold ${holdingGainColor}`}>
              {holdingGainSign}
              {formatMoney(summary.holdingGain)}
            </p>
            <p className="text-xs text-gray-400 mt-1">仅含已确认份额</p>
          </>
        ) : (
          <>
            {dashSkeleton}
            <p className="text-xs text-gray-400 mt-1">净值加载中…</p>
          </>
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益率</p>
        {summary.hasAnyNav ? (
          <>
            <p className={`text-xl font-bold ${gainRateColor}`}>
              {gainRateSign}
              {summary.gainRate.toFixed(2)}%
            </p>
            <p className="text-xs text-gray-400 mt-1">仅含已确认份额</p>
          </>
        ) : (
          <>
            {dashSkeleton}
            <p className="text-xs text-gray-400 mt-1">净值加载中…</p>
          </>
        )}
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">今日收益</p>
        {summary.hasAnyTodayGain ? (
          <>
            <p className={`text-xl font-bold ${todayGainColor}`}>
              {todayGainSign}
              {formatMoney(summary.totalTodayGain)}
            </p>
            <p className="text-xs text-gray-400 mt-1">截至今日收盘</p>
          </>
        ) : (
          <>
            <span className="inline-block px-2 py-0.5 text-xs bg-gray-100 text-gray-500 rounded">
              未更新
            </span>
            <p className="text-xs text-gray-400 mt-1">今日 NAV 公布后更新</p>
          </>
        )}
      </div>
    </div>
  );
}
