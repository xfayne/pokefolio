import type { ComponentProps, ReactNode } from 'react';
import { LuInbox, LuLoaderCircle, LuTriangleAlert } from 'react-icons/lu';
import { cn } from '@/lib/utils';
import { Button } from './button';

export function Card({ className, ...props }: ComponentProps<'section'>) {
  return <section className={cn('rounded-2xl border border-blue-100 bg-white p-4 shadow-sm', className)} {...props} />;
}
export function Field({ label, id, ...props }: ComponentProps<'input'> & { label: string; id: string }) {
  return <div className="space-y-2"><label htmlFor={id} className="block text-sm font-medium">{label}</label><input id={id} className="min-h-11 w-full rounded-xl border border-slate-500 bg-white px-3 text-base" {...props} /></div>;
}
export function EmptyState({ title, description, action }: { title: string; description: string; action?: ReactNode }) {
  return <Card className="space-y-3 p-6 text-center"><LuInbox aria-hidden className="mx-auto size-8 text-blue-600" /><h2 className="text-xl font-semibold">{title}</h2><p className="text-sm leading-6 text-slate-600">{description}</p>{action}</Card>;
}
export function LoadingState({ label }: { label: string }) {
  return <div role="status" className="flex min-h-44 items-center justify-center gap-3 text-slate-600"><LuLoaderCircle aria-hidden className="size-5 animate-spin motion-reduce:animate-none" />{label}</div>;
}
export function ErrorState({ title, retryLabel, onRetry }: { title: string; retryLabel: string; onRetry: () => void }) {
  return <Card className="space-y-4 p-6"><p role="alert" className="flex items-center gap-2 text-rose-700"><LuTriangleAlert aria-hidden className="size-5 shrink-0" />{title}</p><Button variant="outline" onClick={onRetry}>{retryLabel}</Button></Card>;
}
