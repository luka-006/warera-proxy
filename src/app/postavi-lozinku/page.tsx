"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

function SetPasswordForm() {
  const router = useRouter();
  const params = useSearchParams();
  const [callsign, setCallsign] = useState(params.get("callsign") ?? "");
  const [phrase, setPhrase] = useState(params.get("phrase") ?? "");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (password !== confirm) {
      setError("Lozinke se ne podudaraju.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/set-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callsign, phrase, password })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Greska.");
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
        <div className="auth-title">Postavi trajnu lozinku</div>

        <div className="notice">
          Fraza vrijedi jednom. Postavi lozinku koju ces koristiti ubuduce.
        </div>
        {error && <div className="notice err">{error}</div>}

        <form onSubmit={submit}>
          <label className="field">
            <span className="lbl">Pozivni znak</span>
            <input value={callsign} onChange={(e) => setCallsign(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Jednokratna fraza</span>
            <input value={phrase} onChange={(e) => setPhrase(e.target.value)} />
          </label>
          <label className="field">
            <span className="lbl">Nova lozinka (min. 8 znakova)</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <label className="field">
            <span className="lbl">Ponovi lozinku</span>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
            />
          </label>
          <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
            {loading ? "Spremanje..." : "Spremi i udi"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default function PostaviLozinkuPage() {
  return (
    <Suspense fallback={<div className="auth-wrap" />}>
      <SetPasswordForm />
    </Suspense>
  );
}
