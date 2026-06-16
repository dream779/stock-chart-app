'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import HoldingsSummary from '@/components/HoldingsSummary';
import HoldingsTable from '@/components/HoldingsTable';
import HoldingForm, { type DcaPlanInput } from '@/components/HoldingForm';
import { getAllHoldings, saveHolding, deleteHolding } from '@/lib/holdings-api';
import { calculateSummary, type Holding, type HoldingWithQuote } from '@/lib/holdings';
import type { FundQuoteData } from '@/lib/eastmoney';
import {
  getDcaPlans,
  saveDcaPlan,
  deleteDcaPlan,
  settleDcaCode,
  type DcaPlan,
} from '@/lib/dca-api';

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [plans, setPlans] = useState<Record<string, DcaPlan>>({});
  const [quotes, setQuotes] = useState<Record<string, FundQuoteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [banner, setBanner] = useState<{ settled: number; totalSettled: number } | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | undefined>(undefined);
  const [editingPlan, setEditingPlan] = useState<DcaPlan | null>(null);

  const loadPlans = useCallback(async () => {
    try {
      const list = await getDcaPlans();
      const map: Record<string, DcaPlan> = {};
      for (const p of list) map[p.code] = p;
      setPlans(map);
    } catch {
      // Plans are optional; missing API should not block the page
    }
  }, []);

  const loadHoldings = useCallback(async () => {
    try {
      const data = await getAllHoldings();
      setHoldings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取持仓数据失败');
    }
  }, []);

  useEffect(() => {
    (async () => {
      await loadHoldings();
      await loadPlans();
      setLoading(false);
    })();
  }, [loadHoldings, loadPlans]);

  useEffect(() => {
    if (holdings.length === 0) return;

    let cancelled = false;

    Promise.all(
      holdings.map(async (holding) => {
        try {
          const res = await fetch(`/api/fund/${encodeURIComponent(holding.code)}`);
          const json = await res.json();
          if (!json.success) throw new Error(json.error || '获取失败');
          return { code: holding.code, data: json.data as FundQuoteData };
        } catch {
          return { code: holding.code, data: null };
        }
      })
    ).then((results) => {
      if (cancelled) return;
      const map: Record<string, FundQuoteData> = {};
      results.forEach(({ code, data }) => {
        if (data) map[code] = data;
      });
      setQuotes(map);
    });

    return () => {
      cancelled = true;
    };
  }, [holdings]);

  async function runSettlePass() {
    if (holdings.length === 0) return;
    let totalSettled = 0;
    const results = await Promise.allSettled(
      holdings.map((h) => settleDcaCode(h.code))
    );
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value.settled > 0) {
        totalSettled += r.value.settled;
      }
    }
    if (totalSettled > 0) {
      setBanner({ settled: totalSettled, totalSettled });
      await loadHoldings();
      await loadPlans();
      setTimeout(() => setBanner(null), 6000);
    }
  }

  useEffect(() => {
    if (loading) return;
    if (holdings.length === 0) return;
    runSettlePass();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, holdings.length]);

  const holdingsWithQuote: HoldingWithQuote[] = holdings.map((holding) => {
    const quote = quotes[holding.code];
    const plan = plans[holding.code];
    return {
      ...holding,
      quoteName: quote?.name,
      nav: quote?.nav,
      estimatedNav: quote?.estimatedNav,
      changePercent: quote?.changePercent,
      pendingAmount: plan?.pendingAmount ?? 0,
      pendingCount: plan?.pendingCount ?? 0,
      hasDcaPlan: Boolean(plan),
      dcaFrequency: plan?.frequency,
      dcaConfirmationDays: plan?.confirmationDays,
    };
  });

  const summary = calculateSummary(holdingsWithQuote);

  const handleSave = async (data: { holding: Holding; dcaPlan: DcaPlanInput | null }) => {
    try {
      await saveHolding(data.holding);
      const hadPlan = Boolean(editingPlan);
      if (data.dcaPlan) {
        await saveDcaPlan({ code: data.holding.code, ...data.dcaPlan });
      } else if (hadPlan) {
        await deleteDcaPlan(data.holding.code);
      }
      await loadHoldings();
      await loadPlans();
      setShowForm(false);
      setEditingHolding(undefined);
      setEditingPlan(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleEdit = (holding: HoldingWithQuote) => {
    setEditingHolding(holding);
    setEditingPlan(plans[holding.code] ?? null);
    setShowForm(true);
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm('确定删除该持仓吗？相关的定投计划与历史快照也会一并清除。')) return;
    try {
      await deleteHolding(code);
      await loadHoldings();
      await loadPlans();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  const handleAdd = () => {
    setEditingHolding(undefined);
    setEditingPlan(null);
    setShowForm(true);
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm flex items-center justify-between">
            <span>{error}</span>
            <button
              type="button"
              onClick={() => setError('')}
              className="text-red-400 hover:text-red-600"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        )}

        {banner && (
          <div className="bg-blue-50 border border-blue-200 text-blue-800 rounded-lg p-3 text-sm flex items-center justify-between">
            <span>
              本次自动结算 <strong>{banner.settled}</strong> 期定投，已写入历史快照
            </span>
            <button
              type="button"
              onClick={() => setBanner(null)}
              className="text-blue-400 hover:text-blue-600"
              aria-label="关闭"
            >
              ×
            </button>
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div>
              <h1 className="text-lg font-semibold text-gray-900">持仓收益</h1>
              <p className="text-xs text-gray-500 mt-1">
                打开本页时自动结算 T+1 / T+2 已到期的定投期次，并写入每日收益快照
              </p>
            </div>
            <button
              onClick={handleAdd}
              className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
            >
              + 添加持仓
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center text-gray-500 py-8 text-sm">加载中...</div>
        ) : (
          <>
            <HoldingsSummary summary={summary} />
            <HoldingsTable
              holdings={holdingsWithQuote}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          </>
        )}

        {showForm && (
          <HoldingForm
            initialHolding={editingHolding}
            initialDcaPlan={editingPlan}
            pendingCount={editingPlan?.pendingCount}
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingHolding(undefined);
              setEditingPlan(null);
            }}
          />
        )}
      </div>
    </main>
  );
}
