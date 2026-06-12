import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/login?next=/dashboard");
  if (!STAFF_ROLES.includes(session.role)) redirect("/");
  return <DashboardShell role={session.role}>{children}</DashboardShell>;
}
