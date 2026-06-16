'use client';

import type { DcaFrequency } from '@/lib/dca-api';

interface DcaPlanFormState {
  enabled: boolean;
  amountPerPeriod: string;
  frequency: DcaFrequency;
  startDate: string;
  confirmationDays: number;
}

interface DcaPlanSectionProps {
  value: DcaPlanFormState;
  onChange: (next: DcaPlanFormState) => void;
  pendingCount?: number;
}

const FREQUENCY_OPTIONS: { value: DcaFrequency; label: string; hint: string }[] = [
  { value: 'daily', label: '每日', hint: '每个工作日都定投' },
  { value: 'weekly', label: '每周', hint: '每周同一日定投' },
  { value: 'monthly', label: '每月', hint: '每月同一日定投' },
];

const CONFIRMATION_OPTIONS = [
  { value: 1, label: 'T+1', hint: '下一个工作日' },
  { value: 2, label: 'T+2', hint: '第二个工作日（默认）' },
];

export default function DcaPlanSection({ value, onChange, pendingCount }: DcaPlanSectionProps) {
  function patch(p: Partial<DcaPlanFormState>) {
    onChange({ ...value, ...p });
  }

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-gray-50 space-y-3">
      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={value.enabled}
          onChange={(e) => patch({ enabled: e.target.checked })}
          className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500"
        />
        <span className="text-sm font-medium text-gray-700">启用定投计划</span>
        {pendingCount !== undefined && pendingCount > 0 && (
          <span className="ml-auto text-xs text-gray-500">
            当前 {pendingCount} 期待确认
          </span>
        )}
      </label>

      {value.enabled && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                每期金额
              </label>
              <input
                type="number"
                step="0.01"
                value={value.amountPerPeriod}
                onChange={(e) => patch({ amountPerPeriod: e.target.value })}
                placeholder="100.00"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">
                开始日期
              </label>
              <input
                type="date"
                value={value.startDate}
                onChange={(e) => patch({ startDate: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">频率</label>
            <div className="grid grid-cols-3 gap-2">
              {FREQUENCY_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch({ frequency: opt.value })}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    value.frequency === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">确认日</label>
            <div className="grid grid-cols-2 gap-2">
              {CONFIRMATION_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => patch({ confirmationDays: opt.value })}
                  className={`px-3 py-2 text-sm rounded-lg border transition ${
                    value.confirmationDays === opt.value
                      ? 'bg-blue-600 text-white border-blue-600'
                      : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'
                  }`}
                  title={opt.hint}
                >
                  {opt.label}
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-1">
              大多数场外基金 T+2 确认，部分货币 / QDII 基金 T+1
            </p>
          </div>
        </>
      )}
    </div>
  );
}

export type { DcaPlanFormState };
