'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const TABS = [
  { label: '基金', href: '/' },
  { label: '持仓收益', href: '/holdings' },
  { label: '每日总结', href: '/summaries' },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="border-b border-slate-200/80 bg-white/80 backdrop-blur">
      <div className="mx-auto max-w-5xl px-4">
        <div className="flex h-16 items-center gap-4 sm:gap-7">
          <span className="flex items-center gap-2 text-sm font-semibold tracking-tight text-slate-950">
            <span className="grid h-6 w-6 place-items-center rounded-md bg-slate-950 text-[10px] font-bold text-white">
              Q
            </span>
            行情看板
          </span>
          <div className="flex items-center gap-1 overflow-x-auto">
            {TABS.map((tab) => {
              const isActive = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={`whitespace-nowrap rounded-lg px-3 py-2 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </nav>
  );
}
