import {beforeEach,expect,it,vi} from 'vitest';
import {fixtureListing,fixtureResult} from './analysis-fixture.test-support';
const state=vi.hoisted(()=>({uid:'owner',post:vi.fn(),get:vi.fn(),set:vi.fn()}));
vi.mock('@/services/firebase',()=>({getFirebaseServices:()=>({auth:{currentUser:{uid:state.uid}},db:{}}),getIdToken:async()=>'token'}));
vi.mock('@/services/environment',()=>({getEnvironment:()=>({workerUrl:'staging'})}));
vi.mock('@/services/api',()=>({createApiClient:(_url:string,token:()=>Promise<string|null>)=>({post:async(...args:unknown[])=>{await token();return state.post(...args);}})}));
vi.mock('firebase/firestore',()=>({doc:(_db:unknown,...path:string[])=>path.join('/'),getDocFromServer:state.get,setDoc:state.set,serverTimestamp:()=>'<timestamp>'}));
import {analysisKey,analysisSchema,readAnalysis,runAnalysis,saveAnalysis,resolveListing} from './analysis-service';
beforeEach(()=>{vi.clearAllMocks();state.uid='owner';state.post.mockResolvedValue({data:fixtureResult});state.get.mockResolvedValue({exists:()=>false});});
it('retains the exact owner cache path, stores evidence only and refuses foreign owners',async()=>{
 expect(analysisKey(fixtureListing.source)).toBe('ebay-listing__EBAY_GB__v1_123456789012_0');
 await saveAnalysis('owner',fixtureListing.source,fixtureResult);
 expect(state.set).toHaveBeenCalledWith('users/owner/conditionAnalyses/ebay-listing__EBAY_GB__v1_123456789012_0',expect.objectContaining({photoIndices:[1,2],imageCount:2,analysis:fixtureResult.analysis}));
 expect(JSON.stringify(state.set.mock.calls)).not.toContain('i.ebayimg.com');
 await expect(readAnalysis('other',fixtureListing.source)).rejects.toThrow('AI_AUTH_REQUIRED');
 await expect(runAnalysis('other',[],new AbortController().signal)).rejects.toThrow('AI_AUTH_REQUIRED');
 expect(state.post).not.toHaveBeenCalled();
});
it('rejects invalid locations/distributions and image URLs; preserves missing precision',async()=>{
 expect(analysisSchema.parse(fixtureResult.analysis).observations[1]?.locations).toEqual([]);
 expect(analysisSchema.safeParse({...fixtureResult.analysis,confidencePercent:99}).success).toBe(false);
 expect(analysisSchema.safeParse({...fixtureResult.analysis,observations:[{...fixtureResult.analysis.observations[0],locations:[{photoIndex:1,box2d:[500,0,100,1000]}]}]}).success).toBe(false);
 state.post.mockResolvedValue({data:{...fixtureListing,images:['https://untrusted.example/photo.jpg']}});
 await expect(resolveListing('owner',fixtureListing.url,new AbortController().signal)).rejects.toThrow();
});
it('uses multipart without JSON headers, rejects evidence for unanalyzed photos, guards changed sessions',async()=>{
 await runAnalysis('owner',[new Blob(['image'])],new AbortController().signal);
 expect(state.post.mock.calls[0]?.[0]).toBe('/api/analyze-upload');expect(state.post.mock.calls[0]?.[1]).toBeInstanceOf(FormData);
 state.post.mockResolvedValue({data:{...fixtureResult,analyzedPhotoIndices:[1]}});
 await expect(runAnalysis('owner',fixtureListing.source,new AbortController().signal)).rejects.toThrow();
 state.post.mockImplementation(async()=>{state.uid='different';return {data:fixtureResult};});
 await expect(runAnalysis('owner',fixtureListing.source,new AbortController().signal)).rejects.toThrow('AI_AUTH_REQUIRED');
});

it('uses the selection-specific endpoint and rejects mismatched evidence',async()=>{
 const signal=new AbortController().signal;const images=[fixtureListing.images[1]!];
 await expect(runAnalysis('owner',fixtureListing.source,signal,images)).rejects.toThrow('AI_INVALID_PHOTOS');
 expect(state.post).toHaveBeenCalledWith('/api/analyze-selected-condition',{source:fixtureListing.source,images},{signal,timeout:120_000});
 state.post.mockResolvedValue({data:{...fixtureResult,imageCount:1,analyzedPhotoIndices:[1],analysis:{...fixtureResult.analysis,observations:[]}}});
 await expect(runAnalysis('owner',fixtureListing.source,signal,images)).resolves.toMatchObject({imageCount:1,analyzedPhotoIndices:[1]});
});
