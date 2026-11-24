import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { doc, getDocFromServer, setDoc, serverTimestamp } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { getFirebaseServices } from './firebase';

export function PurchaseWishlistSettings() {
  const { i18n } = useTranslation();
  const he = i18n.language === 'he';
  const owner = useAuth().user?.uid;
  const client = useQueryClient();
  const key = ['purchase-wishlist-preference', owner];
  const [saving,setSaving] = useState(false);
  const [failed,setFailed] = useState(false);
  const query = useQuery({
    queryKey:key, enabled:!!owner,
    queryFn:async()=>{
      const snapshot=await getDocFromServer(doc(getFirebaseServices()!.db,`users/${owner}/preferences/purchases`));
      if (!snapshot.exists()) return false;
      const value=snapshot.data().autoFulfillWishlist;
      if(typeof value !== 'boolean') throw Error('Invalid purchase preference');
      return value;
    },
    retry:1,
  });
  async function save(value:boolean) {
    const firebase=getFirebaseServices();
    if(!owner || firebase?.auth.currentUser?.uid!==owner) return;
    setSaving(true); setFailed(false);
    try {
      await setDoc(doc(firebase.db,`users/${owner}/preferences/purchases`),{autoFulfillWishlist:value,updatedAt:serverTimestamp()});
      client.setQueryData(key,value);
    } catch {setFailed(true);}
    finally {setSaving(false);}
  }
  if(!owner) return null;
  return <section className="space-y-1">
    <p className="text-xs font-medium text-slate-600">{he?'עסקאות':'Transactions'}</p>
    <label className="flex items-center justify-between gap-3 rounded-xl border surface-panel p-3">
      <span className="min-w-0">
        <span className="block text-sm font-bold">{he?'מימוש אוטומטי של רשימת המשאלות':'Auto-fulfill Wishlist'}</span>
        <span className="block text-xs text-slate-600">{he?'הסרת קלפים שנרכשו מרשימת המשאלות ומילוי הכיסים השמורים בבינדר.':'Remove purchased cards from your Wishlist and fill their reserved Binder pockets.'}</span>
      </span>
      <input type="checkbox" role="switch" aria-label={he?'מימוש אוטומטי של רשימת המשאלות':'Auto-fulfill Wishlist'} className="peer sr-only" checked={query.data===true} disabled={saving || query.isPending || query.isError} onChange={e=>void save(e.target.checked)} />
      <span aria-hidden className="relative h-6 w-11 shrink-0 rounded-full bg-slate-400 transition-colors peer-checked:bg-blue-600 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-disabled:opacity-50"><span className={`absolute top-1 size-4 rounded-full bg-white transition-all ${query.data===true?'end-1':'start-1'}`}/></span>
    </label>
    {(failed||query.isError)&&<p role="alert" className="text-xs text-red-700">{he?'לא ניתן לטעון או לשמור את ההגדרה.':'Could not load or save this setting.'}</p>}
  </section>;
}
