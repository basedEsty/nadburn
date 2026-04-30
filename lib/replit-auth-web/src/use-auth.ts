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

// Resolve auth endpoints against `VITE_API_BASE_URL` so a frontend deployed to
// a different origin than the api-server (e.g. Vercel frontend + Replit
// api-server) hits the api-server directly instead of its own host. When the
// env var is unset (dev preview or single-origin deploy), URLs stay relative
// and route through the local proxy as before.
const RAW_API_BASE: string =
  (import.meta as unknown as { env?: { VITE_API_BASE_URL?: string } }).env
    ?.VITE_API_BASE_URL ?? "";
const API_BASE = RAW_API_BASE.replace(/\/+$/, "");

function authUrl(path: string): string {
  const p = path.startsWith("/") ? path : `/${path}`;
  return API_BASE ? `${API_BASE}${p}` : p;
}

export function useAuth(): AuthState {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchUser = useCallback(async () => {
    try {
      const res = await fetch(authUrl("/api/auth/user"), {
        credentials: "include",
      });
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
    // When the api-server lives on a different origin we must send the user
    // back to the frontend after the OIDC callback, not to the api-server's
    // own host. Pass the absolute frontend URL as `returnTo`; the server
    // validates it against its allowlist before redirecting.
    const returnTo = API_BASE
      ? `${window.location.origin}${base}`
      : base;
    const url = authUrl(
      `/api/login?returnTo=${encodeURIComponent(returnTo)}`,
    );
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
    const returnTo = API_BASE ? window.location.origin : "";
    const url = authUrl(
      returnTo
        ? `/api/logout?returnTo=${encodeURIComponent(returnTo)}`
        : "/api/logout",
    );
    if (isInIframe()) {
      window.open(url, "_blank", "noopener,noreferrer");
    } else {
      window.location.href = url;
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
