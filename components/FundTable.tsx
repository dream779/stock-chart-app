'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DragDropProvider } from '@dnd-kit/react';
import { useSortable } from '@dnd-kit/react/sortable';
import { move } from '@dnd-kit/helpers';
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

  function handleDragStart() {
    document.body.classList.add('dnd-dragging');
  }

  function handleDragEnd(event: Parameters<typeof move>[1]) {
    document.body.classList.remove('dnd-dragging');
    const codes = rows.map((r) => r.code);
    const newCodes = move(codes, event) as string[];
    if (newCodes.length !== codes.length || newCodes.every((c, i) => c === codes[i])) {
      return;
    }
    void commitOrder(newCodes);
  }

  return (
    <DragDropProvider onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
      <div className="space-y-5">
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            inputMode="numeric"
            maxLength={6}
            placeholder="输入6位基金代码"
            value={input}
            onChange={(e) => setInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
            onKeyDown={handleKeyDown}
            className="flex-1 rounded-xl border border-slate-200 bg-slate-100/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-4 focus:ring-indigo-500/10"
          />
          <button
            onClick={handleAdd}
            disabled={input.trim().length !== 6}
            className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-indigo-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
          >
            加入自选
          </button>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-3 text-sm text-rose-700">
            {error}
          </div>
        )}

        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-[0_1px_2px_rgb(15_23_42_/_0.03)]">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-slate-700">
              <thead className="border-b border-slate-200 bg-slate-50/80 text-xs font-semibold uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="w-8"></th>
                  <th className="px-4 py-3">基金名称</th>
                  <th className="px-4 py-3">代码</th>
                  <th className="px-4 py-3">单位净值</th>
                  <th className="px-4 py-3">估算涨跌幅</th>
                  <th className="px-4 py-3">更新时间</th>
                  <th className="px-4 py-3 text-right">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loadingCodes && rows.length === 0 ? (
                  Array.from({ length: 2 }).map((_, i) => (
                    <tr key={`init-${i}`}>
                      <td className="w-8"></td>
                      {Array.from({ length: 6 }).map((_, j) => (
                        <td key={j} className="px-4 py-3">
                          <div className="h-4 animate-pulse rounded bg-slate-100" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : rows.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                      暂无自选基金，请输入基金代码添加
                    </td>
                  </tr>
                ) : (
                  rows.map((row, index) => (
                    <SortableRow
                      key={row.code}
                      row={row}
                      index={index}
                      onNavigate={() => {
                        if (row.status === 'loaded') {
                          router.push(`/fund/${row.data.code}`);
                        } else {
                          router.push(`/fund/${row.code}`);
                        }
                      }}
                      onRemove={() => handleRemove(row.code)}
                    />
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </DragDropProvider>
  );
}

function SortableRow({
  row,
  index,
  onNavigate,
  onRemove,
}: {
  row: Row;
  index: number;
  onNavigate: () => void;
  onRemove: () => void;
}) {
  const [element, setElement] = useState<HTMLTableRowElement | null>(null);
  const handleRef = useRef<HTMLTableCellElement | null>(null);
  const { isDragging } = useSortable({
    id: row.code,
    index,
    element,
    handle: handleRef,
  });

  const rowClass =
    'transition-colors hover:bg-slate-50/80 ' +
    (isDragging ? 'bg-white shadow-lg ring-1 ring-indigo-200 [&_td]:!cursor-grabbing ' : '');

  return (
    <tr ref={setElement} style={isDragging ? { opacity: 1 } : undefined} className={rowClass}>
      <td
        ref={handleRef}
        onClick={(e) => e.stopPropagation()}
        className="select-none touch-none px-2 py-3 text-slate-300 cursor-grab active:cursor-grabbing"
        title="拖动排序"
      >
        <GripIcon />
      </td>
      {row.status === 'loading' && (
        <>
          <td className="px-4 py-3.5 font-mono text-xs tabular-nums text-slate-400">{row.code}</td>
          {Array.from({ length: 4 }).map((_, j) => (
            <td key={j} className="px-4 py-3">
              <div className="h-4 animate-pulse rounded bg-slate-100" />
            </td>
          ))}
          <td className="px-4 py-3.5 text-right text-slate-300">—</td>
        </>
      )}
      {row.status === 'error' && (
        <>
          <td
            colSpan={5}
            onClick={onNavigate}
            className="max-w-[200px] cursor-pointer truncate px-4 py-3.5 font-medium text-slate-900"
          >
            {row.code}
            <span className="ml-2 text-xs text-rose-500">
              (获取失败{row.error ? `: ${row.error}` : ''})
            </span>
          </td>
          <td className="px-4 py-3 text-right">
            <button
              onClick={(e) => {
                e.stopPropagation();
                onRemove();
              }}
              className="cursor-pointer text-slate-300 transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
              title="删除"
            >
              ×
            </button>
          </td>
        </>
      )}
      {row.status === 'loaded' && (
        <LoadedRowCells row={row.data} onNavigate={onNavigate} onRemove={onRemove} />
      )}
    </tr>
  );
}

function LoadedRowCells({
  row,
  onNavigate,
  onRemove,
}: {
  row: FundRow;
  onNavigate: () => void;
  onRemove: () => void;
}) {
  const isPositive = row.changePercent !== null ? row.changePercent >= 0 : true;
  const colorClass = isPositive ? 'text-rose-600' : 'text-emerald-600';
  return (
    <>
      <td
        onClick={onNavigate}
        className="max-w-[200px] cursor-pointer truncate px-4 py-3.5 font-medium text-slate-900"
      >
        {row.name || row.code}
      </td>
      <td
        onClick={onNavigate}
        className="cursor-pointer px-4 py-3.5 font-mono tabular-nums text-slate-500"
      >
        {row.code}
      </td>
      <td onClick={onNavigate} className="cursor-pointer px-4 py-3.5 font-mono tabular-nums">
        {row.nav > 0 ? row.nav.toFixed(4) : '--'}
      </td>
      <td
        onClick={onNavigate}
        className={`cursor-pointer px-4 py-3.5 font-mono font-medium tabular-nums ${colorClass}`}
      >
        {row.changePercent !== null ? (
          <>
            {isPositive ? '+' : ''}
            {row.changePercent.toFixed(2)}%
          </>
        ) : (
          '--'
        )}
      </td>
      <td onClick={onNavigate} className="cursor-pointer px-4 py-3.5 text-xs text-slate-500">
        {row.estimateTime || formatTime(row.lastUpdated)}
      </td>
      <td className="px-4 py-3 text-right">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove();
          }}
          className="cursor-pointer text-slate-300 transition-colors hover:text-rose-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
          title="删除"
        >
          ×
        </button>
      </td>
    </>
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
