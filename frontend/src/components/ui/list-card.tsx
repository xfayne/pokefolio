import type { ComponentProps } from 'react';
import { cn } from '@/lib/utils';

export function ListCard({ className, ...props }: ComponentProps<'li'>) {
  return <li {...props} className={cn('ui-list-card inventory-card overflow-hidden rounded-xl', className)} />;
}
