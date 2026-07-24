// Ponovno se montira na svaku navigaciju -> vojna "briefing" animacija ulaska
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="page-anim">{children}</div>;
}
