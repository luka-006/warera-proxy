export type NotifyPerm = NotificationPermission | "unsupported";

const PROMPT_KEY = "hr-ops-notify-prompt-v1";

export function wasNotifyPromptDismissed(): boolean {
  if (typeof window === "undefined") return true;
  return localStorage.getItem(PROMPT_KEY) === "1";
}

export function markNotifyPromptDismissed() {
  if (typeof window === "undefined") return;
  localStorage.setItem(PROMPT_KEY, "1");
}

export function getNotifyPermission(): NotifyPerm {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function isIosDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  return /iPad|iPhone|iPod/.test(navigator.userAgent);
}

export function isStandalonePwa(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** Pozovi izravno iz onClick/onPointerUp - mora biti user gesture. */
export function requestNotifyPermission(): Promise<NotifyPerm> {
  if (typeof window === "undefined" || !("Notification" in window)) {
    return Promise.resolve("unsupported");
  }
  if (!window.isSecureContext) {
    return Promise.resolve(Notification.permission);
  }
  return Notification.requestPermission()
    .then((p) => p)
    .catch(() => "denied" as const);
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const base64Safe = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64Safe);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export async function registerServiceWorker(): Promise<ServiceWorkerRegistration | null> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator)) return null;
  try {
    return await navigator.serviceWorker.register("/sw.js", { scope: "/" });
  } catch {
    return null;
  }
}

export async function subscribeToWebPush(): Promise<boolean> {
  if (typeof window === "undefined" || !("serviceWorker" in navigator) || !("PushManager" in window)) {
    return false;
  }
  const reg = await registerServiceWorker();
  if (!reg) return false;

  const vapidRes = await fetch("/api/push/vapid").catch(() => null);
  if (!vapidRes?.ok) return false;
  const vapid = await vapidRes.json();
  if (!vapid.configured || !vapid.publicKey) return false;

  const existing = await reg.pushManager.getSubscription();
  const sub =
    existing ??
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(vapid.publicKey) as BufferSource
    }));

  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return false;

  const save = await fetch("/api/push/subscribe", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      endpoint: json.endpoint,
      keys: { p256dh: json.keys.p256dh, auth: json.keys.auth }
    })
  });
  return save.ok;
}

export function showOsNotification(
  title: string,
  body: string,
  tag: string,
  link: string | null
): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const note = new Notification(title, {
      body,
      tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      requireInteraction: true
    });
    note.onclick = () => {
      window.focus();
      if (link?.startsWith("http")) window.open(link, "_blank");
      else if (link) window.location.href = link;
      note.close();
    };
    return true;
  } catch {
    return false;
  }
}

let audioCtx: AudioContext | null = null;

export function playNotifySound() {
  if (typeof window === "undefined") return;
  try {
    audioCtx ??= new AudioContext();
    const ctx = audioCtx;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.type = "sine";
    o.frequency.value = 880;
    g.gain.value = 0.0001;
    o.connect(g);
    g.connect(ctx.destination);
    o.start();
    g.gain.exponentialRampToValueAtTime(0.08, ctx.currentTime + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.35);
    o.stop(ctx.currentTime + 0.36);
  } catch {
    /* ignore */
  }
}

export function notifyPermissionMessage(perm: NotifyPerm): { title: string; body: string } | null {
  if (perm === "granted") {
    return {
      title: "Notifikacije ukljucene",
      body: "Pingovi stizu kao sistemske obavijesti na mobitelu i racunalu."
    };
  }
  if (perm === "denied") {
    return {
      title: "Obavijesti blokirane",
      body: "U postavkama preglednika dopusti obavijesti za ovu stranicu, pa osvjezi."
    };
  }
  if (perm === "unsupported") {
    return {
      title: "Nije podrzano",
      body: "Koristi Chrome na Androidu ili dodaj HR Ops na pocetni zaslon (iPhone)."
    };
  }
  if (typeof window !== "undefined" && !window.isSecureContext) {
    return {
      title: "Potreban je HTTPS",
      body: "Sistemske obavijesti rade samo preko sigurne veze (https://)."
    };
  }
  return {
    title: "Niste odobrili",
    body: "Kliknite ponovo i odaberite Dopusti u prozoru preglednika."
  };
}
