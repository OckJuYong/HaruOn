import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api } from '../api/api';
import { loadUser, saveUser } from '../utils/localStore';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

export default function AppProvider({ children }) {
  const [user, setUser] = useState(loadUser());
  const [health, setHealth] = useState({ ok: null, status: null });

  useEffect(() => { saveUser(user); }, [user]);
  useEffect(() => { (async () => { try { setHealth(await api.healthz()); } catch { setHealth({ ok:false, status:0 }); } })(); }, []);

  const value = useMemo(() => ({ user, setUser, health }), [user, health]);
  return <AppCtx.Provider value={value}>{children}</AppCtx.Provider>;
}