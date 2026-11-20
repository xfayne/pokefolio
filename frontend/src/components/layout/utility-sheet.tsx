import { useEffect, useRef, type ReactNode } from 'react';
import { LuX } from 'react-icons/lu';
import { useTranslation } from 'react-i18next';

export function UtilitySheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  const { t } = useTranslation();
  useEffect(() => {
    const dialog = ref.current!;
    const opener = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      opener?.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby="sheet-title" className="utility-dialog sheet-enter" onCancel={(event) => { event.preventDefault(); onClose(); }}>
    <div className="flex h-full flex-col">
      <header className="top-bar flex shrink-0 items-center justify-between gap-3 bg-slate-900 px-4 text-white">
        <h1 id="sheet-title" className="py-5 text-2xl font-bold">{title}</h1>
        <button autoFocus type="button" aria-label={t('close')} onClick={onClose} className="flex size-11 shrink-0 items-center justify-center rounded-xl focus-visible:outline-white"><LuX aria-hidden className="size-6" /></button>
      </header>
      <div className="overflow-y-auto overscroll-contain p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">{children}</div>
    </div>
  </dialog>;
}
