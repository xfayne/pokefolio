import { useState, type ReactNode } from 'react';
import { TransactionHeaderContext } from './transaction-header-context';
export function TransactionFormTestFrame({ children }: { children: ReactNode }) {
  const [actions,setActions] = useState<HTMLDivElement | null>(null);
  const [tabs,setTabs] = useState<HTMLDivElement | null>(null);
  return <><header><div ref={setActions}/><div ref={setTabs}/></header><TransactionHeaderContext value={{actions,tabs}}>{children}</TransactionHeaderContext></>;
}
