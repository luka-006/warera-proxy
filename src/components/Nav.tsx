"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { RANK_LABEL, isCommandRank } from "@/lib/ranks";

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
    { href: "/", label: "Ploca" },
    { href: "/plan", label: "Plan" },
    { href: "/jedinice", label: "Jedinice" }
  ];
  if (isCommandRank(rank)) {
    links.push({ href: "/chat", label: "Kanal" });
  }
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
        <span className="brand-main">
          HR OPERATIVNI CENTAR<span className="sub">HROC</span>
        </span>
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
