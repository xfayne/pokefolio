import type { ReactNode } from 'react';
import { NavLink } from 'react-router';
import { useTranslation } from 'react-i18next';
import { sections, type Section } from '@/state/section-tabs';

/** Single sticky navigation surface for all nested application sections. */
export function SectionTabsBar({ section, search = '', action }: { section: Section; search?: string; action?: ReactNode }) {
  const { t } = useTranslation();
  return <div className={section === 'transactions' ? 'section-tabs-sticky transactions-nav-sticky' : 'section-tabs-sticky'}>
    <nav aria-label={t('sectionNavigation')} className="section-tabs flex min-w-0 flex-1 gap-1 rounded-full bg-blue-100/80 p-1">
      {sections[section].map(tab => <NavLink key={tab} to={{ pathname: `/${section}/${tab}`, search }} className={({ isActive }) => `flex min-h-9 min-w-0 flex-1 items-center justify-center rounded-full px-2 text-sm font-semibold transition-colors duration-150 ${isActive ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-700 hover:bg-white/60'}`}>{t(tab)}</NavLink>)}
    </nav>
    {action}
  </div>;
}
