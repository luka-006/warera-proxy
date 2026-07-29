export type NotifyPerm = NotificationPermission | "unsupported";

export function getNotifyPermission(): NotifyPerm {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
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

export function showOsNotification(
  title: string,
  body: string,
  tag: string,
  link: string | null
): boolean {
  if (typeof window === "undefined" || !("Notification" in window)) return false;
  if (Notification.permission !== "granted") return false;
  try {
    const note = new Notification(title, { body, tag });
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

export function notifyPermissionMessage(perm: NotifyPerm): { title: string; body: string } | null {
  if (perm === "granted") {
    return {
      title: "Notifikacije ukljucene",
      body: "Pingovi ce skakati i kao sistemske obavijesti dok je HR Ops otvoren."
    };
  }
  if (perm === "denied") {
    return {
      title: "Obavijesti blokirane",
      body: "U postavkama preglednika dopusti obavijesti za ovu stranicu (ikona katanca u adresnoj traci), pa osvjezi."
    };
  }
  if (perm === "unsupported") {
    return {
      title: "Nije podrzano",
      body: "Ovaj preglednik ne podrzava sistemske obavijesti. Koristi Chrome/Edge na racunalu ili Androidu."
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