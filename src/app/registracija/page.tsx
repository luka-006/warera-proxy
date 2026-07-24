"use client";

import { useState } from "react";
import Link from "next/link";

export default function RegistracijaPage() {
  const [callsign, setCallsign] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ callsign: string; phrase: string } | null>(null);
  const [copied, setCopied] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ callsign })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Greska.");
        return;
      }
      setResult(data);
    } catch {
      setError("Greska u vezi. Pokusajte ponovno.");
    } finally {
      setLoading(false);
    }
  }

  function copyPhrase() {
    if (!result) return;
    navigator.clipboard.writeText(result.phrase).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="brand">
          <span className="dot" />
          WARERA<span className="sub">HR OPS</span>
        </div>
        <div className="auth-title">Registracija u postrojbu</div>

        {!result ? (
          <>
            {error && <div className="notice err">{error}</div>}
            <form onSubmit={submit}>
              <label className="field">
                <span className="lbl">Pozivni znak</span>
                <input
                  value={callsign}
                  onChange={(e) => setCallsign(e.target.value)}
                  placeholder="npr. vuk-07"
                  autoFocus
                  autoComplete="off"
                />
              </label>
              <button className="btn btn-primary" style={{ width: "100%" }} disabled={loading}>
                {loading ? "Slanje..." : "Zatrazi pristup"}
              </button>
            </form>
            <p className="muted mt">
              Nakon registracije dobit ces jednokratnu zapovjednu frazu. Racun
              mora odobriti administrator prije prve prijave.
            </p>
            <p className="center mt-sm">
              <Link href="/prijava">Vec imas pristup? Prijava</Link>
            </p>
          </>
        ) : (
          <>
            <div className="notice ok">
              Zapamti ovu frazu. Prikazuje se <strong>samo jednom</strong>.
            </div>
            <div className="phrase-box">{result.phrase}</div>
            <button className="btn" style={{ width: "100%" }} onClick={copyPhrase}>
              {copied ? "Kopirano" : "Kopiraj frazu"}
            </button>
            <p className="muted mt">
              Pozivni znak: <span className="mono">{result.callsign}</span>
              <br />
              Racun ceka odobrenje administratora. Nakon odobrenja prijavi se
              frazom i postavi trajnu lozinku.
            </p>
            <p className="center mt">
              <Link className="btn btn-primary" style={{ display: "inline-block" }} href="/prijava">
                Na prijavu
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
