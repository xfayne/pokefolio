import { lazy, Suspense } from 'react';
import { HashRouter, matchPath, NavLink, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuEllipsis, LuArrowLeftRight, LuHeart, LuLayers, LuScanLine, LuSearch, LuSettings } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { EmptyState, Field, LoadingState } from '@/components/ui/surfaces';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { useUIStore } from '@/state/ui';
import { createQueryClient } from './query-client';
import { DemoPortfolioProvider } from '@/features/transactions/demo-provider';
import { ErrorBoundary } from './error-boundary';
import '@/lib/i18n';
const InventoryPage = lazy(async () => { const module = await import('@/features/inventory/inventory-page'); return { default: module.InventoryPage }; });

const HistoryPage = lazy(async () => { const module = await import('@/features/transactions/history-page'); return { default: module.HistoryPage }; });

const PurchasePage = lazy(async () => { const module = await import('@/features/transactions/purchase-page'); return { default: module.PurchasePage }; });

const NewPurchasePage = lazy(async () => { const module = await import('@/features/transactions/new-purchase-page'); return { default: module.NewPurchasePage }; });

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
  return <div className={['/collection/cards', '/transactions/history'].includes(location.pathname) ? 'space-y-2' : 'space-y-6'}>
    {tabs && <nav aria-label={t('sectionNavigation')} className="section-tabs flex gap-1 rounded-full bg-blue-100/80 p-1">{tabs.map(tab => <NavLink key={tab} to={{ pathname: `/${name}/${tab}`, search: name === 'transactions' ? location.search : '' }} className={({ isActive }) => `flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-sm font-semibold transition-colors duration-150 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white/60'}`}>{t(tab)}</NavLink>)}</nav>}
    {location.pathname === '/collection/cards' ? <Suspense fallback={<LoadingState label={t('loading')} />}><InventoryPage /></Suspense> : location.pathname === '/transactions/history' ? <Suspense fallback={<LoadingState label={t('loading')} />}><HistoryPage /></Suspense> : <EmptyState title={t('comingTitle')} description={t('description')} />}
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
  const isNewPurchase = contentLocation.pathname === '/transactions/new';
  const isPurchase = !!matchPath('/transactions/purchases/:transactionId', contentLocation.pathname);
  const focusedTransaction = isPurchase || isNewPurchase;
  const backToHistory = () => {
    if ((location.state as { purchaseFrom?: string } | null)?.purchaseFrom === 'history') void navigate(-1);
    else void navigate({ pathname: '/transactions/history', search: contentLocation.search }, { replace: true });
  };
  const current = destinations.find(d => contentLocation.pathname.startsWith(`/${d.name}`))?.name ?? 'dashboard';
  const openUtility = (name: 'search' | 'settings') => navigate(`/${name}`, { state: { backgroundLocation: location } });
  const closeUtility = () => { if (background) void navigate(-1); else void navigate('/dashboard', { replace: true }); };
  return <div className="app-shell mx-auto min-h-dvh max-w-3xl bg-blue-50">
    <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="skip-link rounded-xl bg-white p-3 text-blue-700">{t('skip')}</a>
    <header className="top-bar sticky top-0 z-20 bg-slate-900 text-white">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <>{focusedTransaction ? <button type="button" onClick={backToHistory} aria-label={t('purchaseDetails.back')} className="flex size-7 shrink-0 items-center justify-center rounded-lg focus-visible:outline-white"><LuArrowLeft aria-hidden className="size-6 rtl:rotate-180" /></button> : <span aria-hidden className="brand-ball pokeball size-7 shrink-0" />}</>
        <h1 tabIndex={focusedTransaction ? -1 : undefined} className="brand-title min-w-0 flex-1 break-words text-xl font-bold tracking-tight sm:text-2xl">{t(isNewPurchase ? 'newPurchase.title' : isPurchase ? 'purchaseDetails.title' : current)}</h1>
        {((contentLocation.pathname === '/collection/cards' && new URLSearchParams(contentLocation.search).get('inventory') === 'sample') || (contentLocation.pathname.startsWith('/transactions/') && new URLSearchParams(contentLocation.search).get('transactions') === 'sample')) && <span className="rounded-full bg-white/15 px-2 py-1 text-xs font-medium">{t('inventory.demo')}</span>}
        <div className="flex shrink-0 gap-1">{focusedTransaction ? <button type="button" disabled aria-label={t('purchaseDetails.more')} title={t('purchaseDetails.moreDetail')} className="flex size-11 items-center justify-center rounded-xl text-white"><LuEllipsis aria-hidden className="size-6" /></button> : <>
          <button type="button" onClick={() => openUtility('search')} aria-label={t('search')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSearch aria-hidden className="size-6" /></button>
          <button type="button" onClick={() => openUtility('settings')} aria-label={t('settings')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSettings aria-hidden className="size-6" /></button>
        </>} </div>
      </div>
    </header>
    <main id="main-content" tabIndex={-1} className="app-content space-y-6 px-3 pt-3 sm:px-6">
      <Routes location={contentLocation}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {destinations.map(({ name }) => <Route key={name} path={`/${name}`} element={name in sections ? <Navigate to={{ pathname: `/${name}/${sections[name as keyof typeof sections][0]}`, search: contentLocation.search }} replace /> : <SectionPage name={name} />} />)}
        {Object.entries(sections).flatMap(([name, tabs]) => tabs.map(tab => <Route key={`${name}/${tab}`} path={`/${name}/${tab}`} element={<SectionPage name={name as Destination} />} />))}
        <Route path="/transactions/new" element={<Suspense fallback={<LoadingState label={t('loading')} />}><NewPurchasePage key={new URLSearchParams(contentLocation.search).get('transactions') === 'sample' ? 'sample' : 'account'} /></Suspense>} />
        <Route path="/transactions/purchases/:transactionId" element={<Suspense fallback={<LoadingState label={t('loading')} />}><PurchasePage /></Suspense>} />
        <Route path="/transactions/shipments" element={<Navigate to={{ pathname: "/transactions/overview", search: contentLocation.search }} replace />} />
        <Route path="/deals" element={<Navigate to="/wishlist/deals" replace />} />
        <Route path="*" element={<EmptyState title={t('missing')} description={t('missingDescription')} />} />
      </Routes>
    </main>
    <nav aria-label={t('navigation')} hidden={!!utility} className="bottom-bar fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl bg-slate-900 text-white">
      <div className="grid grid-cols-5 px-1">{destinations.map(({ name, icon: Icon }) => <NavLink key={name} to={`/${name}`} className={({ isActive }) => `flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1 text-center text-xs leading-4 transition-colors duration-150 focus-visible:outline-white ${isActive ? 'font-semibold text-sky-400' : 'text-slate-100 hover:bg-slate-800'}`}>
        {Icon ? <Icon aria-hidden className="size-6 shrink-0" /> : <span aria-hidden className="-mt-5 mb-1 rounded-full bg-slate-900 p-1"><span className="pokeball size-10" /></span>}<span className="break-words">{t(name)}</span>
      </NavLink>)}</div>
    </nav>
    {utility && <UtilitySheet title={t(utility === 'search' ? 'searchCards' : 'settings')} onClose={closeUtility}>
      {utility === 'search' ? <div className="space-y-6"><Field id="catalog-search" label={t('searchCards')} placeholder={t('searchPlaceholder')} value={query} onChange={e => setQuery(e.target.value)} type="search" /><EmptyState title={t('catalogPending')} description={t('catalogDescription')} /></div> : <div className="space-y-4"><p className="text-xs font-medium text-slate-600">Pokefolio · {t('staging')}</p><p className="text-sm text-slate-600">{t('language')}</p><Button variant="outline" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')}>{i18n.language === 'en' ? 'עברית' : 'English'}</Button></div>}
    </UtilitySheet>}
  </div>;
}
function TranslatedLoading() { const { t } = useTranslation(); return <LoadingState label={t('loading')} />; }
export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><Suspense fallback={<TranslatedLoading />}><HashRouter><DemoPortfolioProvider><Shell /></DemoPortfolioProvider></HashRouter></Suspense></QueryClientProvider></ErrorBoundary>;
}
