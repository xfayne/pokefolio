import { WishlistPage } from '@/features/wishlist/wishlist-page';
import { SectionTabsBar } from '@/components/ui/section-tabs-bar';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { AnalyzePage } from '@/features/analyze/analyze-page';
import {StagingYearLoader} from '@/features/staging/year-loader';
import {StagingEnglishLanguageRepair} from '@/features/staging/english-language-repair-tool';
import { PurchaseReceiptAction } from '@/features/transactions/purchase-receipt-action';
import { useTrackingSync } from '@/hooks/use-tracking-sync';
import { unreadTracking } from '@/domain/shipment-tracking';
import { TransactionHeaderContext } from '@/features/transactions/transaction-header-context';
import { NewSalePage } from '@/features/transactions/new-sale-page';
import { SalePage, SaleActions } from '@/features/transactions/sale-page';
import {DisplayCurrencyProvider,CurrencySettings} from '@/services/display-currency';
import { PurchaseActions } from '@/features/transactions/purchase-actions';
import { usePortfolio } from '@/hooks/use-portfolio';
import { DashboardPage } from '@/features/dashboard/dashboard-page';
import { EditPurchasePage } from '@/features/transactions/edit-purchase-page';
import { AccountControls } from '@/features/account-controls';
import { createSampleCopies } from '@/features/inventory/sample';
import { useDemoTransactionData } from '@/features/transactions/demo-data';
import { initialCatalogSearch } from '@/features/catalog/search-state';
import { CatalogSearch } from '@/features/catalog/catalog-search';
import { CatalogDetails } from '@/features/catalog/catalog-details';
import type { InventoryCatalogCard } from '@/domain/inventory';
import { lazy, useEffect, useRef, useState, Suspense } from 'react';
import { HashRouter, matchPath, NavLink, Navigate, Route, Routes, useLocation, useNavigate, type Location } from 'react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { LuArrowLeft, LuArrowLeftRight, LuHeart, LuLayers, LuPlus, LuScanLine, LuSearch, LuSettings } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { EmptyState, LoadingState } from '@/components/ui/surfaces';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { useUIStore } from '@/state/ui';
import { readSectionTabs, saveSectionTabs, sectionTabFromPath, sections, type Section } from '@/state/section-tabs';
import { createQueryClient } from './query-client';
import { DemoPortfolioProvider } from '@/features/transactions/demo-provider';
import { ErrorBoundary } from './error-boundary';
import '@/lib/i18n';
const BinderPage = lazy(async () => { const module = await import('@/features/binder/binder-page'); return { default: module.BinderPage }; });
const SharedBinderPage = lazy(async () => { const module = await import('@/features/binder/shared-binder-page'); return { default: module.SharedBinderPage }; });
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
type Destination = (typeof destinations)[number]['name'];
function SavedSectionRedirect({ name, search }: { name: keyof typeof sections; search: string }) {
  // A section root is mounted on navigation, so read the latest device preference.
  const [tabs] = useState(readSectionTabs);
  return <Navigate to={{ pathname: `/${name}/${tabs[name]}`, search }} replace />;
}
function SectionPage({ name }: { name: Destination }) {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const hasTabs = name in sections;
  const isTransactions = name === 'transactions';
  const createTransaction = () => {
    void navigate({ pathname: '/transactions/new', search: location.search }, { state: { purchaseFrom: 'history' } });
  };
  return <div className={location.pathname === '/collection/binder' ? 'binder-section' : ['/collection/cards', '/wishlist/cards', '/transactions/history'].includes(location.pathname) ? 'space-y-1' : 'space-y-6'}>
    {hasTabs && <SectionTabsBar section={name as Section} search={isTransactions ? location.search : ''} action={isTransactions ? <button type="button" onClick={createTransaction} aria-label={t('transactionHistory.new')} title={t('transactionHistory.new')} className="transactions-add flex size-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white focus-visible:outline-blue-800"><LuPlus aria-hidden className="size-5" /></button> : undefined} />}
    {location.pathname === '/collection/binder' ? <Suspense fallback={<LoadingState label={t('loading')} />}><BinderPage /></Suspense> : name === 'analyze' ? <AnalyzePage /> : name === 'dashboard' ? <DashboardPage /> : location.pathname === '/collection/cards' ? <Suspense fallback={<LoadingState label={t('loading')} />}><InventoryPage /></Suspense> : location.pathname === '/wishlist/cards' ? <WishlistPage /> : location.pathname === '/transactions/history' ? <Suspense fallback={<LoadingState label={t('loading')} />}><HistoryPage /></Suspense> : <EmptyState title={t('comingTitle')} description={t('description')} />}
  </div>;
}
function Shell() {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const [catalogUi, setCatalogUi] = useState(initialCatalogSearch);
  const catalogScrollPosition = useRef(0);
  const [catalogCard, setCatalogCard] = useState<InventoryCatalogCard | null>(null);
  const query = useUIStore(s => s.searchQuery);
  const setQuery = useUIStore(s => s.setSearchQuery);
  const utility = location.pathname === '/search' ? 'search' : location.pathname === '/settings' ? 'settings' : null;
  const background = (location.state as { backgroundLocation?: Location } | null)?.backgroundLocation;
  const contentLocation = utility ? background ?? { ...location, pathname: '/dashboard' } : location;
  useEffect(() => {
    const selected = sectionTabFromPath(contentLocation.pathname);
    if (!selected) return;
    const saved = readSectionTabs();
    if (saved[selected.section] !== selected.tab) saveSectionTabs({ ...saved, [selected.section]: selected.tab });
  }, [contentLocation.pathname]);
  const demoTransactions = useDemoTransactionData();
  const account = usePortfolio();
  const wish = useWishlist();
  const contextParams = new URLSearchParams(contentLocation.search);
  const tracking = useTrackingSync(account.owner, account.records, contextParams.get('transactions') !== 'sample' && contextParams.get('inventory') !== 'sample');
  const unread = account.records.reduce((sum,e) => sum + (e.collection === 'shipments' ? unreadTracking(e.record) : 0), 0);
  const previewCopies = contextParams.get('inventory') === 'sample' ? createSampleCopies() : contextParams.get('transactions') === 'sample' ? demoTransactions.history.copies : account.history.copies;
  const catalogOwned: Record<string,number> = {};
  for (const copy of previewCopies) if (copy.catalog.kind === 'identified' && copy.possession === 'received' && copy.disposition === 'held') catalogOwned[copy.catalog.cardId] = (catalogOwned[copy.catalog.cardId] ?? 0) + 1;
  const [saveTarget, setSaveTarget] = useState<HTMLDivElement | null>(null);
  const [kindTarget, setKindTarget] = useState<HTMLDivElement | null>(null);
  const isEditing = contentLocation.pathname.endsWith('/edit');
  const isNewPurchase = ['/transactions/new', '/transactions/new-sale'].includes(contentLocation.pathname);
  const isTransactionForm = isNewPurchase || isEditing;
  const purchaseMatch = matchPath('/transactions/purchases/:transactionId', contentLocation.pathname);
  const saleMatch = matchPath('/transactions/sales/:transactionId', contentLocation.pathname);
  const isSale = !!saleMatch;
  const editingSale = contentLocation.pathname.startsWith('/transactions/sales/');
  const isPurchase = !!purchaseMatch;
  const selectedPurchase = account.records.find(e => e.collection === 'transactions' && e.record.id === purchaseMatch?.params.transactionId);
  const [receiptBusy,setReceiptBusy] = useState(false);
  const purchaseCopies = account.history.copies.filter(c => c.acquisition.kind === 'purchase' && c.acquisition.transactionId === purchaseMatch?.params.transactionId);
  const importedPurchase = selectedPurchase?.collection === 'transactions' && selectedPurchase.record.kind === 'purchase' && 'origin' in selectedPurchase.record;
  const editDisabled = receiptBusy || !purchaseCopies.length || purchaseCopies.some(c => c.disposition !== 'held' || (!importedPurchase && c.possession !== 'pending'));
  const canEditPurchase = isPurchase && contextParams.get('transactions') !== 'sample' && selectedPurchase?.collection === 'transactions' && selectedPurchase.record.kind === 'purchase' && selectedPurchase.record.settlement === 'unknown';
  const focusedTransaction = isSale || isPurchase || isNewPurchase || isEditing;
  const backToHistory = () => {
    if ((location.state as { purchaseFrom?: string } | null)?.purchaseFrom === 'history') void navigate(-1);
    else void navigate({ pathname: '/transactions/history', search: contentLocation.search }, { replace: true });
  };
  const current = destinations.find(d => contentLocation.pathname.startsWith(`/${d.name}`))?.name ?? 'dashboard';
  const openUtility = (name: 'search' | 'settings') => navigate(`/${name}`, { state: { backgroundLocation: location } });
  const closeUtility = () => { if (background) void navigate(-1); else void navigate('/dashboard', { replace: true }); };
  return <div data-binder={contentLocation.pathname === "/collection/binder" || undefined} data-analyzer={contentLocation.pathname === "/analyze" || undefined} className="app-shell mx-auto min-h-dvh max-w-3xl bg-blue-50">
    <a href="#main-content" onClick={event => { event.preventDefault(); document.getElementById('main-content')?.focus(); }} className="skip-link rounded-xl bg-white p-3 text-blue-700">{t('skip')}</a>
    <header data-transaction-form={isTransactionForm || undefined} className="top-bar sticky top-0 z-20 bg-slate-900 text-white">
      <div className="flex min-h-16 items-center gap-3 px-4 sm:px-6">
        <>{focusedTransaction ? <button type="button" onClick={backToHistory} aria-label={t('purchaseDetails.back')} className="flex size-7 shrink-0 items-center justify-center rounded-lg focus-visible:outline-white"><LuArrowLeft aria-hidden className="size-6 rtl:rotate-180" /></button> : <span aria-hidden className="brand-ball pokeball size-7 shrink-0" />}</>
        <h1 tabIndex={focusedTransaction ? -1 : undefined} className="brand-title min-w-0 flex-1 break-words text-xl font-bold tracking-tight sm:text-2xl">{current==='dashboard'?'Pokefolio':t(isEditing ? editingSale ? 'sale.edit' : 'newPurchase.editTitle' : isNewPurchase ? 'newPurchase.title' : isSale ? 'sale.title' : isPurchase ? 'purchaseDetails.title' : current)}</h1>
        {((contentLocation.pathname.startsWith('/wishlist/') && new URLSearchParams(contentLocation.search).get('wishlist') === 'sample') || (contentLocation.pathname === '/dashboard'&&new URLSearchParams(contentLocation.search).get('dashboard')==='sample') || (contentLocation.pathname.startsWith('/collection/') && (new URLSearchParams(contentLocation.search).get('inventory') === 'sample'||new URLSearchParams(contentLocation.search).get('transactions')==='sample')) || (contentLocation.pathname.startsWith('/transactions/') && new URLSearchParams(contentLocation.search).get('transactions') === 'sample')) && <span className={`rounded-full px-2 py-1 text-xs font-medium ${current==='dashboard'?'bg-blue-600':'bg-white/15'}`}>{t('inventory.demo')}</span>}
        <div key={`header-actions-${contentLocation.pathname}`} className="flex shrink-0 gap-1">{isTransactionForm ? <div ref={setSaveTarget} /> : focusedTransaction ? isSale ? <SaleActions key={contentLocation.pathname} id={saleMatch!.params.transactionId!} /> : isPurchase ? <><PurchaseReceiptAction onBusy={setReceiptBusy} key={`receipt-${contentLocation.pathname}`} id={purchaseMatch?.params.transactionId ?? ''} preview={contextParams.get('transactions') === 'sample'} /><PurchaseActions disabled={editDisabled} key={`edit-${contentLocation.pathname}`} onEdit={canEditPurchase ? () => { void navigate(`/transactions/purchases/${purchaseMatch!.params.transactionId}/edit`); } : undefined} /></> : null : <>
          <button type="button" onClick={() => openUtility('search')} aria-label={t('search')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSearch aria-hidden className="size-6" /></button>
          <button type="button" onClick={() => openUtility('settings')} aria-label={t('settings')} className="flex size-11 items-center justify-center rounded-xl transition-colors hover:bg-slate-800 focus-visible:outline-white"><LuSettings aria-hidden className="size-6" /></button>
        </>} </div>
      </div>
      {isTransactionForm && <div ref={setKindTarget} className="transaction-kind-slot px-3 pt-3 pb-1.5 sm:px-6" />}
    </header>
    <main data-transaction-form={isTransactionForm || undefined} id="main-content" tabIndex={-1} className="app-content space-y-6 px-3 pt-3 sm:px-6">
      <TransactionHeaderContext value={{ actions: saveTarget, tabs: kindTarget }}>
      <Routes location={contentLocation}>
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        {destinations.map(({ name }) => <Route key={name} path={`/${name}`} element={name in sections ? <SavedSectionRedirect name={name as keyof typeof sections} search={contentLocation.search} /> : <SectionPage name={name} />} />)}
        {Object.entries(sections).flatMap(([name, tabs]) => tabs.map(tab => <Route key={`${name}/${tab}`} path={`/${name}/${tab}`} element={<SectionPage name={name as Destination} />} />))}
        <Route path="/transactions/new-sale" element={<NewSalePage />} />
        <Route path="/transactions/sales/:transactionId" element={<SalePage />} />
        <Route path="/transactions/sales/:transactionId/edit" element={<NewSalePage editing />} />
        <Route path="/transactions/purchases/:transactionId/edit" element={<EditPurchasePage />} />
        <Route path="/transactions/new" element={<Suspense fallback={<LoadingState label={t('loading')} />}><NewPurchasePage key={new URLSearchParams(contentLocation.search).get('transactions') === 'sample' ? 'sample' : 'account'} /></Suspense>} />
        <Route path="/transactions/purchases/:transactionId" element={<Suspense fallback={<LoadingState label={t('loading')} />}><PurchasePage trackingErrors={tracking.data?.errors} trackingFailed={!!tracking.error} onRefresh={() => { void tracking.refetch(); }} refreshing={tracking.isFetching} /></Suspense>} />
        <Route path="/transactions/shipments" element={<Navigate to={{ pathname: "/transactions/overview", search: contentLocation.search }} replace />} />
        <Route path="/deals" element={<Navigate to="/wishlist/deals" replace />} />
        <Route path="*" element={<EmptyState title={t('missing')} description={t('missingDescription')} />} />
      </Routes>
      </TransactionHeaderContext>
    </main>
    <nav aria-label={t('navigation')} hidden={!!utility} className="bottom-bar fixed inset-x-0 bottom-0 z-30 mx-auto max-w-3xl bg-slate-900 text-white">
      <div className="grid grid-cols-5 px-1">{destinations.map(({ name, icon: Icon }) => <NavLink key={name} to={`/${name}`} className={({ isActive }) => `flex min-h-16 min-w-0 flex-col items-center justify-center gap-1 px-1 pb-1 text-center text-xs leading-4 transition-colors duration-150 focus-visible:outline-white ${isActive ? 'font-semibold text-sky-400' : 'text-slate-100 hover:bg-slate-800'}`}>
        {Icon ? <Icon aria-hidden className="size-6 shrink-0" /> : <span aria-hidden className="-mt-5 mb-1 rounded-full bg-slate-900 p-1"><span className="pokeball size-10" /></span>}<span className="break-words">{t(name)}{name === 'transactions' && unread > 0 && <span className="ms-1 rounded-full bg-blue-600 px-1.5 text-xs text-white" aria-label={t('purchaseDetails.unread', {count:unread})}>{unread > 99 ? '99+' : unread}</span>}</span>
      </NavLink>)}</div>
    </nav>
    {/* Keep Search mounted behind Card Details. Returning reveals the same
        scrollport and decoded images, without replaying the catalog entrance. */}
    {utility && <UtilitySheet title={t(utility === 'search' ? 'searchCards' : 'settings')} onClose={closeUtility} contentMode={utility === 'search' ? 'contained' : 'scroll'}>
      {utility === 'search' ? <CatalogSearch owned={catalogOwned} wishlist={wish.wishlist.cardIds} state={catalogUi} onState={setCatalogUi} query={query} onQuery={setQuery} onSelect={setCatalogCard} scrollPositionRef={catalogScrollPosition} /> : <div className="space-y-4"><p className="text-xs font-medium text-slate-600">Pokefolio · {t('staging')}</p><AccountControls /><CurrencySettings /><StagingYearLoader /><StagingEnglishLanguageRepair /><p className="text-sm text-slate-600">{t('language')}</p><Button variant="outline" onClick={() => void i18n.changeLanguage(i18n.language === 'en' ? 'he' : 'en')}>{i18n.language === 'en' ? 'עברית' : 'English'}</Button></div>}
    </UtilitySheet>}
    {utility === 'search' && catalogCard && <CatalogDetails card={catalogCard} onClose={() => setCatalogCard(null)} />}
  </div>;
}
function ApplicationRoutes() { return <Routes><Route path="/binder/share/:shareId" element={<Suspense fallback={<TranslatedLoading />}><SharedBinderPage /></Suspense>} /><Route path="*" element={<Shell />} /></Routes>; }
function TranslatedLoading() { const { t } = useTranslation(); return <LoadingState label={t('loading')} />; }
export function App() {
  return <ErrorBoundary><QueryClientProvider client={queryClient}><Suspense fallback={<TranslatedLoading />}><HashRouter><DemoPortfolioProvider><DisplayCurrencyProvider><ApplicationRoutes /></DisplayCurrencyProvider></DemoPortfolioProvider></HashRouter></Suspense></QueryClientProvider></ErrorBoundary>;
}
