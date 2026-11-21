import { beforeEach, expect, it, vi } from 'vitest';
import type { Shipment } from '@/domain/schema';
const mocks=vi.hoisted(()=>({post:vi.fn()}));
vi.mock('./api',()=>({createApiClient:()=>({post:mocks.post})}));
vi.mock('./environment',()=>({getEnvironment:()=>({workerUrl:'https://pokefolio-api-staging.xfayne.workers.dev'})}));
import { providerCarrier, registerAndTrack } from './shipment-tracking';
const parcel=(id:string):Shipment=>({schemaVersion:1,id,ownerUid:'owner',revision:1,createdAt:'2026-11-21T00:00:00Z',updatedAt:'2026-11-21T00:00:00Z',trackingNumber:`TEST-${id}`,carrier:'Royal Mail',deliveredOn:{status:'unknown',reason:'Pending'},notes:''});
beforeEach(()=>{ mocks.post.mockReset(); });
it('registers before tracking, accepts already-registered references, and lets the provider detect a named carrier',async()=>{
  mocks.post.mockResolvedValueOnce({data:{shipments:[{number:'TEST-ONE',registered:true,error:{code:-18019901,message:'Already registered'}}]}})
    .mockResolvedValueOnce({data:{shipments:[{number:'TEST-ONE',carrier:11051,status:'Delivered',events:[]}]}});
  const result=await registerAndTrack('owner',[parcel('one')]);
  expect(mocks.post.mock.calls[0]).toEqual(['/api/shipments/register',{number:'TEST-ONE',carrier:undefined}]);
  expect(result[0]?.status).toBe('Delivered');
  expect(providerCarrier({...parcel('one'),carrier:'11051'})).toBe(11051);
});
it('uses cached registration and bounds provider batches to twelve tracking numbers',async()=>{
  const parcels=Array.from({length:13},(_,i)=>({...parcel(String(i)),tracking:{registered:true,carrier:null,status:'NotFound',events:[],seenEventIds:[],initialized:false}}));
  mocks.post.mockImplementation(async(_route:string,body:{shipments:{number:string}[]})=>({data:{shipments:body.shipments.map(s=>({...s,status:'InTransit',events:[]}))}}));
  expect(await registerAndTrack('owner',parcels)).toHaveLength(13);
  expect(mocks.post.mock.calls.map(c=>c[1].shipments.length)).toEqual([12,1]);
});
it('reports individual registration failures without inventing progress',async()=>{
  mocks.post.mockResolvedValue({data:{shipments:[{number:'TEST-ONE',error:{code:1,message:'Quota exceeded'}}]}});
  expect(await registerAndTrack('owner',[parcel('one')])).toEqual([{number:'TEST-ONE',error:{code:1,message:'Quota exceeded'}}]);
  expect(mocks.post).toHaveBeenCalledTimes(1);
});
