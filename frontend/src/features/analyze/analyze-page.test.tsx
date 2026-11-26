import {act,fireEvent,render,screen,waitFor} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {beforeEach,expect,it,vi} from 'vitest';
import '@/lib/i18n';
import i18n from '@/lib/i18n';
import {AnalyzePage} from './analyze-page';
import {fixtureListing,fixtureResult} from './analysis-fixture.test-support';
import {readAnalysis,resolveListing,runAnalysis,saveAnalysis} from './analysis-service';
const auth=vi.hoisted(()=>({user:{uid:'owner'} as {uid:string}|null}));
vi.mock('@/hooks/use-auth',()=>({useAuth:()=>auth}));
vi.mock('./analysis-service',async importOriginal=>({...await importOriginal<typeof import('./analysis-service')>(),readAnalysis:vi.fn(),resolveListing:vi.fn(),runAnalysis:vi.fn(),saveAnalysis:vi.fn()}));
vi.mock('./prepare-photo',()=>({preparePhoto:vi.fn(async()=>new Blob(['image'],{type:'image/jpeg'}))}));
beforeEach(()=>{vi.clearAllMocks();auth.user={uid:'owner'};void i18n.changeLanguage('en');vi.mocked(resolveListing).mockResolvedValue(fixtureListing);vi.mocked(readAnalysis).mockResolvedValue(null);vi.mocked(runAnalysis).mockResolvedValue(fixtureResult);vi.mocked(saveAnalysis).mockResolvedValue(undefined);URL.createObjectURL=vi.fn(()=>`blob:${Math.random()}`);URL.revokeObjectURL=vi.fn();});
async function load(){const user=userEvent.setup();await user.click(screen.getByRole('button',{name:'eBay'}));await user.type(screen.getByRole('textbox',{name:'eBay listing URL'}),fixtureListing.url);await user.click(screen.getByRole('button',{name:'Load photos'}));await screen.findByRole('button',{name:'Inspect photo 1'});return user;}
it('loads listing photos without analyzing; renders one result and links numbered evidence',async()=>{
 render(<AnalyzePage/>);const user=await load();expect(runAnalysis).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByRole('heading',{name:'Analysis complete'});
 expect(saveAnalysis).toHaveBeenCalledWith('owner',fixtureListing.source,fixtureResult);
 expect(document.querySelector('.pokedex-frame')).toHaveAttribute('data-grade','LP');
 const wear=screen.getByRole('heading',{name:'Detected wear'});
 expect(wear.compareDocumentPosition(document.querySelector('.analyzer-gallery')!) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
 expect(screen.queryByText('Photo-based estimate')).not.toBeInTheDocument();
 expect(screen.queryByText(/Confidence:/)).not.toBeInTheDocument();
 expect(screen.queryByText(/Analyzed .* of .* photos/)).not.toBeInTheDocument();
 expect(screen.queryByText(/An estimate from visible photo evidence/)).not.toBeInTheDocument();
 expect(screen.queryByText('Front')).not.toBeInTheDocument();expect(screen.queryByText('Back')).not.toBeInTheDocument();
 await user.click(screen.getByRole('button',{name:/1 Minor edge whitening/}));
 expect(screen.getByRole('dialog')).toBeVisible();expect(screen.getByRole('heading',{name:'Photo 2'})).toBeVisible();
 expect(document.querySelector('.analysis-photo-large .is-highlighted rect')).toHaveAttribute('x','200');
 expect(screen.getByRole('button',{name:/2 Possible scratch/})).toBeDisabled();
});
it('uses an owner cached result without another AI request and retries saving without analysis',async()=>{
 vi.mocked(readAnalysis).mockResolvedValue(fixtureResult);render(<AnalyzePage/>);const user=await load();await user.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByText('Saved result · no new AI request');expect(runAnalysis).not.toHaveBeenCalled();
 vi.mocked(saveAnalysis).mockRejectedValueOnce(Error('offline'));
 await user.click(screen.getByRole('button',{name:'Analyze again · new AI request'}));await screen.findByText('The result is ready, but could not be saved.');expect(runAnalysis).toHaveBeenCalledTimes(1);
 await user.click(screen.getByRole('button',{name:'Retry saving'}));await waitFor(()=>expect(screen.queryByText('The result is ready, but could not be saved.')).not.toBeInTheDocument());expect(runAnalysis).toHaveBeenCalledTimes(1);
});
it('requires an explicit new request if the cache fails; clears private state on owner change',async()=>{
 vi.mocked(readAnalysis).mockRejectedValue(Error('offline'));const view=render(<AnalyzePage/>);const user=await load();await user.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByRole('alert');expect(runAnalysis).not.toHaveBeenCalled();
 await user.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByRole('heading',{name:'Analysis complete'});
 auth.user={uid:'different-owner'};view.rerender(<AnalyzePage/>);expect(screen.queryByText('Minor edge whitening')).not.toBeInTheDocument();expect(screen.queryByRole('button',{name:'Inspect photo 1'})).not.toBeInTheDocument();
});
it('discards a late analysis after leaving and aborts transport',async()=>{
 let resolve!:(v:typeof fixtureResult)=>void;vi.mocked(runAnalysis).mockImplementation(()=>new Promise(r=>{resolve=r;}));
 const view=render(<AnalyzePage/>);const user=await load();await user.click(screen.getByRole('button',{name:'Analyze card'}));
 const signal=vi.mocked(runAnalysis).mock.calls[0]![2];expect(document.querySelector('.pokedex-frame')).toHaveAttribute('data-status','busy');view.unmount();expect(signal.aborted).toBe(true);
 await act(async()=>resolve(fixtureResult));expect(saveAnalysis).not.toHaveBeenCalled();
});
it('uploads only on manual analysis, revokes object URLs and blocks signed-out requests',async()=>{
 const view=render(<AnalyzePage/>);const input=document.querySelector('input[type=file]')!;
 fireEvent.change(input,{target:{files:[new File(['test'],'front.jpg',{type:'image/jpeg'})]}});
 await screen.findByRole('button',{name:'Inspect photo 1'});expect(runAnalysis).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByRole('heading',{name:'Analysis complete'});expect(saveAnalysis).not.toHaveBeenCalled();
 view.unmount();expect(URL.revokeObjectURL).toHaveBeenCalled();auth.user=null;render(<AnalyzePage/>);expect(screen.getByRole('button',{name:'Analyze card'})).toBeDisabled();
});

it('keeps the breakdown open, sorts original probabilities and includes exactly 5 percent',async()=>{
 const result={...fixtureResult,analyzedPhotoIndices:[2],analysis:{...fixtureResult.analysis,confidencePercent:60,gradePercentages:{NM:5,LP:60,MP:31,HP:4,DMG:0}}};
 vi.mocked(readAnalysis).mockResolvedValue(result);render(<AnalyzePage/>);const user=await load();await user.click(screen.getByRole('button',{name:'Analyze card'}));
 const title=await screen.findByRole('heading',{name:'Grade breakdown'});
 expect(title).toHaveClass('analyzer-pixel','analyzer-subtitle');
 expect(screen.queryByRole('button',{name:'Grade breakdown'})).not.toBeInTheDocument();
 expect(screen.getByText('Glare obscures some detail.')).toBeVisible();
 const meters=screen.getAllByRole('meter');expect(meters.map(m=>m.getAttribute('aria-label'))).toEqual(['Lightly Played','Moderately Played','Near Mint']);
 expect(meters.map(m=>m.getAttribute('aria-valuenow'))).toEqual(['60','31','5']);
 expect(screen.queryByText(/Analyzed .* of .* photos/)).not.toBeInTheDocument();
 expect(runAnalysis).not.toHaveBeenCalled();
});

it('prefills eBay mode from a deal without loading photos or starting AI',async()=>{
 render(<AnalyzePage initialListingUrl={fixtureListing.url}/>);
 expect(screen.getByRole('button',{name:'eBay'})).toHaveAttribute('aria-pressed','true');
 expect(screen.getByRole('textbox',{name:'eBay listing URL'})).toHaveValue(fixtureListing.url);
 expect(resolveListing).not.toHaveBeenCalled();
 expect(runAnalysis).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Load photos'}));
 await screen.findByRole('button',{name:'Inspect photo 1'});
 expect(resolveListing).toHaveBeenCalledWith('owner',fixtureListing.url,expect.any(AbortSignal));
 expect(runAnalysis).not.toHaveBeenCalled();
});

it('removes listing photos, analyzes only retained images and leaves the full-listing cache untouched',async()=>{
 const selectedResult={...fixtureResult,imageCount:1,analyzedPhotoIndices:[1],analysis:{...fixtureResult.analysis,observations:[{...fixtureResult.analysis.observations[0]!,locations:[{photoIndex:1,box2d:[100,200,300,400] as [number,number,number,number]}]}]}};
 vi.mocked(readAnalysis).mockResolvedValue(fixtureResult);vi.mocked(runAnalysis).mockResolvedValue(selectedResult);
 render(<AnalyzePage/>);const user=await load();
 await user.click(screen.getByRole('button',{name:'Remove photo 1'}));
 expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
 expect(screen.queryByRole('button',{name:'Inspect photo 2'})).not.toBeInTheDocument();
 expect(screen.getByRole('img',{name:'Photo 1'})).toHaveAttribute('src',fixtureListing.images[1]);
 await user.click(screen.getByRole('button',{name:'Analyze card'}));await screen.findByRole('heading',{name:'Analysis complete'});
 expect(readAnalysis).not.toHaveBeenCalled();expect(saveAnalysis).not.toHaveBeenCalled();
 expect(runAnalysis).toHaveBeenCalledWith('owner',fixtureListing.source,expect.any(AbortSignal),[fixtureListing.images[1]]);
 await user.click(screen.getByRole('button',{name:/1 Minor edge whitening/}));expect(screen.getByRole('heading',{name:'Photo 1'})).toBeVisible();
});
it('disables analysis after removing every listing photo',async()=>{
 render(<AnalyzePage/>);const user=await load();await user.click(screen.getByRole('button',{name:'Remove photo 1'}));await user.click(screen.getByRole('button',{name:'Remove photo 1'}));
 expect(screen.getByRole('button',{name:'Analyze card'})).toBeDisabled();expect(runAnalysis).not.toHaveBeenCalled();
});
