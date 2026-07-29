"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import Help from "@/components/Help";
import { RANK_SHORT, rankOutlineClass } from "@/lib/ranks";
import { avatarStyle, initials } from "@/lib/avatar";
import { flagUrl } from "@/lib/countryColor";

interface Msg {
  id: string;
  body: string;
  pinned: boolean;
  createdAt: string | number | Date;
  author: string;
  authorRank: string;
}

interface Trenutni {
  id: string;
  title: string;
  priority: string;
  battleLink: string | null;
}

interface BattleOpt {
  id: string;
  label: string;
  link: string;
  attCode?: string;
  defCode?: string;
}

const BATTLE_RE = /⟦BATTLE\|([^|]+)\|([^|]+)\|([^\]]+)⟧/g;

function MessageBody({ text }: { text: string }) {
  const parts: ReactNode[] = [];
  let last = 0;
  let m: RegExpExecArray | null;
  const re = new RegExp(BATTLE_RE.source, "g");
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(<span key={`t${last}`}>{text.slice(last, m.index)}</span>);
    const [, , label, url] = m;
    parts.push(
      <a key={`b${m.index}`} href={url} target="_blank" rel="noreferrer" className="battle-chip">
        ⚔ {label}
      </a>
    );
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    const rest = text.slice(last);
    const urlParts = rest.split(/(https?:\/\/\S+)/g);
    urlParts.forEach((p, i) => {
      if (/^https?:\/\/app\.warera\.io\/battle\//.test(p)) {
        parts.push(
          <a key={`u${i}`} href={p} target="_blank" rel="noreferrer" className="battle-chip">
            ⚔ Bitka
          </a>
        );
      } else if (/^https?:\/\//.test(p)) {
        parts.push(
          <a key={`u${i}`} href={p} target="_blank" rel="noreferrer">
            {p.replace(/^https?:\/\/(www\.)?/, "").slice(0, 48)}
          </a>
        );
      } else {
        parts.push(<span key={`u${i}`}>{p}</span>);
      }
    });
  }
  return <>{parts}</>;
}

function AuthorAvatar({ name }: { name: string }) {
  return (
    <span className="avatar-circle sm" style={avatarStyle(name)} title={name}>
      {initials(name)}
    </span>
  );
}

function FlagMini({ code }: { code?: string }) {
  const url = flagUrl(code);
  if (!url) return null;
  // eslint-disable-next-line @next/next/no-img-element
  return <img className="flag xs" src={url} alt={code} />;
}

function MsgMenu({
  m,
  onPin,
  onAddToPlan
}: {
  m: Msg;
  onPin: () => void;
  onAddToPlan: () => void;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  return (
    <div className="dd msg-menu" ref={ref}>
      <button
        type="button"
        className="msg-more"
        onClick={() => setOpen((v) => !v)}
        title="Vise"
        aria-label="Vise"
      >
        ⋮
      </button>
      {open && (
        <div className="dd-menu msg-more-menu right reveal">
          <button
            type="button"
            className="dd-item"
            onClick={() => {
              onPin();
              setOpen(false);
            }}
          >
            {m.pinned ? "Otkvaci" : "Prikvaci"}
          </button>
          <button
            type="button"
            className="dd-item"
            onClick={() => {
              onAddToPlan();
              setOpen(false);
            }}
          >
            Dodaj u plan
          </button>
        </div>
      )}
    </div>
  );
}

export default function ChatClient() {
  const [channelId, setChannelId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [trenutni, setTrenutni] = useState<Trenutni | null>(null);
  const [battles, setBattles] = useState<BattleOpt[]>([]);
  const [battleMenuOpen, setBattleMenuOpen] = useState(false);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [toast, setToast] = useState<string | null>(null);
  const lastAt = useRef<string | null>(null);
  const sendingLock = useRef(false);
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
    fetch("/api/plans")
      .then((r) => r.json())
      .then((d) => {
        const z = (d.plans ?? []).find(
          (p: { type: string }) => p.type === "trenutni" || p.type === "zapovijed"
        );
        if (z)
          setTrenutni({
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

  const mergeMessages = useCallback((incoming: Msg[], incremental: boolean) => {
    setMessages((prev) => {
      if (!incremental) return incoming;
      const ids = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !ids.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
  }, []);

  const fetchMessages = useCallback(
    async (id: string, incremental: boolean) => {
      const url = new URL("/api/chat/messages", window.location.origin);
      url.searchParams.set("channelId", id);
      if (incremental && lastAt.current) url.searchParams.set("after", lastAt.current);
      const res = await fetch(url.toString());
      if (!res.ok) return;
      const data = await res.json();
      const incoming: Msg[] = data.messages ?? [];
      if (!incoming.length) return;
      lastAt.current = new Date(incoming[incoming.length - 1].createdAt).toISOString();
      mergeMessages(incoming, incremental);
    },
    [mergeMessages]
  );

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
    if (!text.trim() || !channelId || sendingLock.current) return;
    sendingLock.current = true;
    setSending(true);
    const payload = text;
    setText("");
    try {
      const res = await fetch("/api/chat/messages", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ channelId, body: payload })
      });
      const data = await res.json();
      if (res.ok && data.message) {
        mergeMessages([data.message], true);
        lastAt.current = new Date(data.message.createdAt).toISOString();
      } else {
        setText(payload);
      }
    } finally {
      sendingLock.current = false;
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

  async function addToPlan(m: Msg) {
    const r = await fetch("/api/plans", {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ appendBody: m.body, messageAuthor: m.author })
    });
    const d = await r.json().catch(() => ({}));
    setToast(r.ok ? "Dodano u trenutni plan" : d.error ?? "Nije uspjelo");
    setTimeout(() => setToast(null), 2500);
  }

  async function openBattleMenu() {
    setBattleMenuOpen((v) => !v);
    if (!battles.length) {
      const r = await fetch("/api/warera/battles").catch(() => null);
      if (r?.ok) {
        const d = await r.json();
        setBattles(
          (d.battles ?? []).map((b: any) => ({
            id: b.id,
            label: b.label,
            link: b.link,
            attCode: b.attacker?.countryCode,
            defCode: b.defender?.countryCode
          }))
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
          <Help text="Interni kanal zapovjednistva. ⋮ na poruci: prikvaci ili dodaj u trenutni plan. Bitka ubacuje chip sa zastavama." />
          <span className="meta">interno planiranje</span>
        </div>
      </div>

      {toast && <div className="notice ok">{toast}</div>}

      <div className="chat-single">
        {trenutni && (
          <a className="cmd-banner" href="/plan" title="Otvori plan">
            <span className="cmd-tag">TRENUTNI PLAN</span>
            <span className="cmd-title">{trenutni.title}</span>
            {trenutni.battleLink && (
              <span
                className="cmd-battle"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  window.open(trenutni.battleLink!, "_blank");
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
                  <b>{m.author}:</b> <MessageBody text={m.body} />
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
              <div
                className={`msg ${m.pinned ? "is-pinned" : ""} ${rankOutlineClass(m.authorRank)}`}
                key={m.id}
              >
                <div className="head">
                  <AuthorAvatar name={m.author} />
                  <span className="author">
                    {m.author}
                    <span className={`rk ${rankOutlineClass(m.authorRank)}`}>
                      {RANK_SHORT[m.authorRank] ?? ""}
                    </span>
                  </span>
                  <span className="time">
                    {new Date(m.createdAt).toLocaleTimeString("hr-HR", {
                      hour: "2-digit",
                      minute: "2-digit"
                    })}
                  </span>
                  <MsgMenu m={m} onPin={() => togglePin(m)} onAddToPlan={() => addToPlan(m)} />
                </div>
                <div className="text">
                  <MessageBody text={m.body} />
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
              title="Ubaci chip bitke"
            >
              ⚔ Bitka
            </button>
            {battleMenuOpen && (
              <div className="dd-menu chat-battle-menu">
                <div className="dd-title">Ubaci bitku</div>
                {battles.length === 0 ? (
                  <div className="dd-empty">Ucitavanje...</div>
                ) : (
                  battles.slice(0, 20).map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      className="dd-item battle-insert"
                      onClick={() => {
                        const token = `⟦BATTLE|${b.id}|${b.label}|${b.link}⟧`;
                        setText((t) => `${t}${t && !t.endsWith(" ") ? " " : ""}${token} `);
                        setBattleMenuOpen(false);
                      }}
                    >
                      <span className="battle-insert-flags">
                        <FlagMini code={b.attCode} />
                        <span className="vs-mini">vs</span>
                        <FlagMini code={b.defCode} />
                      </span>
                      <span className="battle-insert-lbl">{b.label}</span>
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