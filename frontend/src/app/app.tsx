import { Suspense } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Button } from '@/components/ui/button';
import { createQueryClient } from './query-client';
import { ErrorBoundary } from './error-boundary';
import '@/lib/i18n';

const queryClient = createQueryClient();
const mainRoutes = ['collection', 'wishlist', 'dashboard', 'deals', 'transactions'] as const;
const utilityRoutes = ['search', 'analyze', 'settings'] as const;
function Placeholder({ name }: { name: (typeof mainRoutes)[number] | (typeof utilityRoutes)[number] | 'missing' }) {
  const { t } = useTranslation();
  return <section className="space-y-3"><h1 className="text-2xl font-semibold">{t(name)}</h1><p>{t('description')}</p></section>;
}
function Shell() {
  const { t, i18n } = useTranslation();
  const linkClass = ({ isActive }: { isActive: boolean }) => `rounded-md px-3 py-3 text-sm ${isActive ? 'bg-muted font-semibold' : ''}`;
  return <div className="mx-auto min-h-dvh max-w-3xl p-4 sm:p-6">
    <header className="mb-8 space-y-4 border-b border-border pb-4">
      <p className="text-sm">Pokefolio · {t('staging')}</p>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <nav aria-label={t('settings')} className="flex flex-wrap gap-1">{utilityRoutes.map((name) => <NavLink key={name} to={`/${name}`} className={linkClass}>{t(name)}</NavLink>)}</nav>
        <Button variant="outline" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')}>{i18n.language === 'en' ? 'עברית' : 'English'}</Button>
      </div>
    </header>
    <main id="main-content" className="min-h-56"><Routes>
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      {[...mainRoutes, ...utilityRoutes].map((name) => <Route key={name} path={`/${name}/*`} element={<Placeholder name={name} />} />)}
      <Route path="*" element={<Placeholder name="missing" />} />
    </Routes></main>
    <nav aria-label={t('navigation')} className="mt-8 flex flex-wrap justify-center gap-1 border-t border-border pt-4">{mainRoutes.map((name) => <NavLink key={name} to={`/${name}`} className={linkClass}>{t(name)}</NavLink>)}</nav>
  </div>;
}
export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><Suspense fallback={<p role="status">Loading…</p>}><HashRouter><Shell /></HashRouter></Suspense></QueryClientProvider></ErrorBoundary>;
}
