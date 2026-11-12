'use client';

import { usePathname } from 'next/navigation';
import Navbar from '@/components/Navbar';

export default function AppFrame({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');
  return (
    <>
      <Navbar />
      <main className={admin ? 'admin-content min-h-[calc(100vh-1px)]' : 'mx-auto min-h-[calc(100vh-1px)] w-full max-w-7xl px-3 py-6 sm:px-6 sm:py-8 lg:px-8'}>{children}</main>
      {!admin && <footer className="glass-panel border-t border-slate-200 py-6 text-center text-xs text-slate-600 dark:border-slate-800/80 dark:text-slate-400"><div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 sm:flex-row"><p className="font-medium">© 2026 <strong className="text-slate-900 dark:text-white">INBESTIGA.TESIS</strong> — Inteligencia de Negocios & Metodología IMPULSE.</p><div className="flex items-center gap-3 text-[11px] text-slate-500 dark:text-slate-400"><span>Rigor Científico</span><span>•</span><span>Doctores & Magísteres</span><span>•</span><span>SQL Server & Data Warehouse</span></div></div></footer>}
    </>
  );
}
