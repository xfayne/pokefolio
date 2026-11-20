import { useEffect, useRef, type ReactNode } from 'react';
import { LuArrowLeft, LuX } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';

export function UtilitySheet({ title, onClose, onBack, backLabel, children, transition = 'slide' }: { title: string; onClose: () => void; onBack?: () => void; backLabel?: string; children: ReactNode; transition?: 'slide' | 'subtle' | undefined }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    dialog.focus({ preventScroll: true });
    let secondFrame = 0;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => { dialog.dataset.entered = 'true'; });
    });
    document.body.style.overflow = 'hidden';
    return () => {
      cancelAnimationFrame(firstFrame);
      cancelAnimationFrame(secondFrame);
      delete dialog.dataset.entered;
      dialog.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} tabIndex={-1} aria-modal="true" aria-labelledby="sheet-title" className="utility-dialog" data-transition={transition} onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="sheet-frame flex h-full flex-col">
      <div className="sheet-header top-bar relative flex min-h-16 shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 pt-3 text-white">
        {onBack && <button type="button" onClick={onBack} aria-label={backLabel ?? t('back')} className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-white"><LuArrowLeft aria-hidden className="size-6 rtl:rotate-180" /></button>}<h1 id="sheet-title" className={`flex-1 font-bold ${onBack ? 'py-3 text-xl' : 'py-5 text-2xl'}`}>{title}</h1>
        <button type="button" aria-label={t('close')} onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-white"><LuX aria-hidden className="size-6" /></button>
      </div>
      <div className="sheet-content min-h-0 overflow-y-auto overscroll-contain p-3 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </dialog>;
}
