import {it,expect,vi} from 'vitest';
import {render,screen} from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import {BinderPicker,eligibleBinderCopies,eligibleBinderWishes} from './binder-picker';
import {emptyBinder} from './model';
import {createSampleCopies,sampleOwner} from '@/features/inventory/sample';
import '@/lib/i18n';
it('excludes placed, sold and foreign copies while allowing pending receipt',()=>{
 const copies=createSampleCopies();
 const binder={...emptyBinder(sampleOwner),pockets:[{kind:'copy' as const,copyId:'charizard-a'}]};
 expect(eligibleBinderCopies(binder,[...copies,{...copies[0]!,id:'sold',disposition:'sold'},{...copies[0]!,id:'foreign',ownerUid:'other'}]).map(c=>c.id)).toEqual(['charizard-b','gengar-a','gengar-pending','snorlax-a']);
});
it('automatically selects the only eligible copy from the existing catalog',async()=>{
 const pick=vi.fn();render(<BinderPicker binder={emptyBinder(sampleOwner)} copies={createSampleCopies()} busy={false} failed={false} onClose={()=>{}} onPick={pick} />);
 await userEvent.type(screen.getByRole('searchbox'),'Snorlax');
 await userEvent.click(screen.getByRole('button',{name:/Snorlax/}));
 expect(pick).toHaveBeenCalledWith(expect.objectContaining({id:'snorlax-a'}));
});
it('requires a physical copy choice when the catalog card has duplicates',async()=>{
 const pick=vi.fn();render(<BinderPicker binder={emptyBinder(sampleOwner)} copies={createSampleCopies()} busy={false} failed={false} onClose={()=>{}} onPick={pick} />);
 await userEvent.type(screen.getByRole('searchbox'),'Charizard');
 await userEvent.click(screen.getByRole('button',{name:/Charizard/}));
 expect(pick).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:/Copy 2.*LP/}));
 expect(pick).toHaveBeenCalledWith(expect.objectContaining({id:'charizard-b'}));
});

it('offers Wishlist-only entries without creating a physical copy',async()=>{
 const pick=vi.fn();const pickWish=vi.fn();
 render(<BinderPicker binder={emptyBinder(sampleOwner)} copies={[]} wishCardIds={['neo2-13']} busy={false} failed={false} onClose={()=>{}} onPick={pick} onPickWish={pickWish} />);
 await userEvent.type(screen.getByRole('searchbox'),'Umbreon');
 await userEvent.click(screen.getByRole('button',{name:/Umbreon/}));
 expect(pickWish).toHaveBeenCalledWith('neo2-13');
 expect(pick).not.toHaveBeenCalled();
});
it('excludes already placed Wishlist reservations and invalid catalog IDs',()=>{
 const binder={...emptyBinder(sampleOwner),pockets:[{kind:'wish' as const,cardId:'neo2-13'}]};
 expect(eligibleBinderWishes(binder,['neo2-13','basep-9','basep-9','unknown-card'])).toEqual(['basep-9']);
});
it('asks whether to place a copy or a Wishlist reservation when both are available',async()=>{
 const pick=vi.fn();const pickWish=vi.fn();
 render(<BinderPicker binder={emptyBinder(sampleOwner)} copies={createSampleCopies()} wishCardIds={['base1-4']} busy={false} failed={false} onClose={()=>{}} onPick={pick} onPickWish={pickWish} />);
 await userEvent.type(screen.getByRole('searchbox'),'Charizard');
 await userEvent.click(screen.getByRole('button',{name:/Charizard/}));
 expect(pick).not.toHaveBeenCalled();expect(pickWish).not.toHaveBeenCalled();
 await userEvent.click(screen.getByRole('button',{name:'Wishlist pocket'}));
 expect(pickWish).toHaveBeenCalledWith('base1-4');expect(pick).not.toHaveBeenCalled();
});

it('keeps the one-copy fast path when that catalog card is on the Wishlist',async()=>{
 const pick=vi.fn();const pickWish=vi.fn();
 render(<BinderPicker binder={emptyBinder(sampleOwner)} copies={createSampleCopies()} wishCardIds={['base2-11']} busy={false} failed={false} onClose={()=>{}} onPick={pick} onPickWish={pickWish} />);
 await userEvent.type(screen.getByRole('searchbox'),'Snorlax');
 await userEvent.click(screen.getByRole('button',{name:/Snorlax/}));
 expect(pick).toHaveBeenCalledWith(expect.objectContaining({id:'snorlax-a'}));
 expect(pickWish).not.toHaveBeenCalled();
});
