"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  SquaresFour, Storefront, CookingPot, CalendarCheck, Table, ForkKnife, GearSix,
  ChatCircleDots, Package, Truck, Invoice, Calculator, ClockUser, Money as MoneyIcon, SignOut, Crown,
} from "@phosphor-icons/react";
import { api } from "@/lib/client";
import ConnectionBanner from "@/components/ConnectionBanner";

type Item = { href: string; label: string; icon: React.ElementType; pro?: boolean; roles?: string[] };

const CORE: Item[] = [
  { href: "/dashboard", label: "Ringkasan", icon: SquaresFour },
  { href: "/dashboard/pos", label: "POS Kasir", icon: Storefront, roles: ["OWNER", "MANAGER", "CASHIER"] },
  { href: "/dashboard/kitchen", label: "Kitchen", icon: CookingPot },
  { href: "/dashboard/bookings", label: "Booking", icon: CalendarCheck },
  { href: "/dashboard/tables", label: "Meja", icon: Table },
  { href: "/dashboard/menu", label: "Menu", icon: ForkKnife, roles: ["OWNER", "MANAGER"] },
  { href: "/dashboard/ai", label: "AI Agent", icon: ChatCircleDots, roles: ["OWNER", "MANAGER"] },
  { href: "/dashboard/settings", label: "Pengaturan", icon: GearSix, roles: ["OWNER", "MANAGER"] },
];

const PRO: Item[] = [
  { href: "/dashboard/pro/inventory", label: "Inventory", icon: Package, pro: true },
  { href: "/dashboard/pro/suppliers", label: "Supplier", icon: Truck, pro: true },
  { href: "/dashboard/pro/payables", label: "Payables", icon: Invoice, pro: true },
  { href: "/dashboard/pro/accounting", label: "Akuntansi", icon: Calculator, pro: true },
  { href: "/dashboard/pro/attendance", label: "Absensi", icon: ClockUser, pro: true },
  { href: "/dashboard/pro/payroll", label: "Payroll", icon: MoneyIcon, pro: true },
];

// Item utama untuk bottom-nav mobile
const MOBILE = [CORE[0], CORE[1], CORE[2], CORE[3], CORE[6]];

export default function DashboardShell({ children, role }: { children: React.ReactNode; role: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const visible = (items: Item[]) => items.filter((i) => !i.roles || i.roles.includes(role));

  async function logout() {
    await api("/api/auth/logout", { method: "POST" });
    router.push("/staff/login");
  }

  const NavLink = ({ item }: { item: Item }) => {
    const active = pathname === item.href;
    const Icon = item.icon;
    return (
      <Link
        href={item.href}
        className={`flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold transition-colors ${
          active ? "bg-sunset-500 text-white" : "text-ink/70 hover:bg-sunset-50"
        }`}
      >
        <Icon size={18} weight={active ? "fill" : "regular"} />
        <span className="truncate">{item.label}</span>
        {item.pro && (
          <span className="ml-auto rounded-full bg-gold-100 px-1.5 py-0.5 text-[9px] font-bold text-gold-800">PRO</span>
        )}
      </Link>
    );
  };

  return (
    <div className="backoffice flex min-h-dvh">
      <ConnectionBanner />
      {/* Sidebar — layar md+ */}
      <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col gap-1 overflow-y-auto border-r border-sunset-100 bg-white p-4 md:flex">
        <Link href="/dashboard" className="mb-3 px-2 text-lg font-extrabold">
          <span className="text-sunset-500">Cafe</span>
          <span className="text-violet-700">Resto</span>
          <span className="ml-1.5 text-[10px] font-bold text-ink/40">DASHBOARD</span>
        </Link>
        {visible(CORE).map((i) => (
          <NavLink key={i.href} item={i} />
        ))}
        <div className="mt-3 mb-1 flex items-center gap-1.5 px-3 text-[10px] font-bold uppercase tracking-wider text-ink/40">
          <Crown size={12} weight="fill" className="text-gold-500" /> Fitur PRO
        </div>
        {visible(PRO).map((i) => (
          <NavLink key={i.href} item={i} />
        ))}
        <button
          onClick={logout}
          className="mt-auto flex items-center gap-2.5 rounded-xl px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-50"
        >
          <SignOut size={18} /> Keluar
        </button>
      </aside>

      <div className="min-w-0 flex-1 pb-20 md:pb-0">
        <header className="sticky top-0 z-30 flex items-center justify-between border-b border-sunset-100 bg-cream/90 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/dashboard" className="text-base font-extrabold">
            <span className="text-sunset-500">Cafe</span>
            <span className="text-violet-700">Resto</span>
          </Link>
          <button onClick={logout} className="text-red-600">
            <SignOut size={20} />
          </button>
        </header>
        <main className="p-4 md:p-6">{children}</main>
      </div>

      {/* Bottom nav — mobile */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-sunset-100 bg-white/95 backdrop-blur md:hidden">
        <div
          className="grid"
          style={{ gridTemplateColumns: `repeat(${visible(MOBILE).length}, minmax(0, 1fr))` }}
        >
          {visible(MOBILE).map((item) => {
            const active = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.href} href={item.href} className="flex flex-col items-center gap-0.5 py-2.5">
                <Icon size={22} weight={active ? "fill" : "regular"} className={active ? "text-sunset-500" : "text-ink/40"} />
                <span className={`text-[9px] font-semibold ${active ? "text-sunset-600" : "text-ink/40"}`}>
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
