import {useState,useRef} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {useSearchParams} from 'react-router';
import {Button} from '@/components/ui/button';
import {usePortfolio} from '@/hooks/use-portfolio';
import {getFirebaseServices} from '@/services/firebase';
import {getEnvironment} from '@/services/environment';
import {readPortfolio,commitPortfolio} from '@/services/portfolio';
import {stagingYearPlan} from './year-plan';

export function StagingYearLoader(){
 const [params]=useSearchParams(),account=usePortfolio(),client=useQueryClient();
 const [busy,setBusy]=useState(false),[status,setStatus]=useState('');
 const pending=useRef<ReturnType<typeof stagingYearPlan>|null>(null);
 if(params.get('stagingTools')!=='year'||getEnvironment()?.firebase.projectId!=='pokefolio-staging')return null;
 const load=async()=>{
  setBusy(true);setStatus('Preparing transactions…');
  try{
   const services=getFirebaseServices(),owner=account.owner;
   if(!services||services.db.app.options.projectId!=='pokefolio-staging'||!owner||services.auth.currentUser?.uid!==owner)throw Error('Sign in to the staging account first.');
   if(!pending.current){
    const before=await readPortfolio(services.db,owner);
    pending.current=stagingYearPlan(owner,new Date().toISOString().slice(0,10),before);
   }
   const plan=pending.current;
   if(plan.commands.some(c=>c.ownerUid!==owner))throw Error('Account changed; loading stopped.');
   for(const [i,command] of plan.commands.entries()){
    if(services.auth.currentUser?.uid!==owner)throw Error('Account changed; loading stopped.');
    await commitPortfolio(services.db,owner,command);
    setStatus(`Saved ${i+1}/${plan.commands.length} operations`);
   }
   await client.invalidateQueries({queryKey:['portfolio',owner]});
   setStatus(`Added ${plan.purchases} purchases, ${plan.copies} copies and ${plan.sales} sales, including one reversed sale.`);
  }catch(error){setStatus(error instanceof Error?error.message:'Could not add transactions.');}
  finally{setBusy(false);}
 };
 return <section className="space-y-2"><p className="text-sm">Add a year of transactions to this Staging account using the regular purchase, receipt and sale commands.</p><Button disabled={busy||!account.owner||account.loading} onClick={()=>{void load();}}>Load year of transactions</Button><p role="status" className="text-sm">{status}</p></section>;
}
