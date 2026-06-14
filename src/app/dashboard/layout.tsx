import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { STAFF_ROLES } from "@/lib/constants";
import { getGrants } from "@/lib/permissions";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) redirect("/staff/login?next=/dashboard");
  if (!STAFF_ROLES.includes(session.role)) redirect("/");
  const permissions = await getGrants(session.role);
  return (
    <DashboardShell role={session.role} permissions={permissions}>
      {children}
    </DashboardShell>
  );
}
