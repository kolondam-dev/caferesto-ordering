import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const db = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash("password123", 10);

  // 5 role users
  const users = [
    { name: "Owner Kafe", email: "owner@caferesto.id", role: "OWNER", baseSalary: 0 },
    { name: "Maya Manager", email: "manager@caferesto.id", role: "MANAGER", baseSalary: 6500000 },
    { name: "Kiki Kasir", email: "cashier@caferesto.id", role: "CASHIER", baseSalary: 4200000 },
    { name: "Dapur Dani", email: "kitchen@caferesto.id", role: "KITCHEN", baseSalary: 4500000 },
    { name: "Budi Pelanggan", email: "customer@caferesto.id", role: "CUSTOMER", baseSalary: 0 },
  ];
  for (const u of users) {
    await db.user.upsert({
      where: { email: u.email },
      update: { role: u.role },
      create: { ...u, passwordHash: hash },
    });
  }

  // Settings (dapat diubah di dashboard)
  const settings: Record<string, string> = {
    bookingConfirmDays: "3", // H-3: batas bayar booking fee
    bookingFeeAmount: "50000", // minimal pembayaran konfirmasi booking
    bookingGraceMinutes: "60", // maksimal menit setelah jadwal untuk buka order
    taxPercent: "10",
    cafeName: "CafeResto",
  };
  for (const [key, value] of Object.entries(settings)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }

  // Tables (+ kode QR statis untuk URL /t/[code])
  for (let i = 1; i <= 10; i++) {
    await db.table.upsert({
      where: { number: i },
      update: {},
      create: { number: i, name: `Meja ${i}`, capacity: i <= 6 ? 4 : i <= 8 ? 6 : 8 },
    });
  }
  const noCode = await db.table.findMany({ where: { code: null } });
  for (const t of noCode) {
    const code = `T${t.number}${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    await db.table.update({ where: { id: t.id }, data: { code } });
  }

  // Menu
  const menu: Record<string, [string, number, string][]> = {
    Coffee: [
      ["Espresso", 22000, "Single shot, biji arabika Gayo"],
      ["Cappuccino", 32000, "Espresso, steamed milk, foam tebal"],
      ["Caffe Latte", 33000, "Espresso dengan susu lembut"],
      ["Es Kopi Susu Aren", 28000, "Kopi susu gula aren, best seller"],
    ],
    "Non-Coffee": [
      ["Matcha Latte", 35000, "Matcha premium Uji"],
      ["Chocolate Frappe", 34000, "Cokelat Belgia, whipped cream"],
      ["Lemon Tea", 25000, "Teh hitam, lemon segar"],
    ],
    "Main Course": [
      ["Nasi Goreng CafeResto", 45000, "Nasi goreng spesial, telur, ayam suwir"],
      ["Spaghetti Carbonara", 52000, "Creamy carbonara, smoked beef"],
      ["Chicken Steak", 58000, "Dada ayam grill, saus mushroom"],
      ["Mie Goreng Seafood", 48000, "Mie goreng udang & cumi"],
    ],
    Snacks: [
      ["French Fries", 25000, "Kentang goreng, saus sambal & mayo"],
      ["Onion Rings", 27000, "Bawang bombay goreng crispy"],
      ["Croissant Butter", 24000, "Croissant butter premium"],
    ],
  };
  let sort = 0;
  for (const [catName, items] of Object.entries(menu)) {
    let cat = await db.menuCategory.findFirst({ where: { name: catName } });
    if (!cat) cat = await db.menuCategory.create({ data: { name: catName, sort: sort++ } });
    for (const [name, price, description] of items) {
      const exists = await db.menuItem.findFirst({ where: { name } });
      if (!exists)
        await db.menuItem.create({ data: { name, price, description, categoryId: cat.id } });
    }
  }

  // PRO: chart of accounts sederhana
  const accounts: [string, string, string][] = [
    ["1000", "Kas", "ASSET"],
    ["1100", "Bank", "ASSET"],
    ["1200", "Persediaan", "ASSET"],
    ["2000", "Utang Usaha", "LIABILITY"],
    ["3000", "Modal", "EQUITY"],
    ["4000", "Pendapatan Penjualan", "REVENUE"],
    ["5000", "Beban Pokok Penjualan", "EXPENSE"],
    ["5100", "Beban Gaji", "EXPENSE"],
    ["5200", "Beban Operasional", "EXPENSE"],
  ];
  for (const [code, name, type] of accounts) {
    await db.account.upsert({ where: { code }, update: {}, create: { code, name, type } });
  }

  // PRO: supplier + inventory contoh
  let supplier = await db.supplier.findFirst({ where: { name: "PT Kopi Nusantara" } });
  if (!supplier)
    supplier = await db.supplier.create({
      data: { name: "PT Kopi Nusantara", contact: "Pak Joko", phone: "081234567890" },
    });
  const inv: [string, string, string, number, number, number][] = [
    ["BEAN-001", "Biji Kopi Arabika Gayo", "kg", 12, 5, 180000],
    ["MILK-001", "Susu Fresh 1L", "ltr", 24, 10, 18000],
    ["SUG-001", "Gula Aren Cair 1L", "ltr", 8, 4, 35000],
  ];
  for (const [sku, name, unit, stock, minStock, costPrice] of inv) {
    await db.inventoryItem.upsert({
      where: { sku },
      update: {},
      create: { sku, name, unit, stock, minStock, costPrice, supplierId: supplier.id },
    });
  }

  console.log("Seed selesai. Login: owner@caferesto.id / password123 (semua user sama)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
