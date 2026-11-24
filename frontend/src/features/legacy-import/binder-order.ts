import type { BinderPocket } from '@/domain/inventory';
import { capacity } from '@/features/binder/model';

/** Legacy imported data is right-to-left within each physical row.
 * Normalize once at the import boundary, not in the renderer or on reload.
 * Already-normalized Pokefolio-to-Pokefolio transfers must NOT call this.
 */
export function normalizeImportedBinderOrder(source:readonly BinderPocket[]):BinderPocket[] {
  const result:BinderPocket[]=[];
  const tokens=new Set(source.flatMap(p=>p.kind==='empty'?[p.token]:[]));
  for(let start=0;start<source.length;start+=3) {
    for(let offset=0;offset<3;offset++) {
      const pocket=source[start+2-offset];
      if(pocket) result.push(pocket);
      else {
        let token=`import-row-gap:${start+offset}`;
        while(tokens.has(token)) token+=':gap';
        tokens.add(token);
        result.push({kind:'empty',token});
      }
    }
  }
  if(result.length>capacity)throw Error('BINDER_NORMALIZED_CAPACITY_EXCEEDED');
  return result;
}
