import {act,renderHook} from '@testing-library/react';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {MemoryRouter} from 'react-router';
import {expect,it,vi} from 'vitest';
import type {ReactNode} from 'react';
import {useDashboard} from './use-dashboard';

const state=vi.hoisted(()=>({error:null as Error|null}));
vi.mock('@/hooks/use-portfolio',()=>({usePortfolio:()=>({owner:'owner',records:[],loading:false,error:state.error})}));
vi.mock('@/features/transactions/demo-data',()=>({useDemoTransactionData:()=>({history:{ownerUid:'sample',transactions:[],copies:[],saleLines:[]}})}));
vi.mock('@/features/transactions/demo-context',()=>({useDemoPortfolio:()=>({saleCommands:[]})}));
vi.mock('@/services/portfolio-audit',()=>({usePortfolioAudit:()=>({isPending:false,isError:false,data:{audits:[],truncated:false}})}));
vi.mock('@/services/display-currency',()=>({useDisplayCurrency:()=>({currency:'USD'})}));
vi.mock('@/services/market-history',()=>({useMarketHistory:()=>({results:[],loading:false,failed:false,retry:async()=>[]}),selectMarketVariant:()=>null}));
vi.mock('@/services/historical-fx',()=>({useHistoricalFx:()=>({rows:[],loading:false,failed:false,retry:async()=>[]})}));

it('keeps an unreadable portfolio unavailable and retries the private owner records',async()=>{
 const client=new QueryClient(),invalidate=vi.spyOn(client,'invalidateQueries').mockResolvedValue(undefined);
 state.error=new Error('Portfolio read failed');
 const wrapper=({children}:{children:ReactNode})=><QueryClientProvider client={client}><MemoryRouter>{children}</MemoryRouter></QueryClientProvider>;
 const {result,rerender,unmount}=renderHook(()=>useDashboard('2026-11'),{wrapper});
 expect(result.current.error).toBe(state.error);
 expect(result.current.result).toBeNull();
 await act(()=>result.current.retry());
 expect(invalidate).toHaveBeenCalledWith({queryKey:['portfolio','owner']});
 state.error=null;
 rerender();
 expect(result.current.result?.value).toMatchObject({minor:0,total:0});
 unmount();client.clear();
});
