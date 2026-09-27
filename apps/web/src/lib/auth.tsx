"use client";
import { createContext, useContext, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, setToken, clearToken, getStoredUser, setStoredUser } from "./api";

type User = { id: string; name: string; email: string; role: string; district?: string } | null;

const AuthContext = createContext<{
  user: User;
  loading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (name: string, email: string, password: string, phone: string, district: string) => Promise<User>;
  googleLogin: (credential: string) => Promise<User>;
  logout: () => void;
}>({ user: null, loading: true, login: async () => null, register: async () => null, googleLogin: async () => null, logout: () => {} });

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setUser(getStoredUser());
    setLoading(false);
  }, []);

  async function login(email: string, password: string) {
    const res = await api.login(email, password);
    setToken(res.access_token);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }

  async function register(name: string, email: string, password: string, phone: string, district: string) {
    const res = await api.register(name, email, password, phone, district);
    setToken(res.access_token);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }

  async function googleLogin(credential: string) {
    const res = await api.googleLogin(credential);
    setToken(res.access_token);
    setStoredUser(res.user);
    setUser(res.user);
    return res.user;
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider value={{ user, loading, login, register, googleLogin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

export function useRequireRole(allowed: string[]) {
  const { user, loading } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace("/login");
    } else if (!allowed.includes(user.role)) {
      router.replace("/");
    }
  }, [user, loading]);
  return { user, loading };
}
