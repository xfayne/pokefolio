import type { ComponentProps, ReactNode } from 'react';
import { LuChevronDown } from 'react-icons/lu';
import { cn } from '@/lib/utils';

// Open state is required: each screen owns its product-specific defaults.
export function DisclosureContent({ open, children, className, ...props }: ComponentProps<'div'> & { open: boolean }) {
  return <div {...props} className={cn('ui-disclosure', className)} data-open={open} aria-hidden={!open} inert={!open}><div>{children}</div></div>;
}
export function DisclosureButton({ open, contentId, children, ...props }: Omit<ComponentProps<'button'>, 'aria-expanded' | 'aria-controls'> & { open: boolean; contentId: string; children: ReactNode }) {
  return <button type="button" {...props} aria-expanded={open} aria-controls={contentId}>{children}</button>;
}
export function DisclosureChevron({ open, className }: { open: boolean; className?: string }) {
  return <LuChevronDown aria-hidden className={cn('size-5 transition-transform', open && 'rotate-180', className)} />;
}
