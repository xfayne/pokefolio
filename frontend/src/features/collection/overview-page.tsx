import { useId, useState, type ReactNode } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import { useQueryClient } from '@tanstack/react-query';
import { LuArrowDownRight, LuArrowUpRight, LuCheck, LuChevronRight, LuHeart, LuLayers, LuChartPie, LuSparkles, LuTruck, LuWallet } from 'react-icons/lu';
import { Button } from '@/components/ui/button';
import { Card, EmptyState } from '@/components/ui/surfaces';
import { PokemonArt } from '@/components/ui/pokemon-art';
import { CardCarousel } from '@/components/ui/card-carousel';
import { SearchInput } from '@/components/ui/search-input';
import { UtilitySheet } from '@/components/ui/utility-sheet';
import { usePortfolio } from '@/hooks/use-portfolio';
import { PortfolioStatus } from '@/features/portfolio-status';
import { useWishlist } from '@/features/wishlist/use-wishlist';
import { sampleWishlistIds } from '@/features/wishlist/sample';
import { createSampleCopies, sampleOwner, sampleQuotes } from '@/features/inventory/sample';
import { catalogCards, catalogMarketReference } from '@/features/catalog/catalog';
import { useDisplayCurrency, convertDisplay } from '@/services/display-currency';
import { useHistoricalFx } from '@/services/historical-fx';
import type { CopyQuote, InventoryCatalogCard } from '@/domain/inventory';
import type { Money } from '@/domain/schema';
import { currentCopies, remainingWishes, selectCollectionOverview, selectWishlistBudget, type Holding } from './overview-model';
import { useOverviewPrices } from './use-overview-prices';
import { useFeaturedCards } from './use-featured-cards';
import './overview.css';

const labels = {
  en: {
    title: 'Collection overview', received: 'In Collection', pending: 'On the Way', wishlist: 'Wishlist', budget: 'Wishlist Estimate',
    physical: 'received copies', arriving: 'copies arriving', toBuy: 'cards still to buy', lp: 'LP · card prices only',
    priced: 'priced', partial: 'Partial estimate', estimate: 'Market estimate',
    favorites: 'Your Highlights', choose: 'Choose cards', chooseTitle: 'Choose your highlights', chooseHint: 'Choose up to 5 cards from your collection.',
    emptyFavorites: 'Give your favorite cards a place in the spotlight.', save: 'Save selection', saveFailed: 'Could not save your selection. Try again.',
    favoriteFailed: 'Could not load your highlights.', search: 'Search your collection', noMatches: 'No matching cards.',
    noCards: 'Your received cards will appear here.',
    comparison: 'Cost vs. Market', above: 'Above cost', below: 'Below cost', cost: 'Cost', market: 'Market',
    compared: 'received copies with comparable prices and costs', comparisonEmpty: 'Comparable market prices and complete acquisition costs will appear here.',
    even: 'Your priced cards are currently at their recorded cost.',
    concentration: 'Value Concentration', top: 'Top', ofValue: 'of priced value', rest: 'Rest of collection',
    concentrationEmpty: 'Available market prices will reveal how your collection value is distributed.',
    receivedPriced: 'received copies priced', unknown: 'copies with unknown receipt status',
    loading: 'Loading prices…', wishlistFailed: 'Could not load Wishlist.', pricesFailed: 'Some prices or exchange rates are unavailable.',
    signIn: 'Sign in to see your collection overview.', explore: 'Explore sample collection', retry: 'Retry',
    estimateNote: 'LP market estimate for one of each remaining card. Shipping, taxes and fees excluded.',
  },
  he: {
    title: 'סקירת האוסף', received: 'באוסף שלי', pending: 'בדרך אליי', wishlist: 'רשימת משאלות', budget: 'אומדן המשאלות',
    physical: 'עותקים שהתקבלו', arriving: 'עותקים בדרך', toBuy: 'קלפים שעוד ארצה לקנות', lp: 'LP · מחירי קלפים בלבד',
    priced: 'מתומחרים', partial: 'אומדן חלקי', estimate: 'אומדן שוק',
    favorites: 'הנבחרים שלי', choose: 'בחירת קלפים', chooseTitle: 'בחירת הקלפים הנבחרים', chooseHint: 'בחר עד 5 קלפים מתוך האוסף שלך.',
    emptyFavorites: 'מקום לקלפים האהובים עליך באוסף.', save: 'שמירת הבחירה', saveFailed: 'לא ניתן לשמור את הבחירה. נסה שוב.',
    favoriteFailed: 'לא ניתן לטעון את הקלפים הנבחרים.', search: 'חיפוש באוסף', noMatches: 'לא נמצאו קלפים מתאימים.',
    noCards: 'כאן יופיעו הקלפים שכבר התקבלו.',
    comparison: 'עלות מול שווי', above: 'מעל העלות', below: 'מתחת לעלות', cost: 'עלות', market: 'שוק',
    compared: 'עותקים שהתקבלו עם מחיר שוק ועלות להשוואה', comparisonEmpty: 'כאן יוצגו קלפים עם מחיר שוק ועלות רכישה מלאה להשוואה.',
    even: 'שווי הקלפים המתומחרים שלך כרגע שווה לעלותם המתועדת.',
    concentration: 'הרכב השווי', top: 'המובילים', ofValue: 'מהשווי המתומחר', rest: 'שאר האוסף',
    concentrationEmpty: 'מחירי השוק הזמינים יציגו כיצד מתחלק שווי האוסף שלך.',
    receivedPriced: 'עותקים שהתקבלו מתומחרים', unknown: 'עותקים שסטטוס הקבלה שלהם לא ידוע',
    loading: 'טוען מחירים…', wishlistFailed: 'לא ניתן לטעון את רשימת המשאלות.', pricesFailed: 'חלק מהמחירים או שערי ההמרה אינם זמינים.',
    signIn: 'התחבר כדי לראות את סקירת האוסף שלך.', explore: 'צפייה באוסף לדוגמה', retry: 'ניסיון נוסף',
    estimateNote: 'אומדן שוק לפי LP לעותק אחד מכל קלף שנותר לקנות. ללא משלוח, מסים ועמלות.',
  },
};

// Synthetic prices are isolated to the explicitly marked inventory=sample view.
const demoWishQuotes: CopyQuote[] = sampleWishlistIds.slice(0, -1).map((id, index) => ({
  catalog: catalogMarketReference(id), condition: 'LP', money: {currency: 'USD', minor: 2500 + index * 1175},
  observedAt: '2026-11-28T12:00:00Z', source: 'Synthetic preview price',
}));

export function CollectionOverviewPage() {
  const { i18n } = useTranslation();
  const he = i18n.language === 'he', text = labels[he ? 'he' : 'en'];
  const [params] = useSearchParams();
  const preview = params.get('inventory') === 'sample';
  const navigate = useNavigate();
  const client = useQueryClient();
  const account = usePortfolio(), wish = useWishlist(), display = useDisplayCurrency();
  const copies = preview ? createSampleCopies() : account.history.copies;
  const owner = preview ? sampleOwner : account.owner ?? 'disconnected';
  const wishes = remainingWishes(copies, preview ? sampleWishlistIds : wish.wishlist.cardIds);
  const enabled = !preview && !!account.owner && !account.loading && !account.error;
  const prices = useOverviewPrices(copies, wish.loading || wish.error ? [] : wishes, enabled);
  const currency = preview ? 'USD' : display?.currency ?? 'USD';
  const convert = (money: Money) => preview ? convertDisplay(money.minor, money.currency, 'USD', { USD:1, GBP:0.8, EUR:0.9, ILS:3.7 })
    : display ? display.convert(money.minor, money.currency) : money.currency === currency ? money.minor : null;
  const held = currentCopies(copies).filter(copy => copy.possession === 'received');
  const dates = held.flatMap(copy => copy.acquiredOn.status === 'known' ? [copy.acquiredOn.value] : []);
  const needsHistoricalFx = held.some(copy => [copy.cardCost,copy.shippingCost,copy.taxCost,copy.feeCost].some(cost =>
    (cost.status === 'exact' || cost.status === 'estimated') && cost.value.currency !== currency));
  const fx = useHistoricalFx(dates, new Date().toISOString().slice(0,10), enabled && needsHistoricalFx);
  const figures = selectCollectionOverview({ owner, copies, catalog: catalogCards, quotes: preview ? sampleQuotes : prices.quotes,
    currency, fx: fx.rows, convert });
  const budget = selectWishlistBudget(wishes, preview ? demoWishQuotes : prices.quotes, 'LP', convert);
  const featured = useFeaturedCards(account.owner, preview);
  const [choosing, setChoosing] = useState(false);
  const id = useId();
  const format = (minor: number | null, signed = false) => minor === null ? '—' : new Intl.NumberFormat(he ? 'he-IL' : 'en-US', {
    style:'currency', currency, maximumFractionDigits:0, minimumFractionDigits:0, ...(signed ? {signDisplay:'always' as const} : {}),
  }).format(minor / 100);
  const number = (value: number) => new Intl.NumberFormat(he ? 'he-IL' : 'en-US').format(value);
  const openCollection = (delivery: 'received' | 'pending', copyId?: string) => {
    const next = new URLSearchParams({delivery});
    if (preview) next.set('inventory','sample');
    if (copyId) next.set('cardCopy',copyId);
    void navigate({pathname:'/collection/cards',search:next.toString()});
  };
  const openWishlist = () => {
    const next = new URLSearchParams({remaining:'1'});
    if (preview) next.set('wishlist','sample');
    void navigate({pathname:'/wishlist/cards',search:next.toString()});
  };
  if (!preview && (account.loading || account.error)) return <PortfolioStatus loading={account.loading} error={account.error} />;
  if (!preview && !account.owner) return <EmptyState title={text.title} description={text.signIn}
    action={<Button onClick={() => { void navigate('/collection/overview?inventory=sample'); }}>{text.explore}</Button>} />;
  const wishReady = preview || !wish.loading && !wish.error;
  const priceLoading = !preview && prices.loading;
  const highlights = featured.ids.flatMap(cardId => {
    const holding = figures.holdings.find(holding => holding.card.id === cardId);
    return holding ? [holding] : [];
  });
  const available = [...new Map(figures.holdings.map(holding => [holding.card.id,holding.card])).values()];
  const coverage = `${number(budget.covered)}/${number(budget.total)} ${text.priced}`;
  const metrics = [
    {key:'received',label:text.received,value:number(figures.received),detail:text.physical,Icon:LuLayers,onOpen:()=>openCollection('received')},
    {key:'pending',label:text.pending,value:number(figures.pending),detail:text.arriving,Icon:LuTruck,onOpen:()=>openCollection('pending')},
    {key:'wishlist',label:text.wishlist,value:wishReady?number(wishes.length):'—',detail:text.toBuy,Icon:LuHeart,onOpen:openWishlist},
    {key:'budget',label:text.budget,value:wishReady?format(budget.minor):'—',detail:text.lp,Icon:LuWallet,onOpen:openWishlist},
  ];
  return <article className="collection-overview" aria-label={text.title}>
    <div className="collection-metrics">{metrics.map(({key,label,value,detail,Icon,onOpen}) => <button type="button" key={key}
      className="collection-metric surface-panel" data-metric={key} onClick={onOpen} disabled={!wishReady && ['wishlist','budget'].includes(key)}>
      <span className="collection-metric-top"><span className="collection-metric-icon"><Icon aria-hidden /></span><LuChevronRight aria-hidden className="collection-metric-chevron rtl:rotate-180" /></span>
      <span className="collection-metric-label">{label}</span><bdi className="collection-metric-value">{key==='budget'&&budget.minor!==null&&budget.total>0&&wishReady&&<span aria-hidden>≈ </span>}{value}</bdi>
      <span className="collection-metric-detail">{detail}</span>
    </button>)}</div>
    <div className="collection-budget-note" aria-live="polite">
      <span>{!wishReady ? wish.error ? text.wishlistFailed : text.loading : budget.covered < budget.total ? text.partial : text.estimate}</span>
      {wishReady && <span>{coverage}{priceLoading ? ' · …' : ''}</span>}
      {!preview && wish.error && <button type="button" onClick={wish.retry}>{text.retry}</button>}
    </div>
    <p className="sr-only">{text.estimateNote}</p>
    {figures.unknown > 0 && <p className="collection-note">{number(figures.unknown)} {text.unknown}</p>}

    <div className="collection-highlights"><CardCarousel title={text.favorites} actionLabel={text.choose} onAction={() => setChoosing(true)}
      items={highlights.map(holding => ({id:holding.copy.id,name:holding.card.name,imageUrl:holding.card.imageUrl,showName:true,
        caption:holding.market === null ? holding.card.setName : format(holding.market),onOpen:()=>openCollection('received',holding.copy.id)}))}
      empty={featured.loading ? text.loading : featured.error ? <>{text.favoriteFailed} <button type="button" onClick={featured.retry}>{text.retry}</button></> : <span className="collection-highlight-empty"><LuSparkles aria-hidden />{text.emptyFavorites}</span>} />
    </div>

    <Card className="collection-comparison" aria-labelledby={`${id}-compare`}>
      <div className="collection-section-heading"><h2 id={`${id}-compare`}>{text.comparison}</h2><LuArrowUpRight aria-hidden /></div>
      <p className="collection-note">{number(figures.compared)}/{number(figures.comparableTotal)} {text.compared}</p>
      {(['above','below'] as const).map(side => figures[side].length > 0 && <div className="collection-gain-section" key={side} data-gain={side}>
        <h3>{side==='above'?<LuArrowUpRight aria-hidden />:<LuArrowDownRight aria-hidden />}{text[side]}</h3>
        <ul>{figures[side].map(holding => <li key={holding.copy.id}><HoldingRow holding={holding} onOpen={()=>openCollection('received',holding.copy.id)}
          subtitle={`${text.cost} ${format(holding.basis)} · ${text.market} ${format(holding.market)}`}>
          <bdi>{format(holding.gain,true)}</bdi><span>{holding.roi === null ? '—' : `${holding.roi>0?'+':''}${holding.roi.toFixed(1)}%`}</span>
        </HoldingRow></li>)}</ul>
      </div>)}
      {!figures.above.length && !figures.below.length && <p className="collection-empty">{priceLoading || fx.loading ? text.loading : figures.compared ? text.even : text.comparisonEmpty}</p>}
    </Card>

    <Card className="collection-concentration" aria-labelledby={`${id}-value`}>
      <div className="collection-section-heading"><h2 id={`${id}-value`}>{text.concentration}</h2><LuChartPie aria-hidden /></div>
      {figures.total > 0 ? <>
        <div className="collection-concentration-summary"><div><span>{text.top} {number(figures.top.length)}</span>
          <strong>{(figures.topValue/figures.total*100).toFixed(0)}<small>%</small></strong><span>{text.ofValue}</span></div>
          <bdi>{format(figures.topValue)}</bdi></div>
        <div className="collection-value-bar" role="img" aria-label={`${text.top} ${figures.top.length}: ${(figures.topValue/figures.total*100).toFixed(1)}%`}>
          {figures.top.map((group,index)=><span key={group.card.id} data-rank={index} style={{flexGrow:group.minor}} />)}
          {figures.total>figures.topValue&&<span data-rank="rest" style={{flexGrow:figures.total-figures.topValue}} />}
        </div>
        <ul className="collection-value-rows">{figures.top.map((group,index)=><li key={group.card.id}><button type="button" onClick={()=>openCollection('received',group.copyId)}>
          <span className="collection-value-dot" data-rank={index} /><span>{group.card.name}</span><bdi>{format(group.minor)}</bdi><span>{(group.minor/figures.total*100).toFixed(1)}%</span>
        </button></li>)}{figures.total>figures.topValue&&<li className="collection-value-rest"><span className="collection-value-dot" data-rank="rest" /><span>{text.rest}</span><bdi>{format(figures.total-figures.topValue)}</bdi><span>{((figures.total-figures.topValue)/figures.total*100).toFixed(1)}%</span></li>}</ul>
      </> : <p className="collection-empty">{priceLoading ? text.loading : text.concentrationEmpty}</p>}
      <p className="collection-note">{number(figures.priced)}/{number(figures.received)} {text.receivedPriced}</p>
    </Card>
    {!preview && (prices.failed || fx.failed || display?.failed) && <p className="collection-note" role="status">{text.pricesFailed} <button type="button" onClick={()=>{
      prices.retry();void fx.retry();
      if(display?.failed) { void client.invalidateQueries({queryKey:['reference-fx']}); void client.invalidateQueries({queryKey:['display-currency',account.owner]}); }
    }}>{text.retry}</button></p>}
    {choosing && <HighlightPicker key={owner} cards={available} initial={featured.ids} busy={featured.busy} unavailable={featured.loading || featured.error}
      text={text} onClose={()=>setChoosing(false)} onSave={async ids=>{await featured.save(ids);setChoosing(false);}} />}
  </article>;
}

function HoldingRow({holding,onOpen,subtitle,children}: {holding:Holding;onOpen:()=>void;subtitle:string;children:ReactNode}) {
  return <button type="button" className="collection-holding-row" onClick={onOpen}>
    <PokemonArt src={holding.card.imageUrl} alt={holding.card.name} />
    <span className="collection-holding-identity"><strong>{holding.card.name}</strong><span>{holding.card.setName} · #{holding.card.number}</span><small>{subtitle}</small></span>
    <span className="collection-holding-result">{children}</span><LuChevronRight aria-hidden className="rtl:rotate-180" />
  </button>;
}

function HighlightPicker({cards,initial,busy,unavailable,text,onClose,onSave}: {
  cards:readonly InventoryCatalogCard[];initial:readonly string[];busy:boolean;unavailable:boolean;text:typeof labels.en;onClose:()=>void;onSave:(ids:string[])=>Promise<void>;
}) {
  const [selected,setSelected]=useState(initial.filter(id=>cards.some(card=>card.id===id))),[search,setSearch]=useState(''),[failed,setFailed]=useState(false);
  const matches=cards.filter(card=>`${card.name} ${card.setName} ${card.number}`.toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()));
  return <UtilitySheet title={text.chooseTitle} contentMode="contained" onClose={()=>{if(!busy)onClose();}}>
    <div className="collection-picker-toolbar"><p>{text.chooseHint}</p><SearchInput label={text.search} placeholder={text.search} value={search} onChange={event=>setSearch(event.target.value)} />
      <div><span>{selected.length}/5</span><Button disabled={busy||unavailable} onClick={()=>{setFailed(false);void onSave(selected).catch(()=>setFailed(true));}}>{text.save}</Button></div>
      {failed&&<p role="alert">{text.saveFailed}</p>}
    </div>
    <div className="collection-picker-scroll"><ul className="collection-picker-grid">{matches.map(card=><li key={card.id}><button type="button" aria-pressed={selected.includes(card.id)}
      disabled={busy||unavailable||(!selected.includes(card.id)&&selected.length>=5)} onClick={()=>setSelected(ids=>ids.includes(card.id)?ids.filter(id=>id!==card.id):[...ids,card.id])}>
      <PokemonArt src={card.imageUrl} alt={card.name} /><strong>{card.name}</strong><small>{card.setName} · #{card.number}</small><span className="collection-picker-check" aria-hidden>{selected.includes(card.id)?<LuCheck/>:<LuHeart/>}</span>
    </button></li>)}</ul>{!matches.length&&<p className="collection-empty">{cards.length?text.noMatches:text.noCards}</p>}</div>
  </UtilitySheet>;
}
