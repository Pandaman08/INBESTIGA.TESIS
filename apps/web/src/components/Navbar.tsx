'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  GraduationCap,
  Users,
  MessageSquare,
  BarChart3,
  Bot,
  UserCheck,
  FileText,
  Radio,
  Menu,
  X,
  Sparkles,
  BookOpen,
  Receipt,
} from 'lucide-react';
import { useEffect, useState } from 'react';
import { api } from '@/lib/api';
import { getToken } from '@/lib/auth';
import ThemeToggle from '@/components/ThemeToggle';

export default function Navbar() {
  const pathname = usePathname();
  const [waConnected, setWaConnected] = useState<boolean>(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState<boolean>(false);

  useEffect(() => {
    // Verificar estado de sesión WhatsApp en OpenWA (requiere sesión administrativa)
    if (!getToken()) return;
    api
      .getWhatsAppStatus()
      .then((res) => {
        // GET /whatsapp/status → { conectado, status: 'ready' | 'qr_ready' | ... }
        setWaConnected(res?.conectado === true || res?.status === 'ready');
      })
      .catch(() => setWaConnected(false));
  }, []);

  // Cerrar menú móvil al navegar
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  const navItems = [
    { href: '/', label: 'Inicio', icon: GraduationCap },
    { href: '/formulario', label: 'Formulario', icon: FileText },
    { href: '/admin/buyers', label: 'Buyers', icon: Users, highlight: true },
    { href: '/admin/live-chat', label: 'Live Chat', icon: MessageSquare },
    { href: '/admin/dashboard', label: 'Dashboard', icon: BarChart3 },
    { href: '/admin/customers', label: 'Bitácora', icon: BookOpen },
    { href: '/admin/comprobantes', label: 'Comprobantes', icon: Receipt },
    { href: '/admin/agent-config', label: 'Agente IA', icon: Bot },
  ];

  return (
    <header className="sticky top-0 z-50 glass-panel border-b border-slate-200 dark:border-slate-800/80 shadow-md transition-colors duration-200">
      <div className="w-full max-w-[1550px] mx-auto px-3 sm:px-6">
        <div className="flex items-center justify-between h-16 gap-2">
          {/* Brand Logo */}
          <Link href="/" className="flex items-center gap-2.5 group shrink-0">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-sky-400 flex items-center justify-center shadow-md shadow-blue-500/20 group-hover:scale-105 transition-transform shrink-0">
              <GraduationCap className="w-5 h-5 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="font-extrabold text-base tracking-tight text-slate-900 dark:text-white">
                  INBESTIGA<span className="text-blue-600 dark:text-sky-400">.TESIS</span>
                </span>
                <span className="hidden sm:inline-block text-[9px] font-bold uppercase tracking-wider bg-blue-50 dark:bg-blue-500/20 text-blue-700 dark:text-blue-300 px-1.5 py-0.5 rounded border border-blue-200 dark:border-blue-500/30">
                  IMPULSE
                </span>
              </div>
              <p className="hidden 2xl:block text-[10px] text-slate-500 dark:text-slate-400 font-medium truncate">
                Aceleración & Rigor Metodológico
              </p>
            </div>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden xl:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all whitespace-nowrap ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                      : item.highlight
                      ? 'text-blue-700 dark:text-sky-300 hover:bg-blue-50 dark:hover:bg-slate-800/80 border border-blue-300 dark:border-sky-500/30 bg-blue-50/60 dark:bg-sky-500/10'
                      : 'text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800/60'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : item.highlight ? 'text-blue-600 dark:text-sky-400' : 'text-slate-500 dark:text-slate-400'}`} />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          {/* Right Status Actions & Mobile Menu Toggle */}
          <div className="flex items-center gap-2 shrink-0">
            {/* WhatsApp OpenWA Status Pill */}
            <div
              className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold border ${
                waConnected
                  ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300 dark:border-emerald-500/30'
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300 border-slate-300 dark:border-slate-700'
              }`}
              title={waConnected ? 'OpenWA vinculado y listo' : 'OpenWA en escucha'}
            >
              <Radio className={`w-3 h-3 ${waConnected ? 'text-emerald-500 dark:text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
              <span className="hidden md:inline">OpenWA</span>
              <span>{waConnected ? 'En línea' : 'Activo'}</span>
            </div>

            {/* Theme Toggle Button (Claro / Oscuro) */}
            <ThemeToggle />

            {/* Mobile Hamburger Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              type="button"
              className="xl:hidden p-2 rounded-xl text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 border border-slate-200 dark:border-slate-700"
              aria-label="Menú de navegación"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile / Tablet Dropdown Menu */}
      {mobileMenuOpen && (
        <div className="xl:hidden border-t border-slate-200 dark:border-slate-800/80 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl px-4 pt-3 pb-5 space-y-1 shadow-2xl animate-fade-in">
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-200 dark:border-slate-800 text-xs">
            <span className="font-semibold text-slate-500 dark:text-slate-400">Navegación del Sistema</span>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-slate-500 dark:text-slate-400">WhatsApp:</span>
              <span className={`inline-flex items-center gap-1 text-[10px] font-bold px-1.5 py-0.5 rounded ${waConnected ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-700 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400'}`}>
                {waConnected ? 'Conectado' : 'Activo'}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-xs font-semibold transition-all ${
                    isActive
                      ? 'bg-blue-600 text-white shadow-sm'
                      : item.highlight
                      ? 'bg-blue-50 dark:bg-sky-500/10 text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-sky-500/30'
                      : 'text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800/80'
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${isActive ? 'text-white' : item.highlight ? 'text-blue-600 dark:text-sky-400' : 'text-slate-400'}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </div>

          <div className="pt-3 mt-2 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between">
            <Link
              href="/formulario"
              className="w-full text-center py-2.5 rounded-xl text-xs font-bold bg-blue-600 text-white shadow-md"
            >
              + Registrar Nueva Tesis
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
