# Fund Watchlist Streaming Loading Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the all-at-once fund table loading with row-by-row streaming: each row appears immediately as a skeleton and is filled in when its quote resolves.

**Architecture:** Consolidate `codes` + `funds` state into a single `rows: Row[]` array where each row carries its own status (`loading` | `loaded` | `error`). The render iterates this array and branches on `row.status`. A single `useEffect` keyed on `rows` kicks off `AbortController`-bearing fetches for any row still in `loading`; resolutions update rows in place by code. Order is preserved by the array itself, which mirrors the codes order returned by the server.

**Tech Stack:** Next.js 14 (App Router), React 18, Tailwind, TypeScript. No new dependencies. No test framework in this repo — verification is manual via the dev server.

---

## File Structure

| File | Change | Responsibility |
|---|---|---|
| `components/FundTable.tsx` | Full refactor of state, effects, handlers, and render | Renders the watchlist table with streaming rows. |
| (other files) | None | — |

The component stays in one file (~270 lines), matching the existing convention. No new files.

---

## Task 1: Replace state shape and refactor mount effect

**Files:**
- Modify: `components/FundTable.tsx:1-99` (imports, types, state declarations, mount effect)

- [ ] **Step 1: Update imports and add the `Row` type**

In `components/FundTable.tsx`, replace the entire header (lines 1-6) and the `FundRow` interface (lines 7-17) with:

```tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getWatchlist, addToWatchlist, removeFromWatchlist } from '@/lib/watchlist-api';

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
```

- [ ] **Step 2: Replace state declarations inside the component**

Replace the existing state declarations (the lines `const router = useRouter();` through `const [error, setError] = useState('');`) with:

```tsx
export default function FundTable() {
  const router = useRouter();
  const [rows, setRows] = useState<Row[]>([]);
  const [loadingCodes, setLoadingCodes] = useState(true);
  const [input, setInput] = useState('');
  const [error, setError] = useState('');
  const controllersRef = useRef<Map<string, AbortController>>(new Map());
```

- [ ] **Step 3: Replace the two existing effects with a single mount effect**

Delete the two old `useEffect` blocks (the watchlist fetch and the `Promise.all` per-fund fetch) and insert this single mount effect:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript reports only render-block errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: errors only mention `handleAdd`, `handleRemove`, and the `return` block (which still reference the removed `codes`, `funds`, `loading` symbols). No errors at the new state / effect / type declarations. No errors at the import line for `useRef`.

If `useRef` shows an "unused" warning, that is fine — it will be used in Task 2.

- [ ] **Step 5: Commit**

```bash
git add components/FundTable.tsx
git commit -m "refactor(fund): replace codes/funds state with unified rows array"
```

---

## Task 2: Add per-fund fetch effect and refactor handlers

**Files:**
- Modify: `components/FundTable.tsx` (insert per-fund effect after mount effect; rewrite `handleAdd` and `handleRemove`)

- [ ] **Step 1: Insert the per-fund fetch effect**

After the mount effect added in Task 1, insert this block (it uses `controllersRef` declared in Task 1):

```tsx
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
```

- [ ] **Step 2: Rewrite `handleAdd`**

Replace the existing `handleAdd` function with:

```tsx
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
```

- [ ] **Step 3: Rewrite `handleRemove`**

Replace the existing `handleRemove` function with:

```tsx
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
```

- [ ] **Step 4: Verify TypeScript reports only render-block errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: errors only inside the `return` block. State, effects, and handlers compile cleanly.

- [ ] **Step 5: Commit**

```bash
git add components/FundTable.tsx
git commit -m "feat(fund): stream fund quotes row-by-row with cancellation"
```

---

## Task 3: Refactor the render to branch on row.status

**Files:**
- Modify: `components/FundTable.tsx` (the `<tbody>` content inside `return`)

- [ ] **Step 1: Replace the `<tbody>` content**

Inside the `return` block of `FundTable`, replace the existing `<tbody>...</tbody>` with the version below. The surrounding `<table>`, `<thead>`, and outer wrappers stay unchanged.

```tsx
            <tbody className="divide-y divide-gray-100">
              {loadingCodes && rows.length === 0 ? (
                Array.from({ length: 2 }).map((_, i) => (
                  <tr key={`init-${i}`}>
                    {Array.from({ length: 7 }).map((_, j) => (
                      <td key={j} className="px-4 py-3">
                        <div className="h-4 bg-gray-100 rounded animate-pulse" />
                      </td>
                    ))}
                  </tr>
                ))
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    暂无自选基金，请输入基金代码添加
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  if (row.status === 'loading') {
                    return (
                      <tr key={row.code} className="hover:bg-gray-50 cursor-pointer transition">
                        <td
                          onClick={() => router.push(`/fund/${row.code}`)}
                          className="px-4 py-3 text-gray-400 font-mono text-xs"
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
                      <tr key={row.code} className="hover:bg-gray-50 cursor-pointer transition">
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
                      onClick={() => router.push(`/fund/${fund.code}`)}
                      className="hover:bg-gray-50 cursor-pointer transition"
                    >
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
                })
              )}
            </tbody>
```

Notes:
- Row `key={row.code}` is stable across status transitions, so React reuses the same `<tr>` DOM node as a row loads → smooth visual transition.
- Loading row: code in the first cell, then 5 skeleton cells, then `—` in the action column (7 total). Clicking it navigates to the detail page.
- Error row: code + error message in a single `colSpan={6}` cell, plus a delete button cell. Same navigation behavior.

- [ ] **Step 2: Verify TypeScript compiles**

Run: `npx tsc --noEmit`
Expected: zero errors.

- [ ] **Step 3: Run the linter**

Run: `npx next lint --file components/FundTable.tsx`
Expected: zero errors. If Prettier formatting issues are reported, run `npm run format` and re-commit.

- [ ] **Step 4: Commit**

```bash
git add components/FundTable.tsx
git commit -m "feat(fund): render skeleton, loaded, and error rows from unified state"
```

---

## Task 4: Manual end-to-end verification

**Files:** None modified (this task is verification only).

- [ ] **Step 1: Start the dev server**

Run: `npm run dev`
Expected: server starts on `http://localhost:3000` with no compilation errors in the terminal.

- [ ] **Step 2: Walk through the manual checklist from the spec**

Open `http://localhost:3000/fund` in a browser and verify each item from `docs/superpowers/specs/2026-06-16-fund-watchlist-streaming-loading.md`:

- [ ] **Empty watchlist:** When the watchlist is empty, "暂无自选基金" appears after the initial skeleton disappears.
- [ ] **Skeleton rows:** With at least one fund in the watchlist, skeleton rows appear immediately after codes load, in the order returned by the server. The code is visible in the first cell of each skeleton row.
- [ ] **Streaming resolution:** As each `/api/fund/:code` resolves, its row transitions from skeleton to real data, with sibling rows undisturbed.
- [ ] **Order preserved:** The final table order matches the original codes order, regardless of which fetch resolved first.
- [ ] **Per-row error isolation:** Temporarily add an invalid code (e.g., `000000`) to the watchlist via the API or DB, then reload the page. Only that row shows `(获取失败)`; the others still load normally.
- [ ] **Add flow:** Type a valid 6-digit code into the input and click "加入自选". A new skeleton row appears at the top, then transitions to real data.
- [ ] **Remove flow:** Click the × on any row. It disappears immediately; if its fetch was in flight, no late state update overwrites the change.
- [ ] **Refresh:** Reload the page while fetches are in flight (use a slow network throttling setting in DevTools if available). The previous cycle's requests should not overwrite new rows.

If any item fails, fix it before continuing.

- [ ] **Step 3: Stop the dev server**

Press `Ctrl+C` in the terminal where `npm run dev` is running.

- [ ] **Step 4: Final commit if any fixes were needed**

If Step 2 surfaced a minor visual or behavioral fix:

```bash
git add components/FundTable.tsx
git commit -m "fix(fund): address issues found in manual verification"
```

Otherwise, skip this step. The implementation is complete.