'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { BarChart3, Bot, CalendarDays, FileText, GraduationCap, LayoutDashboard, Menu, MessageSquare, PanelLeftClose, PanelLeftOpen, Receipt, Radio, Users, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';

const leadNavigation = [
  { href: '/admin/leads', label: 'Resumen', icon: LayoutDashboard },
  { href: '/admin/leads/conversaciones', label: 'Conversaciones', icon: MessageSquare },
  { href: '/admin/leads/oportunidades', label: 'Oportunidades', icon: BarChart3 },
  { href: '/admin/leads/agenda', label: 'Agenda', icon: CalendarDays },
  { href: '/admin/leads/reportes', label: 'Reportes', icon: FileText },
  { href: '/admin/agent-config', label: 'Agente IA', icon: Bot },
];
const secondaryNavigation = [
  { href: '/admin/buyers', label: 'BUYERS', icon: Users },
  { href: '/admin/comprobantes', label: 'PAYERS', icon: Receipt },
  { href: '/admin/customers', label: 'CUSTOMERS', icon: GraduationCap },
];

export default function Navbar() {
  const pathname = usePathname();
  const admin = pathname.startsWith('/admin');
  const [open, setOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [waConnected, setWaConnected] = useState(false);
  const isActive = (href: string) => pathname === href || pathname.startsWith(`${href}/`);

  useEffect(() => {
    setOpen(false);
    if (admin && getToken()) api.getWhatsAppStatus().then((r) => setWaConnected(r?.conectado === true || r?.status === 'ready')).catch(() => setWaConnected(false));
  }, [admin, pathname]);

  if (!admin) {
    return <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90"><div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6"><Link href="/" className="flex items-center gap-2.5"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-700 text-white"><GraduationCap size={20} /></span><span className="font-extrabold tracking-tight text-slate-900 dark:text-white">INBESTIGA<span className="text-sky-500">.TESIS</span></span></Link><nav className="hidden items-center gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300 sm:flex"><Link href="/" className="hover:text-blue-600">Inicio</Link><Link href="/formulario" className="hover:text-blue-600">Servicios y registro</Link><Link href="/login" className="rounded-lg bg-blue-700 px-4 py-2 text-white hover:bg-blue-600">Iniciar sesión</Link><ThemeToggle /></nav><button className="rounded-lg border p-2 sm:hidden" aria-label="Abrir menú público" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button></div>{open && <div className="space-y-2 border-t border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-950 sm:hidden"><Link className="block rounded-lg p-2" href="/">Inicio</Link><Link className="block rounded-lg p-2" href="/formulario">Servicios y registro</Link><Link className="block rounded-lg bg-blue-700 p-2 text-center text-white" href="/login">Iniciar sesión</Link></div>}</header>;
  }

  return <>
    <aside className={`fixed inset-y-0 left-0 z-50 hidden flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950 md:flex ${collapsed ? 'w-[76px]' : 'w-64'}`}>
      <div className="flex h-16 items-center justify-between border-b border-slate-200 px-4 dark:border-slate-800"><Link href="/admin/leads" className="flex min-w-0 items-center gap-2.5"><span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-700 text-white"><GraduationCap size={19} /></span>{!collapsed && <span className="truncate font-extrabold text-slate-900 dark:text-white">INBESTIGA<span className="text-sky-500">.TESIS</span></span>}</Link><button onClick={() => setCollapsed(!collapsed)} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800" aria-label={collapsed ? 'Expandir menú' : 'Contraer menú'}>{collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}</button></div>
      <div className="flex-1 overflow-y-auto p-3"><p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 ${collapsed ? 'text-center' : ''}`}>{collapsed ? 'L' : 'LEADS · CRM'}</p>{leadNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={collapsed ? label : undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold ${isActive(href) ? 'bg-blue-700 text-white shadow-lg shadow-blue-700/20' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`}><Icon size={18} />{!collapsed && label}</Link>)}<div className="my-4 border-t border-slate-200 dark:border-slate-800" /><p className={`mb-2 px-3 text-[10px] font-bold uppercase tracking-[.16em] text-slate-400 ${collapsed ? 'text-center' : ''}`}>{collapsed ? 'O' : 'OTRAS FASES'}</p>{secondaryNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} title={collapsed ? label : undefined} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-2 text-xs font-semibold ${isActive(href) ? 'bg-slate-100 text-blue-700 dark:bg-slate-800 dark:text-sky-300' : 'text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800'} ${collapsed ? 'justify-center' : ''}`}><Icon size={16} />{!collapsed && label}</Link>)}</div>
      <div className={`border-t border-slate-200 p-3 dark:border-slate-800 ${collapsed ? 'text-center' : ''}`}><div className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-600 dark:text-slate-300"><span className={`h-2 w-2 rounded-full ${waConnected ? 'bg-emerald-500' : 'bg-slate-400'}`} />{!collapsed && (waConnected ? 'OpenWA conectado' : 'OpenWA desconectado')}</div>{!collapsed && <ThemeToggle />}</div>
    </aside>
    <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-200 bg-white/90 px-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 md:left-64"><div className="flex items-center gap-3"><button className="rounded-lg border p-2 md:hidden" aria-label="Abrir menú administrativo" onClick={() => setOpen(!open)}>{open ? <X size={18} /> : <Menu size={18} />}</button><div><p className="text-[10px] font-bold uppercase tracking-[.16em] text-blue-600">CRM COMERCIAL</p><p className="text-sm font-bold text-slate-800 dark:text-white">Gestión de oportunidades LEADS</p></div></div><div className="flex items-center gap-3"><div className={`hidden items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-semibold sm:flex ${waConnected ? 'border-emerald-200 bg-emerald-50 text-emerald-700' : 'border-slate-200 bg-slate-50 text-slate-500 dark:border-slate-700 dark:bg-slate-900'}`}><Radio size={13} />{waConnected ? 'WhatsApp en línea' : 'WhatsApp desconectado'}</div><ThemeToggle /><div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700 dark:bg-blue-950 dark:text-sky-300">AD</div></div></header>
    {open && <div className="fixed inset-0 z-[60] bg-slate-950/40 md:hidden" onClick={() => setOpen(false)}><aside className="h-full w-72 bg-white p-4 shadow-2xl dark:bg-slate-950" onClick={(e) => e.stopPropagation()}><div className="mb-5 flex items-center justify-between"><span className="font-extrabold">INBESTIGA<span className="text-sky-500">.TESIS</span></span><button onClick={() => setOpen(false)} aria-label="Cerrar menú"><X size={19} /></button></div>{leadNavigation.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`mb-1 flex items-center gap-3 rounded-xl px-3 py-3 text-sm font-semibold ${isActive(href) ? 'bg-blue-700 text-white' : 'text-slate-600 dark:text-slate-300'}`}><Icon size={18} />{label}</Link>)}</aside></div>}
  </>;
}
