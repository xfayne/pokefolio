import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function Select({ className, ...props }: ComponentProps<'select'>) {
  return <select {...props} className={cn('min-h-11 min-w-0 rounded-lg border border-blue-200 surface-field px-3 text-base', className)} />;
}
