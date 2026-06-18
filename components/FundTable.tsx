'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  getWatchlist,
  addToWatchlist,
  removeFromWatchlist,
  reorderWatchlist,
} from '@/lib/watchlist-api';

interface FundRow {
  code: string;
  name: string;
  nav: number;
  estimatedNav: number | null;
  changePercent: number | null;
  navDate: string;
  estimateTime: string | null;
  lastUpdated: string;
}

type Row =
  | { code: string; status: 'loading' }
  | { code: string; status: 'loaded'; data: FundRow }
  | { code: string; status: 'error'; error: string };

type DropPosition = 'before' | 'after';

function formatTime(iso?: string | null): string {
  if (!iso) return '--';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '--';
  return d.toLocaleString('zh-CN', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export default function FundTable() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const controllersRef = useRef<Map<string, AbortController>>(new Map());

  const [draggingCode, setDraggingCode] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<{ code: string; position: DropPosition } | null>(
    null
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const codes = await getWatchlist();
        if (cancelled) return;
        setRows(codes.map((code) => ({ code, status: 'loading' as const })));
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : '读取自选失败');
        }
      } finally {
        if (!cancelled) {
          setLoadingCodes(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const loadingRows = rows.filter(
      (r): r is Extract<Row, { status: 'loading' }> => r.status === 'loading'
    );
    if (loadingRows.length === 0) return;

    const controllers = controllersRef.current;

    for (const row of loadingRows) {
      if (controllers.has(row.code)) continue;
      const controller = new AbortController();
      controllers.set(row.code, controller);

      (async () => {
        try {
          const res = await fetch(`/api/fund/${encodeURIComponent(row.code)}`, {
            signal: controller.signal,
          });
          const json = await res.json();
          if (!json.success) {
            throw new Error(json.message || '获取失败');
          }
          setRows((prev) =>
            prev.map((r) =>
              r.code === row.code
                ? { code: row.code, status: 'loaded', data: json.data as FundRow }
                : r
            )
          );
        } catch (err) {
          if (err instanceof DOMException && err.name === 'AbortError') return;
          const message = err instanceof Error ? err.message : '获取失败';
          setRows((prev) =>
            prev.map((r) =>
              r.code === row.code ? { code: row.code, status: 'error', error: message } : r
            )
          );
        } finally {
          controllers.delete(row.code);
        }
      })();
    }
  }, [rows]);

  async function handleAdd() {
    const normalized = input.trim();
    if (!/^\d{6}$/.test(normalized)) {
      setError('基金代码必须为6位数字');
      return;
    }
    if (rows.some((r) => r.code === normalized)) {
      setError('该基金已在自选列表中');
      return;
    }
    try {
      await addToWatchlist(normalized);
      setRows((prev) => [{ code: normalized, status: 'loading' }, ...prev]);
      setInput('');
      setError('');
    } catch (err) {
      setError(err instanceof Error ? err.message : '添加失败');
    }
  }

  async function handleRemove(code: string) {
    const controller = controllersRef.current.get(code);
    controller?.abort();
    controllersRef.current.delete(code);

    try {
      await removeFromWatchlist(code);
      setRows((prev) => prev.filter((r) => r.code !== code));
    } catch (err) {
      setError(err instanceof Error ? err.message : '删除失败');
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter') handleAdd();
  }

  function reorder(codes: string[]) {
    setRows((prev) => {
      const map = new Map(prev.map((r) => [r.code, r]));
      const next: Row[] = [];
      for (const code of codes) {
        const row = map.get(code);
        if (row) next.push(row);
      }
      for (const r of prev) {
        if (!codes.includes(r.code)) next.push(r);
      }
      return next;
    });
  }

  async function commitOrder(newOrder: string[]) {
    const previous = rows.map((r) => r.code);
    reorder(newOrder);
    try {
      await reorderWatchlist(newOrder);
    } catch (err) {
      reorder(previous);
      setError(err instanceof Error ? err.message : '保存排序失败');
    }
  }

  function handleDragStart(e: React.DragEvent<HTMLTableCellElement>, code: string) {
    e.stopPropagation();
    setDraggingCode(code);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', code);
  }

  function handleDragEnd() {
    setDraggingCode(null);
    setDropTarget(null);
  }

  function handleDragOver(e: React.DragEvent<HTMLTableRowElement>, code: string) {
    if (!draggingCode || draggingCode === code) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const rect = e.currentTarget.getBoundingClientRect();
    const midpoint = rect.top + rect.height / 2;
    const position: DropPosition = e.clientY < midpoint ? 'before' : 'after';
    if (dropTarget?.code !== code || dropTarget.position !== position) {
      setDropTarget({ code, position });
    }
  }

  function handleDragLeave(e: React.DragEvent<HTMLTableRowElement>) {
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
  }

  function handleDrop(e: React.DragEvent<HTMLTableRowElement>, targetCode: string) {
    e.preventDefault();
    e.stopPropagation();
    const sourceCode = draggingCode ?? e.dataTransfer.getData('text/plain');
    if (!sourceCode || sourceCode === targetCode) {
      handleDragEnd();
      return;
    }
    const position = dropTarget?.code === targetCode ? dropTarget.position : 'before';
    const current = rows.map((r) => r.code);
    const next = current.filter((c) => c !== sourceCode);
    const targetIdx = next.indexOf(targetCode);
    const insertAt = position === 'before' ? targetIdx : targetIdx + 1;
    next.splice(insertAt, 0, sourceCode);
    handleDragEnd();
    void commitOrder(next);
  }

  function handleRowDragOver(e: React.DragEvent<HTMLTableSectionElement>) {
    e.preventDefault();
  }

  function renderRow(row: Row) {
    const isDragging = draggingCode === row.code;
    const dropBefore = dropTarget?.code === row.code && dropTarget.position === 'before';
    const dropAfter = dropTarget?.code === row.code && dropTarget.position === 'after';

    const rowBaseClass =
      'hover:bg-gray-50 transition relative ' +
      (isDragging ? 'opacity-40 ' : '') +
      (dropBefore ? ' border-t-2 border-blue-500 ' : '') +
      (dropAfter ? ' border-b-2 border-blue-500 ' : '');

    if (row.status === 'loading') {
      return (
        <tr
          key={row.code}
          onDragOver={(e) => handleDragOver(e, row.code)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, row.code)}
          className={rowBaseClass}
        >
          <td
            draggable
            onDragStart={(e) => handleDragStart(e, row.code)}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="px-2 py-3 text-gray-300 cursor-grab active:cursor-grabbing select-none"
            title="拖动排序"
          >
            <GripIcon />
          </td>
          <td
            onClick={() => router.push(`/fund/${row.code}`)}
            className="px-4 py-3 text-gray-400 font-mono text-xs cursor-pointer"
          >
            {row.code}
          </td>
          {Array.from({ length: 5 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 bg-gray-100 rounded animate-pulse" />
            </td>
          ))}
          <td className="px-4 py-3 text-right text-gray-300">—</td>
        </tr>
      );
    }

    if (row.status === 'error') {
      return (
        <tr
          key={row.code}
          onDragOver={(e) => handleDragOver(e, row.code)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDrop(e, row.code)}
          className={rowBaseClass + ' cursor-pointer'}
        >
          <td
            draggable
            onDragStart={(e) => handleDragStart(e, row.code)}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="px-2 py-3 text-gray-300 cursor-grab active:cursor-grabbing select-none"
            title="拖动排序"
          >
            <GripIcon />
          </td>
          <td
            colSpan={6}
            onClick={() => router.push(`/fund/${row.code}`)}
            className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate"
          >
            {row.code}
            <span className="ml-2 text-xs text-red-500">
              (获取失败{row.error ? `: ${row.error}` : ''})
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                handleRemove(row.code);
              }}
              className="text-gray-400 hover:text-red-600 transition"
              title="删除"
            >
              ×
            </button>
          </td>
        </tr>
      );
    }

    const fund = row.data;
    const isPositive = fund.changePercent !== null ? fund.changePercent >= 0 : true;
    const colorClass = isPositive ? 'text-red-600' : 'text-green-600';

    return (
      <tr
        key={row.code}
        onDragOver={(e) => handleDragOver(e, row.code)}
        onDragLeave={handleDragLeave}
        onDrop={(e) => handleDrop(e, row.code)}
        onClick={() => router.push(`/fund/${fund.code}`)}
        className={rowBaseClass + ' cursor-pointer'}
      >
        <td
          draggable
          onDragStart={(e) => handleDragStart(e, row.code)}
          onDragEnd={handleDragEnd}
          onClick={(e) => e.stopPropagation()}
          className="px-2 py-3 text-gray-300 cursor-grab active:cursor-grabbing select-none"
          title="拖动排序"
        >
          <GripIcon />
        </td>
        <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
          {fund.name || fund.code}
        </td>
        <td className="px-4 py-3 text-gray-500">{fund.code}</td>
        <td className="px-4 py-3">{fund.nav > 0 ? fund.nav.toFixed(4) : '--'}</td>
        <td className="px-4 py-3">
          {fund.estimatedNav !== null ? fund.estimatedNav.toFixed(4) : '--'}
        </td>
        <td className={`px-4 py-3 font-medium ${colorClass}`}>
          {fund.changePercent !== null ? (
            <>
              {isPositive ? '+' : ''}
              {fund.changePercent.toFixed(2)}%
            </>
          ) : (
            '--'
          )}
        </td>
        <td className="px-4 py-3 text-gray-500 text-xs">
          {fund.estimateTime || formatTime(fund.lastUpdated)}
        </td>
        <td className="px-4 py-3 text-right">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleRemove(fund.code);
            }}
            className="text-gray-400 hover:text-red-600 transition"
            title="删除"
          >
            ×
          </button>
        </td>
      </tr>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row gap-2">
        <input
          type="text"
          inputMode="numeric"
          maxLength={6}
          placeholder="输入6位基金代码"
          value={input}
          onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
          onKeyDown={handleKeyDown}
          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-600"
        />
        <button
          onClick={handleAdd}
          disabled={input.trim().length !== 6}
          className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition"
        >
          加入自选
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
          {error}
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 font-medium">
              <tr>
                <th className="w-8"></th>
                <th className="px-4 py-3">基金名称</th>
                <th className="px-4 py-3">代码</th>
                <th className="px-4 py-3">单位净值</th>
                <th className="px-4 py-3">估算净值</th>
                <th className="px-4 py-3">估算涨跌幅</th>
                <th className="px-4 py-3">更新时间</th>
                <th className="px-4 py-3 text-right">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100" onDragOver={handleRowDragOver}>
              {loadingCodes && rows.length === 0 ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={`init-${i}`}>
                    <td className="w-8"></td>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-gray-500">
                    暂无自选基金，请输入基金代码添加
                  </td>
                </tr>
              ) : (
                rows.map((row) => renderRow(row))
              )}
            </tbody>
          </table>
        </div>
      </div>
      <p className="text-xs text-gray-500">按住行首的 ⋮⋮ 图标可拖动调整顺序。</p>
    </div>
  );
}

function GripIcon() {
  return (
    <svg
      width="14"
      height="20"
      viewBox="0 0 14 20"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="3" cy="4" r="1.5" />
      <circle cx="3" cy="10" r="1.5" />
      <circle cx="3" cy="16" r="1.5" />
      <circle cx="11" cy="4" r="1.5" />
      <circle cx="11" cy="10" r="1.5" />
      <circle cx="11" cy="16" r="1.5" />
    </svg>
  );
}
