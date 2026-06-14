'use client';

interface HoldingsSummaryProps {
  totalAssets: number;
  holdingGain: number;
  gainRate: number;
}

export default function HoldingsSummary({
  totalAssets,
  holdingGain,
  gainRate,
}: HoldingsSummaryProps) {
  const holdingGainPositive = holdingGain >= 0;
  const gainRatePositive = gainRate >= 0;

  const holdingGainColor = holdingGainPositive ? 'text-red-600' : 'text-green-600';
  const gainRateColor = gainRatePositive ? 'text-red-600' : 'text-green-600';
  const holdingGainSign = holdingGainPositive ? '+' : '';
  const gainRateSign = gainRatePositive ? '+' : '';

  const formatMoney = (value: number) =>
    `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">总资产</p>
        <p className="text-xl font-bold text-gray-900">{formatMoney(totalAssets)}</p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益</p>
        <p className={`text-xl font-bold ${holdingGainColor}`}>
          {holdingGainSign}
          {formatMoney(holdingGain)}
        </p>
      </div>
      <div className="bg-white rounded-lg shadow p-4">
        <p className="text-xs text-gray-500 mb-1">持有收益率</p>
        <p className={`text-xl font-bold ${gainRateColor}`}>
          {gainRateSign}
          {gainRate.toFixed(2)}%
        </p>
      </div>
    </div>
  );
}
