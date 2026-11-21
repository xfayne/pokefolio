import { useEffect, useId, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { LuEllipsis, LuPencil } from 'react-icons/lu';
import { DisclosureContent } from '@/components/ui/disclosure';

export function PurchaseActions({
  onEdit,
}: {
  onEdit?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const item = useRef<HTMLButtonElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    item.current?.focus();
    const outside = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [open]);
  return (
    <div
      ref={root}
      className="relative"
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          setOpen(false);
          trigger.current?.focus();
        }
        if (event.key === 'Tab') setOpen(false);
        if (
          ['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key) &&
          onEdit
        ) {
          event.preventDefault();
          setOpen(true);
          item.current?.focus();
        }
      }}
    >
      <button
        ref={trigger}
        type="button"
        disabled={!onEdit}
        aria-label={t('purchaseDetails.more')}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((value) => !value)}
        className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white"
      >
        <LuEllipsis aria-hidden className="size-6" />
      </button>
      <DisclosureContent
        id={id}
        open={open}
        className="absolute end-0 top-full z-50 w-52"
      >
        <div
          role="menu"
          aria-label={t('purchaseDetails.more')}
          className="rounded-xl border surface-panel p-1 text-slate-950 shadow-lg"
        >
          <button
            ref={item}
            role="menuitem"
            type="button"
            className="flex min-h-11 w-full items-center gap-2 rounded-lg px-3 text-start text-sm hover:bg-blue-100 focus-visible:bg-blue-100"
            onClick={() => {
              setOpen(false);
              onEdit?.();
            }}
          >
            <LuPencil aria-hidden />
            {t('newPurchase.editTitle')}
          </button>
        </div>
      </DisclosureContent>
    </div>
  );
}
