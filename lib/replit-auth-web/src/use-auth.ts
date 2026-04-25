import { useState, useEffect, useCallback } from "react";
import type { AuthUser } from "@workspace/api-client-react";

export type { AuthUser };

interface AuthState {
  user: AuthUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

function isInIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch("/api/auth/user", { credentials: "include" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as { user: AuthUser | null };
      setUser(data.user ?? null);
    } catch {
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void fetchUser();
  }, [fetchUser]);

  // Re-check auth when the tab regains focus (e.g. after returning from a
  // popup-based OAuth flow).
  useEffect(() => {
    const onFocus = () => {
      void fetchUser();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, [fetchUser]);

  const login = useCallback(() => {
    const meta = import.meta as unknown as { env?: { BASE_URL?: string } };
    const base = (meta.env?.BASE_URL ?? "/").replace(/\/+$/, "") || "/";
    const url = `/api/login?returnTo=${encodeURIComponent(base)}`;
    // Inside an iframe (e.g. the Replit workspace preview), most OAuth
    // providers refuse to render due to X-Frame-Options/CSP. Open the login
    // flow in a new tab instead so the provider can render normally.
    if (isInIframe()) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
    }
  }, []);

  const logout = useCallback(() => {
    if (isInIframe()) {
      window.open("/api/logout", "_blank", "noopener,noreferrer");
    } else {
      window.location.href = "/api/logout";
    }
  }, []);

  return {
    user,
    isLoading,
    isAuthenticated: !!user,
    login,
    logout,
  };
}
