'use client';

import NavBar from '@/components/NavBar';
import FundTable from '@/components/FundTable';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-8 sm:py-10">
        <header className="mb-6 sm:mb-8">
          <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-indigo-600">
            Watchlist
          </p>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-950 sm:text-3xl">
            自选基金
          </h1>
          <p className="mt-2 text-sm text-slate-500">跟踪净值与盘中估算涨跌</p>
        </header>
        <FundTable />
      </div>
    </main>
  );
}
