'use client';

import { useEffect, useState, useCallback } from 'react';
import NavBar from '@/components/NavBar';
import HoldingsSummary from '@/components/HoldingsSummary';
import HoldingsTable from '@/components/HoldingsTable';
import HoldingForm from '@/components/HoldingForm';
import { getAllHoldings, saveHolding, deleteHolding } from '@/lib/holdings-db';
import { calculateSummary, type Holding, type HoldingWithQuote } from '@/lib/holdings';
import type { FundQuoteData } from '@/lib/eastmoney';

export default function HoldingsPage() {
  const [holdings, setHoldings] = useState<Holding[]>([]);
  const [quotes, setQuotes] = useState<Record<string, FundQuoteData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingHolding, setEditingHolding] = useState<Holding | undefined>(undefined);

  const loadHoldings = useCallback(async () => {
    try {
      const data = await getAllHoldings();
      setHoldings(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : '读取持仓数据失败');
    }
  }, []);

  useEffect(() => {
    loadHoldings().finally(() => setLoading(false));
  }, [loadHoldings]);

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

  const holdingsWithQuote: HoldingWithQuote[] = holdings.map((holding) => {
    const quote = quotes[holding.code];
    return {
      ...holding,
      quoteName: quote?.name,
      nav: quote?.nav,
      estimatedNav: quote?.estimatedNav,
      changePercent: quote?.changePercent,
    };
  });

  const summary = calculateSummary(holdingsWithQuote);

  const handleSave = async (holding: Holding) => {
    try {
      await saveHolding(holding);
      await loadHoldings();
      setShowForm(false);
      setEditingHolding(undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  };

  const handleEdit = (holding: HoldingWithQuote) => {
    setEditingHolding(holding);
    setShowForm(true);
  };

  const handleDelete = async (code: string) => {
    if (!window.confirm('确定删除该持仓吗？')) return;
    try {
      await deleteHolding(code);
      await loadHoldings();
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4 space-y-4">
        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
            {error}
          </div>
        )}

        <div className="bg-white rounded-lg shadow p-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <h1 className="text-lg font-semibold text-gray-900">持仓收益</h1>
            <button
              onClick={() => {
                setEditingHolding(undefined);
                setShowForm(true);
              }}
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
            <HoldingsSummary
              totalAssets={summary.totalAssets}
              holdingGain={summary.holdingGain}
              gainRate={summary.gainRate}
            />

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
            onSave={handleSave}
            onCancel={() => {
              setShowForm(false);
              setEditingHolding(undefined);
            }}
          />
        )}
      </div>
    </main>
  );
}
