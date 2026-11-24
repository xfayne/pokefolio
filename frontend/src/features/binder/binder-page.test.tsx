import {it,expect,vi} from 'vitest';
import {render,screen,within,fireEvent} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {MemoryRouter} from 'react-router';
import {QueryClient,QueryClientProvider} from '@tanstack/react-query';
import {BinderPage} from './binder-page';
import '@/lib/i18n';
vi.mock('@/hooks/use-portfolio',()=>({usePortfolio:()=>({history:{copies:[]},loading:false,error:null})}));
it('moves a selected partial page and keeps layout settings controlled through async confirmation',async()=>{
  const user=userEvent.setup();
  render(<QueryClientProvider client={new QueryClient({defaultOptions:{queries:{retry:false}}})}><MemoryRouter initialEntries={['/collection/binder?inventory=sample']}><BinderPage /></MemoryRouter></QueryClientProvider>);
  await user.click(await screen.findByRole('button',{name:'Binder options'}));
  await user.click(screen.getByRole('button',{name:'Move page'}));
  await user.selectOptions(screen.getByLabelText('From page',{exact:true}),'3');
  expect(screen.getByLabelText('From page',{exact:true})).toHaveValue('3');
  await user.selectOptions(screen.getByLabelText('To page',{exact:true}),'1');
  await user.click(screen.getByRole('button',{name:'Apply'}));
  const first=await screen.findByRole('group',{name:'Page 1 of 3'});
  expect(first.querySelectorAll('[data-kind="empty"]')).toHaveLength(8);
  await user.click(screen.getByRole('button',{name:'Binder options'}));
  const dialog=screen.getByRole('dialog');
  const checkbox=within(dialog).getByRole('checkbox',{name:'Show Wishlist cards'});
  await user.click(checkbox);
  expect(checkbox).not.toBeChecked();
});

import { BinderBook } from './binder-book';
import { visualPockets } from './visual-pockets';
import { emptyBinder, unplacePocket } from './model';
import { createSampleCopies, sampleOwner } from '@/features/inventory/sample';

it('marks removed wishes and missing copies unavailable without changing their slots, and restores wish status when re-added',()=>{
  const copies=createSampleCopies();
  const binder={...emptyBinder(sampleOwner),pockets:[
    {kind:'copy' as const,copyId:'missing'},
    {kind:'wish' as const,cardId:'neo2-13'},
    {kind:'copy' as const,copyId:copies[0]!.id},
  ]};
  const before=structuredClone(binder);
  expect(visualPockets(binder,copies,[]).map(p=>p.kind)).toEqual(['unavailable','unavailable','owned']);
  expect(visualPockets(binder,copies,[])[1]).toMatchObject({wishUnavailable:true,card:{id:'neo2-13'}});
  expect(visualPockets(binder,copies,null)[1]?.kind).toBe('wish');
  expect(visualPockets(binder,copies,['neo2-13'])[1]?.kind).toBe('wish');
  expect(binder).toEqual(before);
});

it('allows dragging both unavailable pocket kinds outside, retaining the other positions',()=>{
  const binder={...emptyBinder(sampleOwner),pockets:[
    {kind:'copy' as const,copyId:'missing'},
    {kind:'wish' as const,cardId:'neo2-13'},
    {kind:'empty' as const,token:'untouched'},
  ]};
  const onMove=vi.fn(),onRemove=vi.fn();
  const {container}=render(<BinderBook pockets={visualPockets(binder,[],[])} page={0} onPage={()=>{}} onMove={onMove} onRemove={onRemove} />);
  const book=container.querySelector<HTMLElement>('.binder-book')!;
  Object.defineProperty(book,'setPointerCapture',{value:vi.fn(),configurable:true});
  const descriptor=Object.getOwnPropertyDescriptor(document,'elementFromPoint');
  Object.defineProperty(document,'elementFromPoint',{value:()=>null,configurable:true});
  try {
    const pointer=(target:Element,type:string,x:number,y:number)=>{
      const e=new MouseEvent(type,{bubbles:true,clientX:x,clientY:y,button:0});
      Object.defineProperties(e,{pointerId:{value:1},pointerType:{value:'touch'}});
      fireEvent(target,e);
    };
    for(const index of [0,1]){
      const slot=container.querySelector(`[data-pocket-index="${index}"]`)!;
      pointer(slot,'pointerdown',20,20);
      pointer(book,'pointermove',-20,-20);
      expect(screen.getByText('Release to remove')).toBeVisible();
      pointer(book,'pointerup',-20,-20);
    }
    expect(onRemove.mock.calls).toEqual([[0],[1]]);
    expect(onMove).not.toHaveBeenCalled();
    const removed=unplacePocket(unplacePocket(binder.pockets,0),1);
    expect(removed.map(p=>p.kind)).toEqual(['empty','empty','empty']);
    expect(removed[2]).toEqual(binder.pockets[2]);
  } finally {
    if(descriptor)Object.defineProperty(document,'elementFromPoint',descriptor);
    else Reflect.deleteProperty(document,'elementFromPoint');
  }
});
