import { useTranslation } from 'react-i18next';
import { EmptyState, LoadingState } from '@/components/ui/surfaces';
export function PortfolioStatus({loading,error}:{loading:boolean;error:unknown}) {
 const {t,i18n}=useTranslation();
 if(loading) return <LoadingState label={t('loading')} />;
 if(error) return <EmptyState title={i18n.language==='he'?'טעינת הנתונים נכשלה':'Could not load your portfolio'} description={i18n.language==='he'?'הנתונים לא הוחלפו. אפשר לרענן ולנסות שוב.':'Your records have not been replaced. Reload to try again.'} />;
 return null;
}
