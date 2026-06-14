"use client";

import { formatIDR } from "@/lib/constants";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`rounded-2xl bg-white shadow-sm border border-sunset-100 ${className}`}>{children}</div>
  );
}

const BTN_VARIANTS: Record<string, string> = {
  primary: "bg-sunset-500 text-white active:bg-sunset-600 hover:bg-sunset-600",
  secondary: "bg-violet-700 text-white active:bg-violet-800 hover:bg-violet-800",
  teal: "bg-teal-500 text-white active:bg-teal-600 hover:bg-teal-600",
  gold: "bg-gold-400 text-ink active:bg-gold-500 hover:bg-gold-500",
  outline: "border border-sunset-300 text-sunset-700 bg-white active:bg-sunset-50 hover:bg-sunset-50",
  ghost: "text-sunset-700 hover:bg-sunset-50",
  danger: "bg-red-600 text-white hover:bg-red-700",
};

export function Button({
  children,
  variant = "primary",
  className = "",
  full,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof BTN_VARIANTS;
  full?: boolean;
}) {
  return (
    <button
      className={`inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-50 disabled:pointer-events-none ${BTN_VARIANTS[variant]} ${full ? "w-full" : ""} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}

const BADGE_TONES: Record<string, string> = {
  // status meja & umum
  OPEN: "bg-teal-100 text-teal-800",
  BOOKED: "bg-gold-100 text-gold-800",
  OCCUPIED: "bg-sunset-100 text-sunset-800",
  // booking
  PENDING: "bg-gold-100 text-gold-800",
  CONFIRMED: "bg-teal-100 text-teal-800",
  SEATED: "bg-violet-100 text-violet-800",
  COMPLETED: "bg-emerald-100 text-emerald-800",
  CANCELED: "bg-red-100 text-red-700",
  EXPIRED: "bg-gray-200 text-gray-600",
  // order & item
  PAID: "bg-emerald-100 text-emerald-800",
  QUEUED: "bg-gold-100 text-gold-800",
  PREPARING: "bg-sunset-100 text-sunset-800",
  READY: "bg-teal-100 text-teal-800",
  SERVED: "bg-emerald-100 text-emerald-800",
  SETTLED: "bg-emerald-100 text-emerald-800",
  // payable / payroll
  UNPAID: "bg-red-100 text-red-700",
  PARTIAL: "bg-gold-100 text-gold-800",
  DRAFT: "bg-violet-100 text-violet-800",
  // jalur QR Scan & Serve
  AWAITING_PAYMENT: "bg-gold-100 text-gold-800",
  AWAITING_VALIDATION: "bg-teal-100 text-teal-800",
  IN_KITCHEN: "bg-sunset-100 text-sunset-800",
  // peran (RBAC)
  OWNER: "bg-violet-100 text-violet-800",
  MANAGER: "bg-teal-100 text-teal-800",
  CASHIER: "bg-gold-100 text-gold-800",
  KITCHEN: "bg-sunset-100 text-sunset-800",
  CUSTOMER: "bg-gray-100 text-gray-700",
};

export function Badge({ status, label }: { status: string; label?: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold ${BADGE_TONES[status] ?? "bg-gray-100 text-gray-700"}`}
    >
      {label ?? status}
    </span>
  );
}

export function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={`w-full rounded-xl border border-sunset-200 bg-white px-3.5 py-2.5 text-sm outline-none focus:border-sunset-400 focus:ring-2 focus:ring-sunset-100 ${props.className ?? ""}`}
    />
  );
}

export function Label({ children }: { children: React.ReactNode }) {
  return <label className="mb-1 block text-xs font-semibold text-ink/70">{children}</label>;
}

export function Money({ value, className = "" }: { value: number; className?: string }) {
  return <span className={`tabular-nums ${className}`}>{formatIDR(value)}</span>;
}

export function PageTitle({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) {
  return (
    <div className="mb-4 flex items-end justify-between gap-3">
      <div>
        <h1 className="text-xl font-extrabold tracking-tight md:text-2xl">{title}</h1>
        {subtitle && <p className="text-sm text-ink/60">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-sunset-200 bg-white/50 p-8 text-center text-sm text-ink/50">
      {text}
    </div>
  );
}

export function Spinner() {
  return (
    <div className="flex justify-center p-8">
      <div className="h-7 w-7 animate-spin rounded-full border-[3px] border-sunset-200 border-t-sunset-500" />
    </div>
  );
}
