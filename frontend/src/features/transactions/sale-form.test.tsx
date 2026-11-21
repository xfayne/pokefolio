import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { expect, it, vi } from 'vitest';
import '@/lib/i18n';
import { SaleForm } from './new-sale-page';
import { newSaleDraft, type SaleDraft } from '@/domain/sale';
import { copy } from '@/domain/fixtures.test-support';
function Harness({save}: {save:()=>Promise<void>}) {
  const [draft,setDraft]=useState<SaleDraft>({...newSaleDraft(),date:'2026-11-21',buyer:'Test buyer',currency:'GBP',cards:[{copyId:copy.id,amount:'30'}],buyerShipping:'3',sellingFees:'2',sellerShipping:'4'});
  return <SaleForm draft={draft} copies={[copy]} owner="owner" editing={false} onChange={setDraft} onPick={vi.fn()} onPurchase={vi.fn()} onSave={save} />;
}
it('validates before saving, blocks duplicate submits, and retains failed sale drafts',async()=>{
  let reject: (reason:Error)=>void=()=>{};
  const save=vi.fn(()=>new Promise<void>((_,no)=>{reject=no;}));
  render(<Harness save={save} />);
  expect(screen.getByText('£27.00',{exact:true})).toBeVisible();
  await userEvent.clear(screen.getByLabelText('Sale price 1'));
  await userEvent.click(screen.getByRole('button',{name:'Save sale'}));
  expect(save).not.toHaveBeenCalled();
  await userEvent.type(screen.getByLabelText('Sale price 1'),'30');
  const form=screen.getByRole('form',{name:'New sale'});
  fireEvent.submit(form);fireEvent.submit(form);
  expect(save).toHaveBeenCalledOnce();
  reject(Error('Stale'));
  await waitFor(()=>expect(screen.getByRole('alert')).toHaveTextContent('Your draft is kept'));
  expect(screen.getByLabelText('Sale price 1')).toHaveValue('30');
});
it('clears currency amounts with undo and leaves copy identity intact',async()=>{
  render(<Harness save={vi.fn()} />);
  await userEvent.selectOptions(screen.getByLabelText('Currency'),'USD');
  expect(screen.getByLabelText('Sale price 1')).toHaveValue('');
  await userEvent.click(screen.getByRole('button',{name:'Undo'}));
  expect(screen.getByLabelText('Currency')).toHaveValue('GBP');
  expect(screen.getByLabelText('Sale price 1')).toHaveValue('30');
});
