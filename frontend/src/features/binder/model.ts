import { z } from 'zod';
import { binderPocketSchema, type BinderPocket } from '@/domain/inventory';
import { idSchema, type CardCopy } from '@/domain/schema';

export const capacity = 1252;
export const binderSchema = z.strictObject({
  schemaVersion: z.literal(1), ownerUid: idSchema, revision: z.number().int().nonnegative().safe(),
  pockets: z.array(binderPocketSchema).max(capacity), includeWish: z.boolean(),
}).superRefine((b, ctx) => {
  const keys = b.pockets.map(pocketKey);
  if (new Set(keys).size !== keys.length) ctx.addIssue({code:'custom', message:'Duplicate binder pocket identity'});
});
export type Binder = z.infer<typeof binderSchema>;
export const emptyBinder = (ownerUid: string): Binder => ({schemaVersion:1,ownerUid,revision:0,pockets:[],includeWish:true});
export function pocketKey(p: BinderPocket) { return p.kind === 'copy' ? `copy:${p.copyId}` : p.kind === 'wish' ? `wish:${p.cardId}` : `empty:${p.token}`; }
export const pageCount = (pockets: readonly unknown[]) => Math.max(1, Math.ceil(pockets.length / 9));
const gap = (): BinderPocket => ({kind:'empty',token:crypto.randomUUID()});
const validateIndex = (pockets: readonly unknown[], index: number) => {
  if (!Number.isInteger(index) || index < 0 || index >= pageCount(pockets) * 9) throw Error('Invalid pocket');
};
export function placePocket(pockets: readonly BinderPocket[], pocket: BinderPocket, index: number): BinderPocket[] {
  validateIndex(pockets,index);
  const result = [...pockets];
  const from = result.findIndex(p => pocketKey(p) === pocketKey(pocket));
  if (from === index) return result;
  // Materialize trailing holes before moving, preserving the requested index.
  while (result.length <= index) result.push(gap());
  if (from >= 0) {
    if (result[index]!.kind === 'empty') [result[from],result[index]] = [result[index]!,result[from]!];
    else { const [moved] = result.splice(from,1); result.splice(index,0,moved!); }
  } else if (result[index]!.kind === 'empty') result[index] = pocket;
  else result.splice(index,0,pocket);
  if (result.length > capacity) throw Error('Binder is full');
  return result;
}
export function reservePocket(pockets: readonly BinderPocket[], index: number): BinderPocket[] {
  validateIndex(pockets,index);
  if (pockets[index]?.kind === 'empty') return [...pockets];
  const result = [...pockets];
  while (result.length < index) result.push(gap());
  result.splice(index,0,gap());
  if (result.length > capacity) throw Error('Binder is full');
  return result;
}
export function removePocket(pockets: readonly BinderPocket[], index: number) {
  if (!Number.isInteger(index) || index < 0 || index >= pockets.length) throw Error('Invalid pocket');
  return pockets.filter((_,i) => i !== index);
}
export function movePage(pockets: readonly BinderPocket[], from: number, to: number): BinderPocket[] {
  const count = pageCount(pockets);
  if (![from,to].every(i => Number.isInteger(i) && i >= 0 && i < count)) throw Error('Invalid page');
  if (from === to) return [...pockets];
  const pages = Array.from({length:count},(_,i) => pockets.slice(i*9,i*9+9));
  const [moved] = pages.splice(from,1); pages.splice(to,0,moved!);
  pages.slice(0,-1).forEach(page => { while (page.length < 9) page.push(gap()); });
  const result=pages.flat();
  if (result.length > capacity) throw Error('Binder is full');
  return result;
}
/** Insert a complete blank 3×3 page directly after the selected page.
 * Preserve every existing pocket in order, including trailing implicit gaps.
 * The final existing page is padded only when appending after it.
 */
export function insertEmptyPage(pockets: readonly BinderPocket[], after: number): BinderPocket[] {
  const count=pageCount(pockets);
  if (!Number.isInteger(after) || after<0 || after>=count) throw Error('Invalid page');
  const index=(after+1)*9;
  const result=[...pockets];
  if (Math.max(result.length,index)+9>capacity) throw Error('Binder is full');
  while (result.length<index) result.push(gap());
  result.splice(index,0,...Array.from({length:9},()=>gap()));
  return result;
}
export type PublicPocket = {cardId:string;kind:'owned'|'pending'|'wish'} | null;
const publicToken = /^(o|p|w):((?:(?:base[1-6]|basep|gym[12]|neo[1-4]|si1)-[1-9][0-9]{0,2}|movie2000-ancient-mew))$/;
export function projectBinder(binder: Binder, copies: readonly CardCopy[]): PublicPocket[] {
  const byId = new Map(copies.filter(c=>c.ownerUid===binder.ownerUid).map(c=>[c.id,c]));
  return binder.pockets.map(p => {
    if (p.kind === 'empty') return null;
    if (p.kind === 'wish') return binder.includeWish ? {cardId:p.cardId,kind:'wish'} : null;
    const c = byId.get(p.copyId);
    if (!c || c.disposition !== 'held' || c.catalog.kind !== 'identified' || c.possession === 'unknown') return null;
    return {cardId:c.catalog.cardId,kind:c.possession === 'received' ? 'owned' : 'pending'};
  });
}
export function encodePublic(pockets: readonly PublicPocket[]) {
  if (pockets.length > capacity) throw Error('Binder is full');
  const result=pockets.map(p => p ? `${({owned:'o',pending:'p',wish:'w'} as const)[p.kind]}:${p.cardId}` : '_').join(';');
  decodePublic(result); return result;
}
export function decodePublic(value: unknown): PublicPocket[] {
  if (typeof value !== 'string' || value.length > 40000) throw Error('Invalid shared binder');
  const tokens=value ? value.split(';') : [];
  if (tokens.length > capacity) throw Error('Invalid shared binder');
  return tokens.map(token => {
    if (token === '_') return null;
    const match=publicToken.exec(token);
    if (!match) throw Error('Invalid shared binder');
    return {cardId:match[2]!,kind:({o:'owned',p:'pending',w:'wish'} as const)[match[1] as 'o'|'p'|'w']};
  });
}
