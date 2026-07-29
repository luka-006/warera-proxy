"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode
} from "react";
import { createPortal } from "react-dom";
import {
  getNotifyPermission,
  notifyPermissionMessage,
  requestNotifyPermission,
  showOsNotification,
  type NotifyPerm
} from "@/lib/browser-notify";

type Toast = { title: string; body: string };

type NotificationCtx = {
  perm: NotifyPerm;
  supported: boolean;
  requestPermission: () => void;
};

const Ctx = createContext<NotificationCtx | null>(null);

export function useNotifications() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useNotifications mora biti unutar NotificationProvider");
  return v;
}

export default function NotificationProvider({ children }: { children: ReactNode }) {
  const seen = useRef<Set<string>>(new Set());
  const primed = useRef(false);
  const [mounted, setMounted] = useState(false);
  const [toast, setToast] = useState<Toast | null>(null);
  const [perm, setPerm] = useState<NotifyPerm>("default");

  const showToast = useCallback((t: Toast, ms = 6000) => {
    setToast(t);
    window.setTimeout(() => setToast(null), ms);
  }, []);

  useEffect(() => {
    setMounted(true);
    setPerm(getNotifyPermission());
  }, []);

  useEffect(() => {
    if (!mounted || !("permissions" in navigator)) return;
    let status: PermissionStatus | null = null;
    const sync = () => setPerm(getNotifyPermission());
    navigator.permissions
      .query({ name: "notifications" as PermissionName })
      .then((s) => {
        status = s;
        s.addEventListener("change", sync);
      })
      .catch(() => undefined);
    return () => {
      status?.removeEventListener("change", sync);
    };
  }, [mounted]);

  const requestPermission = useCallback(() => {
    void requestNotifyPermission().then((p) => {
      setPerm(p);
      const msg = notifyPermissionMessage(p);
      if (msg) showToast(msg, p === "granted" ? 5000 : 8000);
      if (p === "granted") {
        showOsNotification(
          "HR Ops - notifikacije aktivne",
          "Ovako ce izgledati ping obavijest.",
          "hr-ops-test",
          "/"
        );
      }
    });
  }, [showToast]);

  useEffect(() => {
    function onExternalRequest() {
      requestPermission();
    }
    window.addEventListener("hr-ops-request-notify", onExternalRequest);
    return () => window.removeEventListener("hr-ops-request-notify", onExternalRequest);
  }, [requestPermission]);

  useEffect(() => {
    async function poll() {
      const r = await fetch("/api/notifications").catch(() => null);
      if (!r?.ok) return;
      const d = await r.json();
      const list: {
        id: string;
        title: string;
        body: string | null;
        link: string | null;
        read: boolean;
      }[] = d.notifications ?? [];

      if (!primed.current) {
        for (const n of list) seen.current.add(n.id);
        primed.current = true;
        return;
      }

      const fresh = list.filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of fresh) {
        seen.current.add(n.id);
        showToast({ title: n.title, body: n.body ?? "" });
        showOsNotification(n.title, n.body ?? "Nova obavijest iz HR Ops", n.id, n.link);
        window.dispatchEvent(new CustomEvent("hr-ops-notif"));
      }
    }

    poll();
    const t = setInterval(poll, 5_000);
    return () => clearInterval(t);
  }, [showToast]);

  const supported = perm !== "unsupported";
  const ctx: NotificationCtx = { perm, supported, requestPermission };

  const overlay =
    mounted && perm !== "granted" && supported ? (
      <button
        type="button"
        className="push-enable"
        onPointerUp={(e) => {
          e.preventDefault();
          requestPermission();
        }}
      >
        Ukljuci notifikacije *
      </button>
    ) : null;

  const toastEl = toast ? (
    <div className="notif-toast reveal" role="status">
      <div className="notif-toast-title">{toast.title}</div>
      {toast.body && <div className="notif-toast-body">{toast.body}</div>}
      <button type="button" className="assign-x" onClick={() => setToast(null)}>
        x
      </button>
    </div>
  ) : null;

  return (
    <Ctx.Provider value={ctx}>
      {children}
      {mounted && createPortal(
        <>
          {overlay}
          {toastEl}
        </>,
        document.body
      )}
    </Ctx.Provider>
  );
}