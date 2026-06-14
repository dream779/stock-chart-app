'use client';

import { useEffect, useState } from 'react';
import type { Holding } from '@/lib/holdings';

interface HoldingFormProps {
  initialHolding?: Partial<Holding>;
  onSave: (holding: Holding) => void;
  onCancel: () => void;
}

interface FormState {
  code: string;
  name: string;
  shares: string;
  amount: string;
  costPrice: string;
  pendingAmount: string;
}

export default function HoldingForm({ initialHolding, onSave, onCancel }: HoldingFormProps) {
  const isEdit = Boolean(initialHolding?.code);

  const [form, setForm] = useState<FormState>({
    code: '',
    name: '',
    shares: '',
    amount: '',
    costPrice: '',
    pendingAmount: '',
  });

  const [error, setError] = useState('');

  useEffect(() => {
    if (initialHolding) {
      setForm({
        code: initialHolding.code || '',
        name: initialHolding.name || '',
        shares: initialHolding.shares?.toString() || '',
        amount: initialHolding.amount?.toString() || '',
        costPrice: initialHolding.costPrice?.toString() || '',
        pendingAmount: initialHolding.pendingAmount?.toString() || '0',
      });
    }
  }, [initialHolding]);

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        onCancel();
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onCancel]);

  function handleChange(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setError('');
  }

  function validate(): Holding | null {
    const code = form.code.trim();
    if (!/^\d{6}$/.test(code)) {
      setError('基金代码必须为 6 位数字');
      return null;
    }

    if (form.shares.trim() === '') {
      setError('持有份额不能为空');
      return null;
    }
    if (form.amount.trim() === '') {
      setError('持有金额不能为空');
      return null;
    }
    if (form.costPrice.trim() === '') {
      setError('持仓成本价不能为空');
      return null;
    }

    const shares = Number(form.shares);
    const amount = Number(form.amount);
    const costPrice = Number(form.costPrice);
    const pendingAmount = Number(form.pendingAmount || 0);

    if (!Number.isFinite(shares) || shares <= 0) {
      setError('持有份额必须大于 0');
      return null;
    }
    if (!Number.isFinite(amount) || amount < 0) {
      setError('持有金额不能为负数');
      return null;
    }
    if (!Number.isFinite(costPrice) || costPrice <= 0) {
      setError('持仓成本价必须大于 0');
      return null;
    }
    if (!Number.isFinite(pendingAmount) || pendingAmount < 0) {
      setError('待确认金额不能为负数');
      return null;
    }

    const now = new Date().toISOString();
    return {
      code,
      name: form.name.trim(),
      shares,
      amount,
      costPrice,
      pendingAmount,
      createdAt: initialHolding?.createdAt || now,
      updatedAt: now,
    };
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const holding = validate();
    if (holding) onSave(holding);
  }

  const inputClass =
    'w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600';

  return (
    <div
      className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          onCancel();
        }
      }}
    >
      <div
        className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-labelledby="holding-form-title"
      >
        <div className="p-4 border-b border-gray-100">
          <h2 id="holding-form-title" className="text-lg font-semibold text-gray-900">
            {isEdit ? '编辑持仓' : '添加持仓'}
          </h2>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          {error && (
            <div
              className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm"
              role="alert"
            >
              {error}
            </div>
          )}

          <div>
            <label htmlFor="holding-code" className="block text-sm font-medium text-gray-700 mb-1">
              基金代码
            </label>
            <input
              id="holding-code"
              type="text"
              inputMode="numeric"
              maxLength={6}
              disabled={isEdit}
              value={form.code}
              onChange={(e) => handleChange('code', e.target.value.replace(/\D/g, '').slice(0, 6))}
              placeholder="如 017641"
              className={`${inputClass} ${isEdit ? 'bg-gray-100' : ''}`}
            />
          </div>

          <div>
            <label htmlFor="holding-name" className="block text-sm font-medium text-gray-700 mb-1">
              基金名称
            </label>
            <input
              id="holding-name"
              type="text"
              value={form.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="可选，提交后会用实时名称覆盖"
              className={inputClass}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="holding-shares"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                持有份额
              </label>
              <input
                id="holding-shares"
                type="number"
                step="0.0001"
                value={form.shares}
                onChange={(e) => handleChange('shares', e.target.value)}
                placeholder="10000"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="holding-amount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                持有金额
              </label>
              <input
                id="holding-amount"
                type="number"
                step="0.01"
                value={form.amount}
                onChange={(e) => handleChange('amount', e.target.value)}
                placeholder="8500.00"
                className={inputClass}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label
                htmlFor="holding-costPrice"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                持仓成本价
              </label>
              <input
                id="holding-costPrice"
                type="number"
                step="0.0001"
                value={form.costPrice}
                onChange={(e) => handleChange('costPrice', e.target.value)}
                placeholder="0.8080"
                className={inputClass}
              />
            </div>
            <div>
              <label
                htmlFor="holding-pendingAmount"
                className="block text-sm font-medium text-gray-700 mb-1"
              >
                待确认金额
              </label>
              <input
                id="holding-pendingAmount"
                type="number"
                step="0.01"
                value={form.pendingAmount}
                onChange={(e) => handleChange('pendingAmount', e.target.value)}
                placeholder="0"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 text-sm font-medium rounded-lg hover:bg-gray-50 transition"
            >
              取消
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              保存
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
