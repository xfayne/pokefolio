import { afterEach, expect, it, vi } from 'vitest';
import { fetchMarketQuotes } from './market-prices';
import { catalogMarketReference, catalogCards, catalogReference } from './catalog';
afterEach(()=>vi.unstubAllGlobals());
it('matches exact card, English, edition, finish and condition without mixing printings',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({sets:[{id:630,name:'Fossil'}]})}).mockResolvedValueOnce({ok:true,json:async()=>({products:[{id:1,name:'Gengar (5)',number:'05/62'},{id:2,name:'Gengar (20)',number:'20/62'}]})}).mockResolvedValueOnce({ok:true,json:async()=>({updated:'2026-11-20T12:00:00Z',products:{1:{a:{lng:'EN',cnd:'LP',var:'Unlimited Holofoil',mkt:25.42},b:{lng:'EN',cnd:'LP',var:'1st Edition Holofoil',mkt:99},c:{lng:'JP',cnd:'NM',var:'Unlimited Holofoil',mkt:5}}}})});
 vi.stubGlobal('fetch',fetcher);
 const card=catalogCards.find(c=>c.id==='base3-5')!;
 const quotes=await fetchMarketQuotes(card,catalogMarketReference(card.id),new AbortController().signal);
 expect(quotes).toHaveLength(1);expect(quotes[0]).toMatchObject({condition:'LP',money:{currency:'USD',minor:2542}});
 expect(await fetchMarketQuotes(card,catalogReference(card.id),new AbortController().signal)).toEqual([]);
 expect(fetcher).toHaveBeenCalledTimes(3);
});
it('uses standard WoTC promo identity and its actual finish, excluding alternate editions',async()=>{
 const fetcher=vi.fn().mockResolvedValueOnce({ok:true,json:async()=>({sets:[{id:1418,name:'WoTC Promo'}]})}).mockResolvedValueOnce({ok:true,json:async()=>({products:[{id:87395,name:'Mew (9)',number:'09/53'},{id:999,name:'Mew',number:'09/53'}]})}).mockResolvedValueOnce({ok:true,json:async()=>({products:{87395:{a:{lng:'EN',cnd:'LP',var:'Holofoil',mkt:75}},999:{a:{lng:'EN',cnd:'LP',var:'Normal',mkt:1}}}})});
 vi.stubGlobal('fetch',fetcher);const card=catalogCards.find(c=>c.id==='basep-9')!;const ref=catalogMarketReference(card.id);
 expect(ref.kind==='identified' && ref.finish.status==='known' && ref.finish.value).toBe('holo');
 expect(await fetchMarketQuotes(card,ref,new AbortController().signal)).toMatchObject([{money:{minor:7500}}]);
 expect(catalogMarketReference('basep-34')).toMatchObject({finish:{value:'reverse'}});
});
