import { useEffect, useState } from 'react';
import type { User } from 'firebase/auth';
import { subscribeToAuth } from '@/services/firebase';
type AuthState = { status: 'loading' | 'ready' | 'error'; user: User | null; error: Error | null };
export function useAuth() {
  const [state, setState] = useState<AuthState>({ status: 'loading', user: null, error: null });
  useEffect(() => {
    return subscribeToAuth((user) => setState({ status: 'ready', user, error: null }), (error) => setState({ status: 'error', user: null, error }));
  }, []);
  return state;
}
