import { useContext, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { LuLoaderCircle, LuSave } from 'react-icons/lu';
import { TransactionHeaderContext } from './transaction-header-context';

// The form owns validation and submit locking. The native form attribute keeps
// header clicks and keyboard submission on that same submit handler.
export function TransactionFormHeader({ formId, disabled, saving, label, children }: {
  formId: string; disabled: boolean; saving: boolean; label: string; children: ReactNode;
}) {
  const targets = useContext(TransactionHeaderContext);
  return <>
    {targets.actions && createPortal(<button type="submit" form={formId} disabled={disabled} aria-label={label} title={label} aria-busy={saving}
      className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white disabled:opacity-50">
      {saving ? <LuLoaderCircle aria-hidden className="size-6 animate-spin motion-reduce:animate-none" /> : <LuSave aria-hidden className="size-6" />}
    </button>, targets.actions)}
    {targets.tabs && createPortal(<fieldset disabled={saving}>{children}</fieldset>, targets.tabs)}
  </>;
}
