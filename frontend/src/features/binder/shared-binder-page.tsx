import { useState } from 'react';
import { useParams } from 'react-router';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getFirebaseServices } from '@/services/firebase';
import { catalogCards } from '@/features/catalog/catalog';
import { EmptyState, LoadingState } from '@/components/ui/surfaces';
import { Button } from '@/components/ui/button';
import { BinderBook } from './binder-book';
import { readSharedBinder } from './storage';
import './binder.css';
const cards=new Map(catalogCards.map(c=>[c.id,c]));
export function SharedBinderPage() {
  const {shareId}=useParams();const {t}=useTranslation();const [page,setPage]=useState(0);
  const query=useQuery({queryKey:['public-binder',shareId],queryFn:()=>{
    const services=getFirebaseServices();if(!services)throw Error('Connection unavailable');
    return readSharedBinder(services.db,shareId!);
  },retry:1,staleTime:0,gcTime:0,refetchOnWindowFocus:true});
  return <div className="binder-reader-page"><header><span className="pokeball size-7" aria-hidden /><h1>{t('binderUi.shared')}</h1></header><main>
    {query.isPending?<LoadingState label={t('loading')} />:query.error?<EmptyState title={t('failed')} description={t('binderUi.shareFailed')} action={<Button onClick={()=>{void query.refetch();}}>{t('reload')}</Button>} />:<BinderBook reader page={page} onPage={setPage} pockets={query.data.map((p,i)=>({key:String(i),card:p?cards.get(p.cardId)??null:null,kind:p?.kind??'empty'}))} />}
  </main></div>;
}
