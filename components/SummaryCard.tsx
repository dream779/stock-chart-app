'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FundItem {
  id: number;
  code: string;
  fundName: string;
  summary: string;
  advice: string;
  tableMd: string | null;
  status: 'success' | 'failed';
  errorMessage: string | null;
  createdAt: string;
  model: string;
  inputTokens: number;
  outputTokens: number;
}

interface Card {
  summaryDate: string;
  isToday: boolean;
  fundCount: number;
  funds: FundItem[];
}

const PREVIEW_LEN = 500;

function renderTableMarkdown(md: string | null) {
  if (!md) return null;
  const lines = md.split('\n').filter((l) => l.trim().startsWith('|'));
  if (lines.length < 2) return <pre className="whitespace-pre-wrap text-xs">{md}</pre>;
  const header = lines[0].split('|').map((c) => c.trim()).filter(Boolean);
  const rows = lines.slice(2).map((l) => l.split('|').map((c) => c.trim()).filter(Boolean));
  return (
    <table className="text-xs border-collapse w-full">
      <thead>
        <tr>
          {header.map((h, i) => (
            <th key={i} className="border border-gray-200 px-2 py-1 bg-gray-50 text-left">
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, i) => (
          <tr key={i}>
            {r.map((c, j) => (
              <td key={j} className="border border-gray-200 px-2 py-1 align-top">
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function FundSection({ fund }: { fund: FundItem }) {
  const [expanded, setExpanded] = useState(false);
  const needsTruncation = fund.summary.length > PREVIEW_LEN;
  const preview = needsTruncation ? fund.summary.slice(0, PREVIEW_LEN) + '…' : fund.summary;

  if (fund.status === 'failed') {
    return (
      <div className="border-l-4 border-red-400 pl-3 py-1">
        <div className="flex items-baseline gap-2 flex-wrap">
          <span className="font-medium text-gray-900 text-sm">{fund.fundName || fund.code}</span>
          <span className="text-xs text-gray-500">({fund.code})</span>
          <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-700 rounded">失败</span>
        </div>
        <p className="text-xs text-red-600 mt-1">
          {fund.errorMessage || '生成失败，请点「重跑今日」重试'}
        </p>
      </div>
    );
  }

  return (
    <div className="border-l-4 border-blue-200 pl-3 py-1">
      <div className="flex items-baseline gap-2 flex-wrap">
        <span className="font-medium text-gray-900 text-sm">{fund.fundName || fund.code}</span>
        <span className="text-xs text-gray-500">({fund.code})</span>
      </div>
      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap">{expanded ? fund.summary : preview}</p>
      {needsTruncation && (
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="text-xs text-blue-600 hover:text-blue-800 mt-1"
        >
          {expanded ? '收起' : '展开全部'}
        </button>
      )}
      {expanded && (
        <div className="mt-3 space-y-2">
          <div>
            <h4 className="text-xs font-semibold text-gray-700 mb-1">投资建议</h4>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{fund.advice}</p>
          </div>
          {fund.tableMd && (
            <div>
              <h4 className="text-xs font-semibold text-gray-700 mb-1">关键要点</h4>
              {renderTableMarkdown(fund.tableMd)}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function SummaryCard({ card }: { card: Card }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const failedCount = card.funds.filter((f) => f.status === 'failed').length;
  const totalTokens = card.funds.reduce((sum, f) => sum + f.inputTokens + f.outputTokens, 0);

  async function handleDelete() {
    if (!window.confirm(`确认删除 ${card.summaryDate} 的 ${card.fundCount} 条总结？此操作不可恢复`)) {
      return;
    }
    setDeleting(true);
    setDeleteError(null);
    try {
      const res = await fetch(`/api/summaries?date=${encodeURIComponent(card.summaryDate)}`, {
        method: 'DELETE',
      });
      const json = await res.json();
      if (!res.ok || !json.success) {
        throw new Error(json.message || '删除失败');
      }
      router.refresh();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : String(err));
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className={`bg-white rounded-lg shadow p-4 ${failedCount > 0 ? 'border border-red-200' : ''}`}>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <span className="text-base font-semibold text-gray-900">{card.summaryDate}</span>
        {card.isToday && (
          <span className="text-xs px-2 py-0.5 bg-blue-600 text-white rounded">今日</span>
        )}
        <span className="text-xs text-gray-500">{card.fundCount} 个基金</span>
        {failedCount > 0 && (
          <span className="text-xs px-2 py-0.5 bg-red-100 text-red-700 rounded">
            {failedCount} 只失败
          </span>
        )}
        {card.fundCount > 0 && (
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="ml-auto text-xs text-red-600 hover:text-red-800 disabled:text-gray-400"
          >
            {deleting ? '删除中...' : '删除本日'}
          </button>
        )}
      </div>

      {deleteError && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2 mb-3">
          {deleteError}
        </div>
      )}

      {failedCount > 0 && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2 mb-3">
          本日有 {failedCount} 只基金生成失败，点击右上角「重跑今日」可重新生成。
        </div>
      )}

      <div className="space-y-3">
        {card.funds.map((fund) => (
          <FundSection key={fund.id} fund={fund} />
        ))}
      </div>

      <div className="text-xs text-gray-400 mt-3 pt-2 border-t border-gray-100">
        tokens: {totalTokens.toLocaleString()}
      </div>
    </div>
  );
}