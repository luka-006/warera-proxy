export const dynamic = "force-dynamic";

// Staticna stranica (ne dira bazu) s uputama za spajanje baze na Vercelu.
export default function PostavljanjePage() {
  const onVercel = process.env.VERCEL === "1";
  const hasUrl = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith("file:"));

  return (
    <div className="content" style={{ maxWidth: 760 }}>
      <div className="section-head">
        <h1>Postavljanje baze</h1>
        <span className="meta">{onVercel ? "okruzenje: vercel" : "okruzenje: lokalno"}</span>
      </div>

      <div className="notice err">
        Baza podataka nije spojena. Aplikacija treba <span className="mono">Turso</span>{" "}
        (libSQL) bazu jer Vercel nema trajni disk za lokalnu datoteku.
      </div>

      <div className="panel panel-pad">
        <h2 style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Koraci (jednokratno, ~5 min)
        </h2>
        <ol style={{ lineHeight: 1.9, paddingLeft: 20 }}>
          <li>
            Otvori <a href="https://turso.tech" target="_blank" rel="noreferrer">turso.tech</a> i
            registriraj se (besplatno).
          </li>
          <li>Kreiraj bazu (npr. <span className="mono">warera-hr</span>).</li>
          <li>
            Kopiraj <strong>Database URL</strong> (pocinje s <span className="mono">libsql://</span>)
            i kreiraj <strong>auth token</strong>.
          </li>
          <li>
            U Vercelu: <span className="mono">Settings → Environment Variables</span> dodaj:
            <ul style={{ marginTop: 8 }}>
              <li><span className="mono">DATABASE_URL</span> = libsql://...turso.io</li>
              <li><span className="mono">DATABASE_AUTH_TOKEN</span> = tvoj token</li>
              <li><span className="mono">SESSION_SECRET</span> = dugi slucajni niz (min. 32 znaka)</li>
              <li><span className="mono">WARERA_API_KEY</span> = tvoj War Era kljuc</li>
              <li><span className="mono">BOOTSTRAP_ADMIN_CALLSIGN</span> = zapovjednik</li>
            </ul>
          </li>
          <li>Napravi <strong>Redeploy</strong> u Vercelu.</li>
          <li>
            Pokreni migraciju i seed prema Turso bazi (lokalno, s istim
            vrijednostima u <span className="mono">.env</span>):
            <div className="phrase-box" style={{ fontSize: 14, textAlign: "left" }}>
              npm run db:push<br />
              npm run db:seed
            </div>
            <span className="muted">
              Seed ispisuje jednokratnu frazu za prvog admina.
            </span>
          </li>
        </ol>
      </div>

      <div className="mt panel panel-pad">
        <h2 style={{ fontFamily: "var(--mono)", fontSize: 14, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 12 }}>
          Trenutno stanje
        </h2>
        <table className="grid">
          <tbody>
            <tr>
              <td>DATABASE_URL (remote libsql)</td>
              <td>
                <span className={`status-pill ${hasUrl ? "status-aktivan" : "status-blokiran"}`}>
                  {hasUrl ? "postavljeno" : "nedostaje"}
                </span>
              </td>
            </tr>
            <tr>
              <td>DATABASE_AUTH_TOKEN</td>
              <td>
                <span className={`status-pill ${process.env.DATABASE_AUTH_TOKEN ? "status-aktivan" : "status-ceka"}`}>
                  {process.env.DATABASE_AUTH_TOKEN ? "postavljeno" : "nedostaje"}
                </span>
              </td>
            </tr>
            <tr>
              <td>WARERA_API_KEY</td>
              <td>
                <span className={`status-pill ${process.env.WARERA_API_KEY ? "status-aktivan" : "status-ceka"}`}>
                  {process.env.WARERA_API_KEY ? "postavljeno" : "nedostaje (ploca radi bez live bitaka)"}
                </span>
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
