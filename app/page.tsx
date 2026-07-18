'use client';

import NavBar from '@/components/NavBar';
import FundTable from '@/components/FundTable';

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50">
      <NavBar />
      <div className="mx-auto max-w-5xl px-4 py-6 sm:py-8">
        <FundTable />
      </div>
    </main>
  );
}
