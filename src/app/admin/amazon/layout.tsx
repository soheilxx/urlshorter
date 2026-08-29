import { AmazonSubNav } from "@/components/admin/amazon/amazon-subnav";
import { getSession } from "@/lib/auth";

/** Gemeinsames Layout des Amazon-Ranking-Moduls: Unternavigation über allen Seiten. */
export default async function AmazonLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  return (
    <div className="space-y-5">
      <AmazonSubNav role={session?.role ?? "VIEWER"} />
      {children}
    </div>
  );
}
