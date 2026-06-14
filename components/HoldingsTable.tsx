'use client';

import type { HoldingWithQuote } from '@/lib/holdings';
import { calculateHolding } from '@/lib/holdings';

interface HoldingsTableProps {
  holdings: HoldingWithQuote[];
  onEdit: (holding: HoldingWithQuote) => void;
  onDelete: (code: string) => void;
}

export default function HoldingsTable({ holdings, onEdit, onDelete }: HoldingsTableProps) {
  const formatMoney = (value: number) =>
    `¥${value.toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  const formatGainMoney = (value: number) => {
    const isPositive = value >= 0;
    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';
    const sign = isPositive ? '+' : '';
    return { colorClass, sign, text: `${sign}${formatMoney(value)}` };
  };

  if (holdings.length === 0) {
    return (
      <div className="bg-white rounded-lg shadow p-8 text-center text-gray-500 text-sm">
        暂无持仓，点击右上角「添加持仓」录入第一只基金
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-left">
          <thead className="bg-gray-50 text-gray-600 font-medium">
            <tr>
              <th className="px-4 py-3">基金名称</th>
              <th className="px-4 py-3">代码</th>
              <th className="px-4 py-3 text-right">持有金额</th>
              <th className="px-4 py-3 text-right">持有收益</th>
              <th className="px-4 py-3 text-right">收益率</th>
              <th className="px-4 py-3 text-right">估算收益</th>
              <th className="px-4 py-3 text-right">操作</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {holdings.map((holding) => {
              const calcs = calculateHolding(holding);
              const holdingGainFmt = formatGainMoney(calcs.holdingGain);
              const estimatedGainFmt =
                calcs.estimatedGain !== null ? formatGainMoney(calcs.estimatedGain) : null;

              return (
                <tr key={holding.code} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                    {holding.quoteName || holding.name || holding.code}
                  </td>
                  <td className="px-4 py-3 text-gray-500">{holding.code}</td>
                  <td className="px-4 py-3 text-right">{formatMoney(holding.amount)}</td>
                  <td className={`px-4 py-3 text-right font-medium ${holdingGainFmt.colorClass}`}>
                    {holdingGainFmt.text}
                  </td>
                  <td className={`px-4 py-3 text-right font-medium ${holdingGainFmt.colorClass}`}>
                    {holdingGainFmt.sign}
                    {calcs.gainRate.toFixed(2)}%
                  </td>
                  <td className="px-4 py-3 text-right">
                    {estimatedGainFmt ? (
                      <span className={estimatedGainFmt.colorClass}>{estimatedGainFmt.text}</span>
                    ) : (
                      '--'
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      type="button"
                      onClick={() => onEdit(holding)}
                      className="text-blue-600 hover:text-blue-800 mr-3"
                    >
                      编辑
                    </button>
                    <button
                      type="button"
                      onClick={() => onDelete(holding.code)}
                      className="text-gray-400 hover:text-red-600"
                    >
                      删除
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
