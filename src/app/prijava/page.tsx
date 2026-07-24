"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function PrijavaPage() {
  const router = useRouter();
  const [callsign, setCallsign] = useState("");
  const [secret, setSecret] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callsign, secret })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Greska.");
        return;
      }
      if (data.mustSetPassword) {
        const params = new URLSearchParams({ callsign, phrase: secret });
        router.push(`/postavi-lozinku?${params.toString()}`);
        return;
      }
      router.push("/");
      router.refresh();
    } catch {
      setError("Greska u vezi. Pokusajte ponovno.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="dot" />
          WARERA<span className="sub">HR OPS</span>
        </div>
        <div className="auth-title">Prijava u zapovjedni centar</div>

        {error && <div className="notice err">{error}</div>}
        <form onSubmit={submit}>
          <label className="field">
            <span className="lbl">Pozivni znak</span>
            <input
              value={callsign}
              onChange={(e) => setCallsign(e.target.value)}
              autoFocus
              autoComplete="username"
            />
          </label>
          <label className="field">
            <span className="lbl">Lozinka ili jednokratna fraza</span>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              autoComplete="current-password"
            />
          </label>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Prijava..." : "Prijavi se"}
          </button>
        </form>
        <p className="center mt">
          <Link href="/registracija">Nemas pristup? Registracija</Link>
        </p>
      </div>
    </div>
  );
}
