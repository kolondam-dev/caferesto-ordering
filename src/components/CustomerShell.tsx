"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import ConnectionBanner from "@/components/ConnectionBanner";
import CustomerBottomNav, { CUSTOMER_NAV } from "@/components/CustomerBottomNav";

/** Shell customer: bottom-nav di mobile, top-nav di layar besar. */
export default function CustomerShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  return (
    <div className="mx-auto min-h-dvh max-w-screen-lg pb-20 md:pb-6">
      <ConnectionBanner />
      <header className="sticky top-0 z-30 border-b border-sunset-100 bg-cream/90 backdrop-blur">
        <div className="flex items-center justify-between px-4 py-3 md:px-6">
          <Link href="/" className="text-lg font-extrabold">
            <span className="text-sunset-500">Cafe</span>
            <span className="text-violet-700">Resto</span>
          </Link>
          <nav className="hidden items-center gap-1 md:flex">
            {CUSTOMER_NAV.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-1.5 rounded-xl px-3 py-2 text-sm font-semibold ${
                  pathname === href ? "bg-sunset-100 text-sunset-700" : "text-ink/60 hover:bg-sunset-50"
                }`}
              >
                <Icon size={18} weight={pathname === href ? "fill" : "regular"} />
                {label}
              </Link>
            ))}
          </nav>
        </div>
      </header>
      <main className="px-4 py-4 md:px-6">{children}</main>
      <CustomerBottomNav />
    </div>
  );
}
