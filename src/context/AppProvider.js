import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { onAuthStateChange, healthz } from '../services/supabaseApi';

const AppCtx = createContext({
  user: null,
  loading: true,
  health: { ok: null, status: null },
});
export const useApp = () => useContext(AppCtx);

export default function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [health, setHealth] = useState({ ok: null, status: null });

  useEffect(() => {
    // Set up auth state listener
    const subscription = onAuthStateChange((user) => {
      setUser(user);
      setLoading(false);
    });

    // Initial health check
    (async () => {
      try {
        setHealth(await healthz());
      } catch {
        setHealth({ ok: false, status: 0 });
      }
    })();

    // Cleanup subscription on unmount
    return () => {
      if (subscription && typeof subscription.unsubscribe === 'function') {
        subscription.unsubscribe();
      }
    };
  }, []); // Run only once on mount

  const value = useMemo(() => ({ user, loading, health }), [user, loading, health]);

  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}