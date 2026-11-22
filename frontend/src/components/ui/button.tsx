import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';
import { cn } from '@/lib/utils';

// shadcn/ui button pattern; owned locally for application-specific styling.
const variants = cva('inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring disabled:pointer-events-none disabled:opacity-50', {
  variants: { variant: { default: 'bg-primary text-primary-foreground hover:opacity-90', outline: 'surface-panel border border-blue-400 text-slate-950 hover:bg-blue-100' } },
  defaultVariants: { variant: 'default' },
});
type Props = React.ComponentProps<'button'> & VariantProps<typeof variants> & { asChild?: boolean };
export function Button({ className, variant, asChild = false, ...props }: Props) {
  const Component = asChild ? Slot : 'button';
  return <Component className={cn(variants({ variant, className }))} {...props} />;
}
