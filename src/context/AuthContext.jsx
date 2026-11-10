import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import toast from 'react-hot-toast';
import { auth, call, data } from '@/services/api.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [backendError, setBackendError] = useState(false);

  useEffect(() => {
    let unsubProfile = () => {};
    const unsub = auth.onChange(async (u) => {
      unsubProfile();
      setUser(u);
      if (!u) {
        setProfile(null);
        setLoading(false);
        return;
      }
      try {
        await call('ensureProfile', { displayName: auth.takePendingName?.() || u.displayName });
        setBackendError(false);
      } catch (e) {
        console.error('ensureProfile failed', e);
        setBackendError(true);
        toast.error("Couldn't set up your account — the JodoDeal server is not reachable. Please try again later.", { id: 'backend' });
      }
      unsubProfile = data.subscribeDoc(
        `users/${u.uid}`,
        (p) => {
          setProfile(p);
          setLoading(false);
        },
        () => setLoading(false),
      );
    });
    return () => {
      unsub();
      unsubProfile();
    };
  }, []);

  const signOut = useCallback(() => auth.signOut(), []);

  const value = useMemo(
    () => ({
      user,
      profile,
      loading,
      backendError,
      role: profile?.role || (user ? 'customer' : 'guest'),
      isStaff: ['admin', 'support', 'operations'].includes(profile?.role),
      isMerchant: profile?.role === 'merchant' && !!profile?.merchantId,
      signOut,
    }),
    [user, profile, loading, backendError, signOut],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
