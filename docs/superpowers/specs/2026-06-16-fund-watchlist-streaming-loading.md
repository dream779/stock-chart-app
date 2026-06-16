# Fund Watchlist Streaming Loading

Date: 2026-06-16
Status: Approved (pending user review of this spec)

## Goal

When the user opens `/fund`, the self-selected fund list should:

1. Show a loading state while the watchlist itself is being fetched from the server.
2. Render a skeleton row for each fund **immediately** as soon as codes are known, instead of waiting for all fund quotes to resolve.
3. Populate each row with real data the moment its individual quote fetch resolves, keeping the row in its original position (order preserved from the server).

## Non-Goals

- No changes to the API layer (`/api/fund/[code]`, `/api/watchlist`).
- No changes to `app/fund/page.tsx` (it just renders `<FundTable />`).
- No new dependencies.
- No sort-by-change or reordering based on completion time.

## Data Model

Replace the existing two-state shape in `components/FundTable.tsx`:

```ts
// before
const [codes, setCodes] = useState<string[]>([]);
const [funds, setFunds] = useState<FundRow[]>([]);
```

with a single `rows` array whose elements carry their own status:

```ts
type Row =
  | { code: string; status: 'loading' }
  | { code: string; status: 'loaded'; data: FundRow }
  | { code: string; status: 'error'; error: string };

const [rows, setRows] = useState<Row[]>([]);
const [loadingCodes, setLoadingCodes] = useState(true);
```

A separate `loadingCodes` flag tracks the first phase (fetching the watchlist itself).

## Rendering

`<tbody>` rendering rules:

| Condition | Render |
|---|---|
| `loadingCodes && rows.length === 0` | 2 skeleton rows (existing behavior) |
| `!loadingCodes && rows.length === 0` | "暂无自选基金" message (existing behavior) |
| `rows.length > 0` | `rows.map(renderRow)` — branch on `r.status` |

`renderRow(row)`:

- `status: 'loading'` → skeleton row. Show the `code` text in the code column; show gray `animate-pulse` blocks in the other 6 cells.
- `status: 'loaded'` → existing data row (current implementation, unchanged).
- `status: 'error'` → render a row with the code, name placeholder, `--` for numeric fields, and `(获取失败)` tag (mirrors the existing fallback in `Promise.all(...).catch`).

Table header, input box, add button, and global error banner are unchanged.

## Data Flow

### Mount

1. `useEffect` fires once on mount.
2. `setLoadingCodes(true)`; fetch `/api/watchlist`.
3. On success: `setRows(codes.map(c => ({ code: c, status: 'loading' })))`, then `setLoadingCodes(false)`.
4. On failure: `setError(message)`, `setLoadingCodes(false)`, leave `rows` empty.

### Per-fund fetch

After `rows` is set, a second effect (or a sub-effect) iterates `rows`, and for every row with `status === 'loading'`:

1. Creates an `AbortController`, stores it in a ref keyed by `code`.
2. `fetch('/api/fund/:code', { signal })`.
3. On success: `setRows(prev => prev.map(r => r.code === code ? { code, status: 'loaded', data } : r))`. Remove the controller from the ref.
4. On failure (non-abort): `setRows(prev => prev.map(r => r.code === code ? { code, status: 'error', error: msg } : r))`. Remove controller.
5. On abort: silently remove controller; do **not** update `rows` (the row will be removed by cleanup if the codes array changed, or remain `loading` if it was a single remove — see below).

### Add fund

`handleAdd(code)`:

1. Validate input and call `addToWatchlist(code)`.
2. On success: `setRows(prev => [{ code, status: 'loading' }, ...prev])`, clear input, clear error.
3. The new row triggers its own fetch via the per-fund effect.

### Remove fund

`handleRemove(code)`:

1. Call `removeFromWatchlist(code)`.
2. Abort the in-flight controller for that code (if any).
3. `setRows(prev => prev.filter(r => r.code !== code))`.

## Cancellation

Use one `Map<code, AbortController>` ref:

- When `rows` changes (e.g., codes refetched, single fund added), any controller whose code is no longer in the new `rows` is aborted in cleanup.
- When a fetch resolves or errors, its controller is removed from the map.
- Single-fund remove aborts that one controller explicitly before filtering the row out.

Net effect: stale requests never overwrite fresh data, and the network isn't kept busy for rows the user has dismissed.

## Files Changed

| File | Change |
|---|---|
| `components/FundTable.tsx` | Replace state shape; rewrite the per-fund effect; update render; add controller ref. |
| `app/fund/page.tsx` | None. |
| Other files | None. |

## Testing

No automated tests in this repo. Manual verification checklist:

- [ ] Empty watchlist: shows "暂无自选基金" immediately after watchlist fetch resolves.
- [ ] Non-empty watchlist: shows N skeleton rows immediately after codes load, in the order returned by the server.
- [ ] As each `/api/fund/:code` resolves, its row transitions from skeleton to real data without disturbing sibling rows.
- [ ] Final table order matches the original codes order, regardless of which fund's fetch resolved first.
- [ ] One fund failing (e.g., invalid code, network error): only that row shows `(获取失败)`; other rows continue to load.
- [ ] Adding a fund: new row appears at the top as a skeleton, then loads.
- [ ] Removing a fund mid-load: row disappears; if its fetch was in flight, it is aborted (verified by no late state update).
- [ ] Re-fetching the watchlist (e.g., by toggling state): in-flight requests from the previous cycle are aborted; no stale data overwrites new rows.