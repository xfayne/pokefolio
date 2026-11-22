import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Input({ className, ...props }: ComponentProps<'input'>) {
  return <input {...props} className={cn('min-h-11 w-full min-w-0 rounded-xl border border-slate-500 surface-field px-3 text-base', className)} />;
}
