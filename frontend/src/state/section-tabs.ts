// Device-only UI preference: never store owner data or portfolio records here.
export const sections = {
  collection: ['overview', 'cards', 'binder'],
  wishlist: ['cards', 'deals'],
  transactions: ['overview', 'history'],
} as const;

export type Section = keyof typeof sections;
export type SectionTabs = { [K in Section]: (typeof sections)[K][number] };
export const sectionTabsKey = 'pokefolio:section-tabs:v1';
const defaults: SectionTabs = { collection: 'overview', wishlist: 'cards', transactions: 'overview' };

export function readSectionTabs(): SectionTabs {
  const tabs: Record<Section, string> = { ...defaults };
  try {
    const stored: unknown = JSON.parse(localStorage.getItem(sectionTabsKey) ?? 'null');
    if (stored && typeof stored === 'object' && !Array.isArray(stored)) {
      const preferences = stored as Record<string, unknown>;
      for (const section of Object.keys(sections) as Section[]) {
        const tab = preferences[section];
        if (typeof tab === 'string' && (sections[section] as readonly string[]).includes(tab)) tabs[section] = tab;
      }
    }
  } catch { /* Storage may be restricted or contain invalid JSON. */ }
  return tabs as SectionTabs;
}

export function saveSectionTabs(tabs: SectionTabs): void {
  try { localStorage.setItem(sectionTabsKey, JSON.stringify(tabs)); }
  catch { /* Routing remains usable when storage is unavailable. */ }
}

export function sectionTabFromPath(pathname: string): { section: Section; tab: string } | null {
  const match = /^\/([^/]+)\/([^/]+)$/.exec(pathname);
  const section = match?.[1];
  const tab = match?.[2];
  if (!section || !tab || !(section in sections)) return null;
  const key = section as Section;
  return (sections[key] as readonly string[]).includes(tab) ? { section: key, tab } : null;
}
