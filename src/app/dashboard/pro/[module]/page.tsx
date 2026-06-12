"use client";

import { use } from "react";
import { notFound } from "next/navigation";
import {
  Package, Truck, Invoice, Calculator, ClockUser, Money, Crown, CheckCircle,
} from "@phosphor-icons/react";
import { Card, PageTitle } from "@/components/ui";

type ModuleDef = {
  title: string;
  desc: string;
  icon: React.ElementType;
  endpoints: { method: string; path: string; desc: string }[];
};

const MODULES: Record<string, ModuleDef> = {
  inventory: {
    title: "Inventory",
    desc: "Master bahan baku, stok berjalan, batas minimum, dan mutasi stok (masuk/keluar/penyesuaian). Stok menipis otomatis muncul di Ringkasan & AI Agent.",
    icon: Package,
    endpoints: [
      { method: "GET", path: "/api/pro/inventory", desc: "Daftar item + supplier + 5 mutasi terakhir" },
      { method: "POST", path: "/api/pro/inventory", desc: "Tambah item (sku, name, unit, stock, minStock, costPrice)" },
      { method: "PATCH", path: "/api/pro/inventory/:id", desc: "Ubah item" },
      { method: "POST", path: "/api/pro/inventory/:id/movements", desc: "Mutasi stok IN / OUT / ADJUST" },
      { method: "GET", path: "/api/pro/inventory/:id/movements", desc: "Riwayat mutasi" },
    ],
  },
  suppliers: {
    title: "Supplier",
    desc: "Master pemasok terhubung ke inventory dan payables.",
    icon: Truck,
    endpoints: [
      { method: "GET", path: "/api/pro/suppliers", desc: "Daftar supplier + jumlah item & payable" },
      { method: "POST", path: "/api/pro/suppliers", desc: "Tambah supplier" },
      { method: "PATCH", path: "/api/pro/suppliers/:id", desc: "Ubah supplier" },
      { method: "DELETE", path: "/api/pro/suppliers/:id", desc: "Hapus (ditolak bila punya payable)" },
    ],
  },
  payables: {
    title: "Payables (Utang Supplier)",
    desc: "Pencatatan invoice supplier, jatuh tempo, pembayaran sebagian/lunas. Pembayaran otomatis membuat jurnal Utang Usaha vs Kas.",
    icon: Invoice,
    endpoints: [
      { method: "GET", path: "/api/pro/payables", desc: "Daftar utang urut jatuh tempo" },
      { method: "POST", path: "/api/pro/payables", desc: "Catat invoice (supplierId, invoiceNo, amount, dueDate)" },
      { method: "PATCH", path: "/api/pro/payables/:id", desc: 'action:"pay" + amount → bayar sebagian/lunas + auto-jurnal' },
    ],
  },
  accounting: {
    title: "Simple Accounting",
    desc: "Chart of accounts, jurnal umum double-entry (debit = kredit divalidasi), dan saldo berjalan per akun (trial balance).",
    icon: Calculator,
    endpoints: [
      { method: "GET", path: "/api/pro/accounting/accounts", desc: "CoA + saldo berjalan" },
      { method: "POST", path: "/api/pro/accounting/accounts", desc: "Tambah akun" },
      { method: "GET", path: "/api/pro/accounting/journal", desc: "Daftar jurnal + baris akun" },
      { method: "POST", path: "/api/pro/accounting/journal", desc: "Jurnal manual (balance divalidasi)" },
    ],
  },
  attendance: {
    title: "Attendance (Absensi)",
    desc: "Clock-in / clock-out per staff dengan validasi shift terbuka. Admin bisa melihat semua riwayat.",
    icon: ClockUser,
    endpoints: [
      { method: "GET", path: "/api/pro/attendance", desc: "Riwayat saya (admin: ?all=1 untuk semua)" },
      { method: "POST", path: "/api/pro/attendance", desc: 'action:"clock-in" / "clock-out"' },
    ],
  },
  payroll: {
    title: "Payroll & Salary",
    desc: "Periode gaji, payslip otomatis dari baseSalary user, tunjangan & potongan, dan pembayaran dengan auto-jurnal Beban Gaji vs Kas.",
    icon: Money,
    endpoints: [
      { method: "GET", path: "/api/pro/payroll", desc: "Daftar periode + payslip" },
      { method: "POST", path: "/api/pro/payroll", desc: "Buat periode → generate payslip semua staff bergaji" },
      { method: "PATCH", path: "/api/pro/payroll/payslips/:id", desc: 'Ubah allowance/deduction, atau action:"pay"' },
    ],
  },
};

const METHOD_TONE: Record<string, string> = {
  GET: "bg-teal-100 text-teal-800",
  POST: "bg-sunset-100 text-sunset-800",
  PATCH: "bg-gold-100 text-gold-800",
  DELETE: "bg-red-100 text-red-700",
};

export default function ProModulePage({ params }: { params: Promise<{ module: string }> }) {
  const { module } = use(params);
  const def = MODULES[module];
  if (!def) notFound();
  const Icon = def.icon;

  return (
    <div className="mx-auto max-w-3xl">
      <PageTitle title={def.title} />
      <Card className="overflow-hidden">
        <div className="bg-gradient-to-r from-violet-700 to-sunset-500 p-6 text-white">
          <div className="mb-2 flex items-center gap-2">
            <Icon size={28} weight="fill" />
            <span className="flex items-center gap-1 rounded-full bg-gold-400 px-2.5 py-0.5 text-[11px] font-extrabold text-ink">
              <Crown size={12} weight="fill" /> PRO
            </span>
          </div>
          <p className="text-sm leading-relaxed text-white/90">{def.desc}</p>
          <p className="mt-3 flex items-center gap-1.5 text-xs font-bold">
            <CheckCircle size={16} weight="fill" className="text-emerald-300" />
            Backend siap & teruji — UI lengkap menyusul di paket PRO
          </p>
        </div>
        <div className="p-5">
          <h2 className="mb-3 text-sm font-extrabold text-ink/60">API ENDPOINTS TERSEDIA</h2>
          <div className="space-y-2">
            {def.endpoints.map((e) => (
              <div key={`${e.method}-${e.path}`} className="flex flex-wrap items-center gap-2 rounded-xl bg-cream px-3 py-2">
                <span className={`rounded-md px-2 py-0.5 text-[10px] font-extrabold ${METHOD_TONE[e.method]}`}>{e.method}</span>
                <code className="text-xs font-bold">{e.path}</code>
                <span className="w-full text-xs text-ink/50 sm:w-auto sm:flex-1 sm:text-right">{e.desc}</span>
              </div>
            ))}
          </div>
        </div>
      </Card>
    </div>
  );
}
