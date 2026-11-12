import type { Metadata } from 'next';
import './globals.css';
import AppFrame from '@/components/AppFrame';
import { ThemeProvider } from '@/context/ThemeContext';

export const metadata: Metadata = {
  title: 'INBESTIGA.TESIS | Plataforma Académica y Aceleradora de Tesis',
  description:
    'Sistema avanzado de captación, calificación de investigación, negociación con IA y acompañamiento de tesis universitarias según metodología IMPULSE.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning className="dark">
      <body className="min-h-screen flex flex-col antialiased selection:bg-blue-600 selection:text-white transition-colors duration-200 overflow-x-hidden">
        <ThemeProvider>
          <AppFrame>{children}</AppFrame>
        </ThemeProvider>
      </body>
    </html>
  );
}
