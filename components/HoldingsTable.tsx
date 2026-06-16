'use client';

import { useState } from 'react';
import type { HoldingWithQuote } from '@/lib/holdings';
import { calculateHolding } from '@/lib/holdings';
import DcaStatusBadge from './DcaStatusBadge';
import ReturnHistoryChart from './ReturnHistoryChart';

interface HoldingsTableProps {
  holdings: HoldingWithQuote[];
  onEdit: (holding: HoldingWithQuote) => void;
  onDelete: (code: string) => void;
}

export default function HoldingsTable({ holdings, onEdit, onDelete }: HoldingsTableProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

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
    <div className="space-y-2">
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="px-4 py-3">基金名称</th>
                <th className="px-4 py-3 text-right">确认份额</th>
                <th className="px-4 py-3 text-right">确认市值</th>
                <th className="px-4 py-3 text-right">持有收益</th>
                <th className="px-4 py-3 text-right">收益率</th>
                <th className="px-4 py-3 text-right">待确认</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {holdings.map((holding) => {
                const calcs = calculateHolding(holding);
                const holdingGainFmt = formatGainMoney(calcs.holdingGain);
                const isExpanded = expanded === holding.code;
                return (
                  <>
                    <tr
                      key={holding.code}
                      onClick={() =>
                        setExpanded((cur) => (cur === holding.code ? null : holding.code))
                      }
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
                      <td className="px-4 py-3 font-medium text-gray-900 max-w-[220px]">
                        <div className="flex flex-col gap-1">
                          <span className="truncate">
                            {holding.quoteName || holding.name || holding.code}
                          </span>
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xs text-gray-500">{holding.code}</span>
                            {holding.hasDcaPlan && holding.dcaFrequency && (
                              <DcaStatusBadge
                                frequency={holding.dcaFrequency}
                                pendingCount={holding.pendingCount ?? 0}
                                pendingAmount={holding.pendingAmount ?? 0}
                              />
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        {holding.shares.toLocaleString('zh-CN', { maximumFractionDigits: 4 })}
                      </td>
                      <td className="px-4 py-3 text-right">{formatMoney(calcs.marketValue)}</td>
                      <td className={`px-4 py-3 text-right font-medium ${holdingGainFmt.colorClass}`}>
                        {holdingGainFmt.text}
                      </td>
                      <td
                        className={`px-4 py-3 text-right font-medium ${holdingGainFmt.colorClass}`}
                      >
                        {holdingGainFmt.sign}
                        {calcs.gainRate.toFixed(2)}%
                      </td>
                      <td className="px-4 py-3 text-right">
                        {holding.pendingAmount && holding.pendingAmount > 0 ? (
                          <div className="flex flex-col items-end">
                            <span className="text-amber-600 font-medium">
                              {formatMoney(holding.pendingAmount)}
                            </span>
                            <span className="text-xs text-gray-500">
                              {holding.pendingCount} 期
                            </span>
                          </div>
                        ) : (
                          <span className="text-gray-300">--</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onEdit(holding);
                          }}
                          className="text-blue-600 hover:text-blue-800 mr-3"
                        >
                          编辑
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onDelete(holding.code);
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          删除
                        </button>
                      </td>
                    </tr>
                    {isExpanded && (
                      <tr key={`${holding.code}-expanded`} className="bg-gray-50">
                        <td colSpan={7} className="px-4 py-3">
                          <ReturnHistoryChart code={holding.code} />
                        </td>
                      </tr>
                    )}
                  </>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500">
        点击行可展开历史收益曲线。收益 = 确认份额 × 当前 NAV − 持仓成本，待确认部分不计入。
      </p>
    </div>
  );
}
