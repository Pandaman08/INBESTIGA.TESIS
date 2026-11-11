'use client';

import { useEffect, useState } from 'react';
import { getToken, redirectToLogin } from '@/lib/auth';

/**
 * Todas las rutas /admin requieren sesión. La API valida el JWT y el rol en cada petición;
 * este control solo evita mostrar pantallas vacías a quien no ha iniciado sesión.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const [autorizado, setAutorizado] = useState(false);

  useEffect(() => {
    if (getToken()) setAutorizado(true);
    else redirectToLogin();
  }, []);

  if (!autorizado) return null;
  return <>{children}</>;
}
