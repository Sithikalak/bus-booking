import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from "react";
import { api } from "../api/client";
import type { User } from "../types";
type Notice = { id: number; text: string; kind: "success" | "error" | "info" };
type Context = {
  user: User | null;
  ready: boolean;
  theme: "dark" | "light";
  toggleTheme: () => void;
  accept: (session: { token: string | null; user: User }) => void;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  can: (p: string) => boolean;
  toast: (text: string, kind?: Notice["kind"]) => void;
  notices: Notice[];
};
const AppContext = createContext<Context>(null!);
export function AppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [ready, setReady] = useState(false);
  const [notices, setNotices] = useState<Notice[]>([]);
  const [theme] = useState<"dark">("dark");

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", "dark");
    localStorage.setItem("citylink-theme", "dark");
  }, []);

  const toggleTheme = useCallback(() => {
    // Light mode removed; permanently dark
  }, []);

  const toast = useCallback(
    (text: string, kind: Notice["kind"] = "success") => {
      setNotices((prev) => {
        // Prevent stacking duplicate toasts with identical text
        if (prev.some((x) => x.text === text)) return prev;
        const id = Date.now() + Math.random();
        setTimeout(() => setNotices((n) => n.filter((x) => x.id !== id)), 5000);
        return [...prev, { id, text, kind }];
      });
    },
    [],
  );
  const clear = useCallback(() => {
    sessionStorage.removeItem("citylink-token");
    setUser(null);
  }, []);
  const refresh = useCallback(async () => {
    if (sessionStorage.getItem("citylink-token"))
      setUser(await api<User>("/auth/me"));
  }, []);
  useEffect(() => {
    refresh()
      .catch(clear)
      .finally(() => setReady(true));
    let lastExpiredTime = 0;
    const expired = () => {
      clear();
      const now = Date.now();
      const isAuthPage =
        window.location.pathname.startsWith("/login") ||
        window.location.pathname.startsWith("/register") ||
        window.location.pathname.startsWith("/recover");
      if (!isAuthPage && now - lastExpiredTime > 6000) {
        lastExpiredTime = now;
        toast("Your session ended. Please sign in again.", "info");
      }
    };
    window.addEventListener("session-expired", expired);
    return () => window.removeEventListener("session-expired", expired);
  }, [refresh, clear, toast]);
  const accept = (s: { token: string | null; user: User }) => {
    if (s.token) {
      sessionStorage.setItem("citylink-token", s.token);
      setUser(s.user);
    }
  };
  const logout = async () => {
    try {
      await api("/auth/logout", "POST");
      clear();
      toast("Signed out on all devices.");
    } catch (e) {
      toast((e as Error).message, "error");
    }
  };
  const can = (p: string) =>
    !!user && (user.role === "ADMIN" || (Array.isArray(user.permissions) && user.permissions.includes(p)));
  return (
    <AppContext.Provider
      value={{
        user,
        ready,
        theme,
        toggleTheme,
        accept,
        logout,
        refresh,
        can,
        toast,
        notices,
      }}
    >
      {children}
      <div className="toasts" aria-live="polite">
        {notices.map((n) => (
          <div key={n.id} className={"toast " + n.kind}>
            {n.kind === "success" ? "✓" : n.kind === "error" ? "!" : "i"}{" "}
            <span>{n.text}</span>
          </div>
        ))}
      </div>
    </AppContext.Provider>
  );
}
export const useApp = () => useContext(AppContext);
