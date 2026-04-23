import { createContext, useContext, useEffect, useState, useCallback } from "react";
import { api } from "../lib/api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  // null = checking, false = logged-out, object = authenticated
  const [auth, setAuth] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get("/auth/me");
      setAuth(data);
    } catch {
      setAuth(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async (email, password) => {
    const { data } = await api.post("/auth/login", { email, password });
    setAuth({ user: data.user, business: data.business });
    return data;
  };

  const register = async (payload) => {
    const { data } = await api.post("/auth/register", payload);
    setAuth({ user: data.user, business: data.business });
    return data;
  };

  const logout = async () => {
    await api.post("/auth/logout");
    setAuth(false);
  };

  return (
    <AuthContext.Provider value={{ auth, login, register, logout, refresh, setAuth }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
