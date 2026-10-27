import { createContext, useCallback, useContext, useEffect, useState } from "react";

const AuthContext = createContext(null);

async function parseError(res) {
  try {
    const data = await res.json();
    return data.error || "Algo deu errado. Tente de novo.";
  } catch {
    return "Algo deu errado. Tente de novo.";
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const res = await fetch("/auth/me", { credentials: "include" });
      if (!res.ok) {
        setUser(null);
        return;
      }
      const data = await res.json();
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const login = async ({ email, password }) => {
    const res = await fetch("/auth/login", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    setUser(data.user);
    return data.user;
  };

  const register = async ({ name, email, password }) => {
    const res = await fetch("/auth/register", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    setUser(data.user);
    return data.user;
  };

  const logout = async () => {
    await fetch("/auth/logout", { method: "POST", credentials: "include" });
    setUser(null);
  };

  const updateProfile = async ({ name, email }) => {
    const res = await fetch("/auth/profile", {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    setUser(data.user);
    return data.user;
  };

  const changePassword = async ({ currentPassword, newPassword }) => {
    const res = await fetch("/auth/password", {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPassword, newPassword }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    const data = await res.json();
    if (data.user) setUser(data.user);
    return data;
  };

  const deleteAccount = async ({ confirm, password }) => {
    const res = await fetch("/auth/account", {
      method: "DELETE",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ confirm, password }),
    });
    if (!res.ok) throw new Error(await parseError(res));
    try {
      localStorage.removeItem("filazero-chat-threads");
    } catch {
      /* ignore */
    }
    setUser(null);
    return true;
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        refresh,
        login,
        register,
        logout,
        updateProfile,
        changePassword,
        deleteAccount,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth deve ser usado dentro de AuthProvider");
  return ctx;
}
