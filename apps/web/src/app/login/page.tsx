'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Lock, Loader2 } from 'lucide-react';
import { api } from '@/lib/api';
import { setToken } from '@/lib/auth';

const inputClass =
  'w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700/80 rounded-xl px-3 py-2.5 text-sm text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all';

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const next = params.get('next');
  const destino = next && next.startsWith('/admin') ? next : '/admin/buyers';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await api.login(email.trim(), password);
      setToken(res.accessToken);
      router.replace(destino);
    } catch (err: any) {
      setError(err.message || 'No se pudo iniciar sesión.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-sm mx-auto mt-10 sm:mt-16">
      <form onSubmit={onSubmit} className="glass-panel rounded-2xl p-6 sm:p-8 space-y-5" aria-describedby={error ? 'login-error' : undefined}>
        <div className="space-y-1 text-center">
          <div className="mx-auto w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center">
            <Lock className="w-5 h-5" aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-slate-900 dark:text-white">Acceso administrativo</h1>
          <p className="text-xs text-slate-600 dark:text-slate-400">Panel de gestión INBESTIGA</p>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="email" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Correo
          </label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-xs font-semibold text-slate-700 dark:text-slate-300">
            Contraseña
          </label>
          <input
            id="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={inputClass}
          />
        </div>

        {error && (
          <p id="login-error" role="alert" className="text-xs text-red-600 dark:text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-blue-700 to-sky-600 hover:from-blue-600 hover:to-sky-500 text-white transition-all flex items-center justify-center gap-2 disabled:opacity-50 cursor-pointer"
        >
          {loading && <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />}
          Ingresar
        </button>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
