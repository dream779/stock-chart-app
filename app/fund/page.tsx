'use client';

import NavBar from '@/components/NavBar';
import FundTable from '@/components/FundTable';

export default function FundPage() {
  return (
    <main className="min-h-screen bg-gray-50">
      <NavBar />

      <div className="max-w-5xl mx-auto px-4 py-4">
        <div className="bg-white rounded-lg shadow p-4">
          <h1 className="text-lg font-semibold text-gray-900 mb-4">自选基金</h1>
          <FundTable />
        </div>
      </div>
    </main>
  );
}
