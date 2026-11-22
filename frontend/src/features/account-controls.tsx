import { useState } from 'react';
import { GoogleAuthProvider, signInWithPopup, signOut } from 'firebase/auth';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/hooks/use-auth';
import { getFirebaseServices } from '@/services/firebase';
import { Button } from '@/components/ui/button';
export function AccountControls() {
  const { user } = useAuth();
  const { i18n } = useTranslation();
  const he = i18n.language === 'he';
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  return (
    <div className="space-y-2">
      <p>{user?.displayName ?? user?.email}</p>
      <Button
        disabled={busy || !getFirebaseServices()}
        onClick={() => {
          setBusy(true);
          setError(false);
          const auth = getFirebaseServices()!.auth;
          void (
            user
              ? signOut(auth)
              : signInWithPopup(auth, new GoogleAuthProvider())
          )
            .catch(() => setError(true))
            .finally(() => setBusy(false));
        }}
      >
        {he
          ? user
            ? 'יציאה מהחשבון'
            : 'כניסה עם Google'
          : user
            ? 'Sign out'
            : 'Sign in with Google'}
      </Button>
      {error && (
        <p role="alert">
          {he ? 'הכניסה נכשלה. אפשר לנסות שוב.' : 'Sign-in failed. Try again.'}
        </p>
      )}
    </div>
  );
}
