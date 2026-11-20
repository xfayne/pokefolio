import { expect, it } from 'vitest';
import { catalogCards, catalogReference, searchCatalog } from './catalog';
import { catalogRefSchema } from '@/domain/schema';
it('preserves secret numbers and unique identities including Ancient Mew', () => {
 expect(new Set(catalogCards.map(c => c.id)).size).toBe(catalogCards.length);
 expect(searchCatalog('shining gyarados')[0]).toMatchObject({ id: 'neo3-65', number: '65/64' });
 expect(searchCatalog('ancient mew')[0]?.imageUrl).toContain('assets/ancient-mew.jpg');
 expect(catalogCards.length).toBeGreaterThan(1200);
 expect(catalogRefSchema.parse(catalogReference('neo3-65')).kind).toBe('identified');
});
it('combines search terms and set filters without changing the catalog', () => {
 expect(searchCatalog('gengar', 'Fossil').map(c => c.id)).toEqual(['base3-5','base3-20']);
 expect(searchCatalog('gengar #5/62')).toHaveLength(1);
 expect(searchCatalog('nonexistent')).toHaveLength(0);
});
