import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import { inventoryTranslations } from '@/features/inventory/translations';

import { newPurchaseTranslations } from '@/features/transactions/new-purchase-translations';
import { purchaseTranslations } from '@/features/transactions/purchase-translations';
import { transactionTranslations } from '@/features/transactions/translations';

export const resources = {
  en: { translation: {
    inventory: inventoryTranslations.en, transactionHistory: transactionTranslations.en, purchaseDetails: purchaseTranslations.en, newPurchase: newPurchaseTranslations.en, shipments: 'Shipments',
    overview: 'Overview', cards: 'Cards', binder: 'Binder', history: 'History', back: 'Back', close: 'Close', skip: 'Skip to content', sectionNavigation: 'Section navigation', language: 'Language', comingTitle: 'Your portfolio is taking shape', searchCards: 'Search cards', searchPlaceholder: 'Search the catalog', catalogPending: 'Catalog coming soon', catalogDescription: 'Catalog search will be available in a future update.', missingDescription: 'Choose a destination from the navigation below.', foundation: 'Application foundation', staging: 'Staging · Test environment',
    description: 'Your portfolio screens are being built. This is the new application foundation.',
    dashboard: 'Dashboard', collection: 'Collection', wishlist: 'Wishlist', deals: 'Deals', transactions: 'Transactions',
    search: 'Search', analyze: 'Analyze', settings: 'Settings', missing: 'Page not found',
    loading: 'Loading…', failed: 'Something went wrong. Reload to try again.', reload: 'Reload', navigation: 'Main navigation',
  } },
  he: { translation: {
    inventory: inventoryTranslations.he, transactionHistory: transactionTranslations.he, purchaseDetails: purchaseTranslations.he, newPurchase: newPurchaseTranslations.he, shipments: 'משלוחים',
    overview: 'סקירה', cards: 'קלפים', binder: 'בינדר', history: 'היסטוריה', back: 'חזרה', close: 'סגירה', skip: 'דילוג לתוכן', sectionNavigation: 'ניווט פנימי', language: 'שפה', comingTitle: 'תיק האוסף שלך בדרך', searchCards: 'חיפוש קלפים', searchPlaceholder: 'חיפוש בקטלוג', catalogPending: 'הקטלוג בקרוב', catalogDescription: 'החיפוש בקטלוג יהיה זמין בעדכון עתידי.', missingDescription: 'בחר יעד מסרגל הניווט למטה.', foundation: 'תשתית האפליקציה', staging: 'Staging · סביבת בדיקה',
    description: 'מסכי תיק האוסף נמצאים בבנייה. זו התשתית של האפליקציה החדשה.',
    dashboard: 'דשבורד', collection: 'אוסף', wishlist: 'רשימת משאלות', deals: 'מציאות', transactions: 'עסקאות',
    search: 'חיפוש', analyze: 'ניתוח', settings: 'הגדרות', missing: 'העמוד לא נמצא',
    loading: 'טוען…', failed: 'אירעה שגיאה. טען מחדש כדי לנסות שוב.', reload: 'טעינה מחדש', navigation: 'ניווט ראשי',
  } },
};
void i18n.use(initReactI18next).init({ resources, lng: 'en', fallbackLng: 'en', interpolation: { escapeValue: false }, initAsync: false });
function updateDirection(language: string) {
  document.documentElement.lang = language;
  document.documentElement.dir = language === 'he' ? 'rtl' : 'ltr';
}
i18n.on('languageChanged', updateDirection);
updateDirection(i18n.language);
export default i18n;
