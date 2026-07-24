"use client";

import { useCallback, useEffect, useRef, useState } from "react";

interface Channel {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
}
interface Msg {
  id: string;
  body: string;
  createdAt: string | number | Date;
  author: string;
  authorRank: string;
}

const RANK_SHORT: Record<string, string> = {
  admin: "ADM",
  zapovjednik: "ZAP",
  vojnik: "VOJ"
};

export default function ChatClient({
  canWrite,
  isSoldier,
  me
}: {
  canWrite: boolean;
  isSoldier: boolean;
  me: string;
}) {
  const [channels, setChannels] = useState<Channel[]>([]);
  const [active, setActive] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [requested, setRequested] = useState(false);
  const [sending, setSending] = useState(false);
  const lastAt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((d) => {
        setChannels(d.channels ?? []);
        if (d.channels?.[0]) setActive(d.channels[0].id);
      });
  }, []);

  const fetchMessages = useCallback(
    async (channelId: string, incremental: boolean) => {
      const url = new URL("/api/chat/messages", window.location.origin);
      url.searchParams.set("channelId", channelId);
      if (incremental && lastAt.current) url.searchParams.set("after", lastAt.current);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      const incoming: Msg[] = data.messages ?? [];
      if (!incoming.length) return;
      lastAt.current = new Date(incoming[incoming.length - 1].createdAt).toISOString();
      setMessages((prev) => (incremental ? [...prev, ...incoming] : incoming));
    },
    []
  );

  useEffect(() => {
    if (!active) return;
    lastAt.current = null;
    setMessages([]);
    fetchMessages(active, false);
    poll.current = setInterval(() => fetchMessages(active, true), 6000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [active, fetchMessages]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !active) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId: active, body: text })
      });
      if (res.ok) {
        setText("");
        await fetchMessages(active, true);
      }
    } finally {
      setSending(false);
    }
  }

  async function requestAccess() {
    const res = await fetch("/api/chat/request-access", { method: "POST" });
    if (res.ok) setRequested(true);
  }

  const activeChannel = channels.find((c) => c.id === active);

  return (
    <div>
      <div className="section-head">
        <h1>Komunikacije</h1>
        <span className="meta">
          {activeChannel ? `#${activeChannel.slug}` : "odaberi kanal"}
        </span>
      </div>

      <div className="chat-layout">
        <div className="channel-list">
          {channels.length === 0 && <div className="empty">Nema kanala</div>}
          {channels.map((c) => (
            <button
              key={c.id}
              className={`channel-item ${c.id === active ? "active" : ""}`}
              onClick={() => setActive(c.id)}
            >
              #{c.slug}
            </button>
          ))}
        </div>

        <div className="chat-main">
          <div className="chat-messages" ref={scroller}>
            {messages.length === 0 ? (
              <div className="empty">Nema poruka</div>
            ) : (
              messages.map((m) => (
                <div className="msg" key={m.id}>
                  <div className="head">
                    <span className="author">
                      {m.author}
                      <span className="rk">{RANK_SHORT[m.authorRank] ?? ""}</span>
                    </span>
                    <span className="time">
                      {new Date(m.createdAt).toLocaleTimeString("hr-HR", {
                        hour: "2-digit",
                        minute: "2-digit"
                      })}
                    </span>
                  </div>
                  <div className="text">{m.body}</div>
                </div>
              ))
            )}
          </div>

          {canWrite ? (
            <form className="chat-input" onSubmit={send}>
              <input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Napisi poruku..."
                maxLength={1000}
              />
              <button className="btn btn-primary" disabled={sending || !active}>
                Posalji
              </button>
            </form>
          ) : (
            <div className="chat-locked">
              <span>
                {isSoldier
                  ? "Samo citanje. Zatrazi pravo pisanja od zapovjednika."
                  : "Nemas dopustenje za pisanje."}
              </span>
              {isSoldier && (
                <button className="btn btn-sm" onClick={requestAccess} disabled={requested}>
                  {requested ? "Zahtjev poslan" : "Zatrazi pisanje"}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
