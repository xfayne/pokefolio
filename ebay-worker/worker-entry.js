import { DurableObject } from 'cloudflare:workers';
import { PriceService } from './price-service.js';
export { default } from './index.js';

export class PriceCoordinator extends DurableObject {
 constructor(ctx,env) {
  super(ctx,env);
  this.service=new PriceService(ctx.storage,env.MARKET_CACHE,env.JUSTTCG_API_KEY);
 }
 async load(input) {
  // Schedule before writes so interrupted requests cannot leave a permanent mirror.
  if(await this.ctx.storage.getAlarm()===null)await this.ctx.storage.setAlarm(Date.now()+7*86400_000);
  return this.service.load(input);
 }
 async alarm() {
  const next=await this.service.prune();
  if(next!==null)await this.ctx.storage.setAlarm(Math.max(Date.now()+60_000,next));
 }
}
