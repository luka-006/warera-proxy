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
  isIosDevice,
  isStandalonePwa,
  markNotifyPromptDismissed,
  notifyPermissionMessage,
  playNotifySound,
  registerServiceWorker,
  requestNotifyPermission,
  showOsNotification,
  subscribeToWebPush,
  wasNotifyPromptDismissed,
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
  const [showPrompt, setShowPrompt] = useState(false);
  const [enabling, setEnabling] = useState(false);

  const showToast = useCallback((t: Toast, ms = 6000) => {
    setToast(t);
    playNotifySound();
    window.setTimeout(() => setToast(null), ms);
  }, []);

  const enableNotifications = useCallback(async () => {
    setEnabling(true);
    try {
      const p = await requestNotifyPermission();
      setPerm(p);
      const msg = notifyPermissionMessage(p);
      if (msg) showToast(msg, p === "granted" ? 5000 : 8000);
      if (p === "granted") {
        const subscribed = await subscribeToWebPush();
        if (!subscribed) {
          showToast(
            {
              title: "Obavijesti djelomicno aktivne",
              body: "Dopusteno je, ali push pretplata nije spremljena. Osvjezi i pokusaj ponovo."
            },
            7000
          );
        }
        showOsNotification(
          "HR Ops - notifikacije aktivne",
          "Ovako ce izgledati ping obavijest.",
          "hr-ops-test",
          "/"
        );
      }
      markNotifyPromptDismissed();
      setShowPrompt(false);
    } finally {
      setEnabling(false);
    }
  }, [showToast]);

  const pushNotification = useCallback(
    async (n: { id: string; title: string; body: string | null; link: string | null }) => {
      seen.current.add(n.id);
      showToast({ title: n.title, body: n.body ?? "" });
      showOsNotification(n.title, n.body ?? "Nova obavijest iz HR Ops", n.id, n.link);
      window.dispatchEvent(new CustomEvent("hr-ops-notif"));
      await fetch("/api/notifications", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ id: n.id })
      }).catch(() => undefined);
    },
    [showToast]
  );

  useEffect(() => {
    setMounted(true);
    setPerm(getNotifyPermission());
    void registerServiceWorker();
  }, []);

  useEffect(() => {
    if (!mounted) return;
    if (perm === "granted" || wasNotifyPromptDismissed()) return;
    const t = window.setTimeout(() => setShowPrompt(true), 900);
    return () => window.clearTimeout(t);
  }, [mounted, perm]);

  useEffect(() => {
    if (!mounted || perm !== "granted") return;
    void subscribeToWebPush().catch(() => undefined);
  }, [mounted, perm]);

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
    void enableNotifications();
  }, [enableNotifications]);

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
        for (const n of list) {
          if (n.read) seen.current.add(n.id);
        }
        const unreadFresh = list.filter((n) => !n.read && !seen.current.has(n.id));
        for (const n of unreadFresh) {
          await pushNotification(n);
        }
        primed.current = true;
        return;
      }

      const fresh = list.filter((n) => !n.read && !seen.current.has(n.id));
      for (const n of fresh) {
        await pushNotification(n);
      }
    }

    poll();
    const t = setInterval(poll, 3_000);
    return () => clearInterval(t);
  }, [pushNotification]);

  const supported = perm !== "unsupported";
  const ctx: NotificationCtx = { perm, supported, requestPermission };

  const iosHint =
    isIosDevice() && !isStandalonePwa()
      ? "Na iPhoneu: Share → Dodaj na pocetni zaslon, pa otvori app i dopusti obavijesti."
      : null;

  const promptModal =
    showPrompt && perm !== "granted" && supported ? (
      <div className="notify-prompt-backdrop" role="presentation">
        <div className="notify-prompt-card reveal" role="dialog" aria-labelledby="notify-prompt-title">
          <div className="notify-prompt-icon" aria-hidden>
            &#128276;
          </div>
          <h2 id="notify-prompt-title">Dopusti obavijesti</h2>
          <p>
            Pingovi i orderi stizu kao prave sistemske obavijesti na mobitelu, cak i kad je app u
            pozadini.
          </p>
          {iosHint && <p className="notify-prompt-hint">{iosHint}</p>}
          <div className="notify-prompt-actions">
            <button
              type="button"
              className="btn btn-primary"
              disabled={enabling}
              onClick={() => void enableNotifications()}
            >
              {enabling ? "Ukljucujem..." : "Dopusti obavijesti"}
            </button>
            <button
              type="button"
              className="btn"
              disabled={enabling}
              onClick={() => {
                markNotifyPromptDismissed();
                setShowPrompt(false);
              }}
            >
              Kasnije
            </button>
          </div>
        </div>
      </div>
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
      {mounted &&
        createPortal(
          <>
            {promptModal}
            {toastEl}
          </>,
          document.body
        )}
    </Ctx.Provider>
  );
}
