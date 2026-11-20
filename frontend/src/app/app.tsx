import { lazy, Suspense } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LuArrowLeftRight, LuHeart, LuLayers, LuScanLine, LuSearch, LuSettings } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, LoadingState } from '@/components/ui/surfaces';
import { UtilitySheet } from '@/components/layout/utility-sheet';
import { useUIStore } from '@/state/ui';
import { createQueryClient } from './query-client';
import { ErrorBoundary } from './error-boundary';
import '@/lib/i18n';
const InventoryPage = lazy(async () => { const module = await import('@/features/inventory/inventory-page'); return { default: module.InventoryPage }; });

const queryClient = createQueryClient();
const destinations = [
  { name: 'collection', icon: LuLayers }, { name: 'wishlist', icon: LuHeart },
  { name: 'dashboard', icon: null }, { name: 'analyze', icon: LuScanLine },
  { name: 'transactions', icon: LuArrowLeftRight },
] as const;
const sections = {
  collection: ['overview', 'cards', 'binder'], wishlist: ['cards', 'deals'], transactions: ['overview', 'history'],
} as const;
type Destination = (typeof destinations)[number]['name'];
function SectionPage({ name }: { name: Destination }) {
  const { t } = useTranslation();
  const location = useLocation();
  const tabs = name in sections ? sections[name as keyof typeof sections] : null;
  return <div className={location.pathname === '/collection/cards' ? 'space-y-2' : 'space-y-6'}>
    {tabs && <nav aria-label={t('sectionNavigation')} className="flex gap-1 rounded-2xl border border-blue-100 bg-blue-100/70 p-1">{tabs.map(tab => <NavLink key={tab} to={`/${name}/${tab}`} className={({ isActive }) => `flex min-h-11 min-w-0 flex-1 items-center justify-center rounded-xl px-2 text-sm font-semibold transition-colors duration-150 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white/60'}`}>{t(tab)}</NavLink>)}</nav>}
    {location.pathname === '/collection/cards' ? <Suspense fallback={<LoadingState label={t('loading')} />}><InventoryPage /></Suspense> : <EmptyState title={t('comingTitle')} description={t('description')} />}
  </div>;
}
function Shell() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const query = useUIStore(s => s.searchQuery);
  const setQuery = useUIStore(s => s.setSearchQuery);
  const utility = location.pathname === '/search' ? 'search' : location.pathname === '/settings' ? 'settings' : null;
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
  const contentLocation = utility ? background ?? { ...location, pathname: '/dashboard' } : location;
  const current = destinations.find(d => contentLocation.pathname.startsWith(`/${d.name}`))?.name ?? 'dashboard';
  const openUtility = (name: 'search' | 'settings') => navigate(`/${name}`, { state: { backgroundLocation: location } });
  const closeUtility = () => { if (background) void navigate(-1); else void navigate('/dashboard', { replace: true }); };
  return <div className="app-shell mx-auto min-h-dvh max-w-3xl bg-blue-50">
    <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="skip-link rounded-xl bg-white p-3 text-blue-700">{t('skip')}</a>
    <header className="top-bar sticky top-0 z-20 border-b border-slate-700 bg-slate-900 text-white">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <span aria-hidden className="pokeball size-8 shrink-0" />
        <h1 className="min-w-0 flex-1 break-words text-xl font-bold tracking-tight sm:text-2xl">{t(current)}</h1>
        <div className="flex shrink-0 gap-1">
          <button type="button" onClick={() => openUtility('search')} aria-label={t('search')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSearch aria-hidden className="size-6" /></button>
          <button type="button" onClick={() => openUtility('settings')} aria-label={t('settings')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSettings aria-hidden className="size-6" /></button>
        </div>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="app-content space-y-6 px-4 pt-4 sm:px-6">
      <Routes location={contentLocation}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {destinations.map(({ name }) => <Route key={name} path={`/${name}`} element={name in sections ? <Navigate to={`/${name}/${sections[name as keyof typeof sections][0]}`} replace /> : <SectionPage name={name} />} />)}
        {Object.entries(sections).flatMap(([name, tabs]) => tabs.map(tab => <Route key={`${name}/${tab}`} path={`/${name}/${tab}`} element={<SectionPage name={name as Destination} />} />))}
        <Route path="/deals" element={<Navigate to="/wishlist/deals" replace />} />
        <Route path="*" element={<EmptyState title={t('missing')} description={t('missingDescription')} />} />
      </Routes>
    </main>
    <nav aria-label={t('navigation')} hidden={!!utility} className="bottom-bar fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl border-t border-slate-700 bg-slate-900 text-white">
      <div className="grid grid-cols-5 px-1">{destinations.map(({ name, icon: Icon }) => <NavLink key={name} to={`/${name}`} className={({ isActive }) => `flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1 text-center text-xs leading-4 transition-colors duration-150 focus-visible:outline-white ${isActive ? 'font-semibold text-sky-400' : 'text-slate-100 hover:bg-slate-800'}`}>
        {Icon ? <Icon aria-hidden className="size-6 shrink-0" /> : <span aria-hidden className="-mt-7 mb-1 rounded-full bg-slate-900 p-1"><span className="pokeball size-12" /></span>}<span className="break-words">{t(name)}</span>
      </NavLink>)}</div>
    </nav>
    {utility && <UtilitySheet title={t(utility === 'search' ? 'searchCards' : 'settings')} onClose={closeUtility}>
      {utility === 'search' ? <div className="space-y-6"><Field id="catalog-search" label={t('searchCards')} placeholder={t('searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} type="search" /><EmptyState title={t('catalogPending')} description={t('catalogDescription')} /></div> : <div className="space-y-4"><p className="text-xs font-medium text-slate-600">Pokefolio · {t('staging')}</p><p className="text-sm text-slate-600">{t('language')}</p><Button variant="outline" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')}>{i18n.language === 'en' ? 'עברית' : 'English'}</Button></div>}
    </UtilitySheet>}
  </div>;
}
function TranslatedLoading() { const { t } = useTranslation(); return <LoadingState label={t('loading')} />; }
export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><Suspense fallback={<TranslatedLoading />}><HashRouter><Shell /></HashRouter></Suspense></QueryClientProvider></ErrorBoundary>;
}
