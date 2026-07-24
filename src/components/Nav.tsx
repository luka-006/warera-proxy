"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

const RANK_LABEL: Record<string, string> = {
  admin: "Administrator",
  zapovjednik: "Zapovjednik",
  vojnik: "Vojnik"
};

export default function Nav({
  callsign,
  rank
}: {
  callsign: string;
  rank: string;
}) {
  const pathname = usePathname();
  const router = useRouter();

  const links = [
    { href: "/", label: "Nadzorna ploca" },
    { href: "/chat", label: "Komunikacije" }
  ];
  if (rank === "admin") {
    links.push({ href: "/admin", label: "Sucelje" });
  }

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/prijava");
    router.refresh();
  }

  return (
    <header className="topbar">
      <Link href="/" className="brand" style={{ textDecoration: "none" }}>
        <span className="dot" />
        WARERA<span className="sub">HR OPS</span>
      </Link>
      <nav className="nav">
        {links.map((l) => {
          const active = l.href === "/" ? pathname === "/" : pathname.startsWith(l.href);
          return (
            <Link key={l.href} href={l.href} className={active ? "active" : ""}>
              {l.label}
            </Link>
          );
        })}
      </nav>
      <div className="topbar-right">
        <span className="mono">{callsign}</span>
        <span className="rank-tag">{RANK_LABEL[rank] ?? rank}</span>
        <button className="btn btn-sm" onClick={logout}>
          Odjava
        </button>
      </div>
    </header>
  );
}
