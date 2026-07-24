import { NextRequest, NextResponse } from "next/server";

// Na Vercelu nema lokalne datoteke (local.db). Ako baza nije ispravno
// konfigurirana (nedostaje DATABASE_URL ili je jos "file:..."), umjesto
// rusenja s 500 preusmjeravamo na stranicu s uputama za postavljanje.
export function middleware(req: NextRequest) {
  const onVercel = process.env.VERCEL === "1";
  const url = process.env.DATABASE_URL ?? "";
  const misconfigured = onVercel && (url === "" || url.startsWith("file:"));

  if (misconfigured && !req.nextUrl.pathname.startsWith("/postavljanje")) {
    return NextResponse.redirect(new URL("/postavljanje", req.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|postavljanje).*)"]
};
