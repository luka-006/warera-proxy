"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Help from "@/components/Help";
import { RANK_SHORT } from "@/lib/ranks";

interface Msg {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string | number | Date;
  author: string;
  authorRank: string;
}

interface Zapovijed {
  id: string;
  title: string;
  priority: string;
  battleLink: string | null;
}

interface BattleOpt {
  id: string;
  label: string;
  link: string;
}

// Poruke se linkificiraju (linkovi na bitke i sl. postaju klikabilni)
function Linkify({ text }: { text: string }) {
  const parts = text.split(/(https?:\/\/\S+)/g);
  return (
    <>
      {parts.map((p, i) =>
        /^https?:\/\//.test(p) ? (
          <a key={i} href={p} target="_blank" rel="noreferrer">
            {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 60)}
          </a>
        ) : (
          <span key={i}>{p}</span>
        )
      )}
    </>
  );
}

export default function ChatClient() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [zapovijed, setZapovijed] = useState<Zapovijed | null>(null);
  const [battles, setBattles] = useState<BattleOpt[]>([]);
  const [battleMenuOpen, setBattleMenuOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const lastAt = useRef<string | null>(null);
  const scroller = useRef<HTMLDivElement | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);
  const battleMenuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    fetch("/api/chat/channels")
      .then((r) => r.json())
      .then((d) => {
        const ch = (d.channels ?? [])[0];
        if (ch) setChannelId(ch.id);
      });
    // Danasnja zapovijed — prikvacena na vrhu kanala
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        const z = (d.plans ?? []).find((p: any) => p.type === "zapovijed");
        if (z)
          setZapovijed({
            id: z.id,
            title: z.title,
            priority: z.priority,
            battleLink: z.battleLink
          });
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!battleMenuOpen) return;
    function onDoc(e: MouseEvent) {
      if (battleMenuRef.current && !battleMenuRef.current.contains(e.target as Node)) {
        setBattleMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [battleMenuOpen]);

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

  async function togglePin(m: Msg) {
    setMessages((prev) =>
      prev.map((x) => (x.id === m.id ? { ...x, pinned: !x.pinned } : x))
    );
    await fetch("/api/chat/messages", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ messageId: m.id, pinned: !m.pinned })
    }).catch(() => {});
  }

  async function openBattleMenu() {
    setBattleMenuOpen((v) => !v);
    if (!battles.length) {
      const r = await fetch("/api/warera/battles").catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setBattles(
          (d.battles ?? []).map((b: any) => ({ id: b.id, label: b.label, link: b.link }))
        );
      }
    }
  }

  const pinnedMsgs = messages.filter((m) => m.pinned);

  return (
    <div>
      <div className="section-head">
        <h1>Zapovjedni kanal</h1>
        <div className="head-actions">
          <Help text="Interni kanal za planiranje — samo zapovjednistvo. Poruku mozes prikvaciti (pin) da ostane na vrhu. Gumb 'Bitka' ubacuje direktan link aktivne bitke." />
          <span className="meta">interno planiranje</span>
        </div>
      </div>

      <div className="chat-single">
        {zapovijed && (
          <a className="cmd-banner" href="/plan" title="Otvori plan i program">
            <span className="cmd-tag">DANASNJA ZAPOVIJED</span>
            <span className="cmd-title">{zapovijed.title}</span>
            {zapovijed.battleLink && (
              <span
                className="cmd-battle"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(zapovijed.battleLink!, "_blank");
                }}
              >
                ⚔ bitka ↗
              </span>
            )}
          </a>
        )}

        {pinnedMsgs.length > 0 && (
          <div className="pinned-strip">
            {pinnedMsgs.map((m) => (
              <div className="pinned-msg" key={`pin-${m.id}`}>
                <span className="pin-ico">📌</span>
                <span className="pinned-body">
                  <b>{m.author}:</b> <Linkify text={m.body} />
                </span>
                <button className="assign-x" onClick={() => togglePin(m)} title="Otkvaci">
                  ×
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="chat-messages" ref={scroller}>
          {messages.length === 0 ? (
            <div className="empty">Nema poruka — zapocni planiranje</div>
          ) : (
            messages.map((m) => (
              <div className={`msg ${m.pinned ? "is-pinned" : ""}`} key={m.id}>
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
                  <button
                    className={`msg-pin ${m.pinned ? "on" : ""}`}
                    onClick={() => togglePin(m)}
                    title={m.pinned ? "Otkvaci poruku" : "Prikvaci poruku"}
                  >
                    📌
                  </button>
                </div>
                <div className="text">
                  <Linkify text={m.body} />
                </div>
              </div>
            ))
          )}
        </div>

        <form className="chat-input" onSubmit={send}>
          <div className="dd" ref={battleMenuRef}>
            <button
              type="button"
              className="btn btn-sm chat-tool"
              onClick={openBattleMenu}
              title="Ubaci link aktivne bitke"
            >
              ⚔ Bitka
            </button>
            {battleMenuOpen && (
              <div className="dd-menu chat-battle-menu">
                <div className="dd-title">Ubaci link bitke</div>
                {battles.length === 0 ? (
                  <div className="dd-empty">Ucitavanje...</div>
                ) : (
                  battles.slice(0, 20).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="dd-item"
                      onClick={() => {
                        setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${b.label}: ${b.link} `);
                        setBattleMenuOpen(false);
                      }}
                    >
                      {b.label}
                    </button>
                  ))
                )}
              </div>
            )}
          </div>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Poruka zapovjednistvu..."
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
