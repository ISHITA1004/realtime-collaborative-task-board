'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api, setAuthToken } from './api';
import { User } from './types';

interface AuthContextValue {
  user: User | null;
  token: string | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

const STORAGE_KEY = 'task-board-token';

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    setAuthToken(stored);
    api
      .me()
      .then((res) => {
        setToken(stored);
        setUser(res.user);
      })
      .catch(() => {
        window.localStorage.removeItem(STORAGE_KEY);
        setAuthToken(null);
      })
      .finally(() => setLoading(false));
  }, []);

  function persist(nextToken: string, nextUser: User) {
    window.localStorage.setItem(STORAGE_KEY, nextToken);
    setAuthToken(nextToken);
    setToken(nextToken);
    setUser(nextUser);
  }

  async function login(email: string, password: string) {
    const res = await api.login({ email, password });
    persist(res.token, res.user);
  }

  async function register(name: string, email: string, password: string) {
    const res = await api.register({ name, email, password });
    persist(res.token, res.user);
  }

  function logout() {
    window.localStorage.removeItem(STORAGE_KEY);
    setAuthToken(null);
    setToken(null);
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, token, loading, login, register, logout }}>{children}</AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
