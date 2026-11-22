import { useId, type ComponentProps } from 'react';
import { LuSearch } from 'react-icons/lu';
import { cn } from '@/lib/utils';

export function SearchInput({ label, id, className, ...props }: Omit<ComponentProps<'input'>, 'type'> & { label: string }) {
  const generatedId = useId();
  const inputId = id ?? generatedId;
  return <div className="relative">
    <label htmlFor={inputId} className="sr-only">{label}</label>
    <LuSearch aria-hidden className="pointer-events-none absolute start-3 top-1/2 size-5 -translate-y-1/2 text-slate-600" />
    <input {...props} id={inputId} type="search" className={cn('ui-search min-h-11 w-full min-w-0 rounded-xl border border-blue-200 surface-field pe-3 ps-10 text-base', className)} />
  </div>;
}
