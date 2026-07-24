"use client";

import { useCallback, useEffect, useRef, useState } from "react";

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

export default function ChatClient() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastAt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((d) => {
        const ch = (d.channels ?? [])[0];
        if (ch) setChannelId(ch.id);
      });
  }, []);

  const fetchMessages = useCallback(async (id: string, incremental: boolean) => {
    const url = new URL("/api/chat/messages", window.location.origin);
    url.searchParams.set("channelId", id);
    if (incremental && lastAt.current) url.searchParams.set("after", lastAt.current);
    const res = await fetch(url.toString());
    if (!res.ok) return;
    const data = await res.json();
    const incoming: Msg[] = data.messages ?? [];
    if (!incoming.length) return;
    lastAt.current = new Date(incoming[incoming.length - 1].createdAt).toISOString();
    setMessages((prev) => (incremental ? [...prev, ...incoming] : incoming));
  }, []);

  useEffect(() => {
    if (!channelId) return;
    lastAt.current = null;
    setMessages([]);
    fetchMessages(channelId, false);
    poll.current = setInterval(() => fetchMessages(channelId, true), 6000);
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [channelId, fetchMessages]);

  useEffect(() => {
    const el = scroller.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || !channelId) return;
    setSending(true);
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, body: text })
      });
      if (res.ok) {
        setText("");
        await fetchMessages(channelId, true);
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <div>
      <div className="section-head">
        <h1>Komunikacije</h1>
        <span className="meta">zajednicki kanal · svi mogu pisati</span>
      </div>

      <div className="chat-single">
        <div className="chat-messages" ref={scroller}>
          {messages.length === 0 ? (
            <div className="empty">Nema poruka — napisi prvu zapovijed ili pitanje</div>
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
        <form className="chat-input" onSubmit={send}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Poruka svim jedinicama..."
            maxLength={1000}
          />
          <button className="btn btn-primary" disabled={sending || !channelId}>
            Posalji
          </button>
        </form>
      </div>
    </div>
  );
}
