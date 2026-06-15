"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ForkKnife, CalendarCheck, Receipt, User } from "@phosphor-icons/react";

export const CUSTOMER_NAV = [
  { href: "/", label: "Menu", icon: ForkKnife },
  { href: "/book", label: "Booking", icon: CalendarCheck },
  { href: "/orders", label: "Order", icon: Receipt },
  { href: "/account", label: "Akun", icon: User },
];

/**
 * Bottom-nav customer (mobile). Dipakai di CustomerShell dan halaman order QR
 * agar tidak ada halaman buntu setelah order selesai.
 */
export default function CustomerBottomNav() {
  const pathname = usePathname();
  return (
    <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-sunset-100 bg-white/95 backdrop-blur md:hidden">
      <div className="mx-auto grid max-w-screen-lg grid-cols-4">
        {CUSTOMER_NAV.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} className="flex flex-col items-center gap-0.5 py-2.5">
              <Icon size={22} weight={active ? "fill" : "regular"} className={active ? "text-sunset-500" : "text-ink/40"} />
              <span className={`text-[10px] font-semibold ${active ? "text-sunset-600" : "text-ink/40"}`}>{label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
