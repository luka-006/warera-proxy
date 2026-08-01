self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  let data = { title: "HR Ops", body: "Nova obavijest", link: "/", tag: "hr-ops" };
  try {
    if (event.data) {
      data = { ...data, ...event.data.json() };
    }
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title, {
      body: data.body,
      tag: data.tag,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { link: data.link },
      vibrate: [120, 60, 120],
      requireInteraction: true
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const link = event.notification.data?.link || "/";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client) {
          const url = new URL(link, self.location.origin).href;
          if (client.url !== url && "navigate" in client) {
            return client.navigate(url).then(() => client.focus());
          }
          return client.focus();
        }
      }
      return clients.openWindow(link);
    })
  );
});