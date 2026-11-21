import { useTranslation } from 'react-i18next';
import { LuPencil } from 'react-icons/lu';
export function PurchaseActions({
  onEdit,
}: {
  onEdit?: (() => void) | undefined;
}) {
  const { t } = useTranslation();
  return onEdit ? (
    <button
      type="button"
      aria-label={t('newPurchase.editTitle')}
      onClick={onEdit}
      className="flex size-11 items-center justify-center rounded-xl text-white focus-visible:outline-white"
    >
      <LuPencil aria-hidden className="size-6" />
    </button>
  ) : null;
}
