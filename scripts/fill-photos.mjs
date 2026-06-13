// Isi foto demo untuk menu yang BELUM punya foto (tidak menimpa foto yang ada).
// Aman dijalankan ulang. Jalankan: npm run fill-photos
// DATABASE_URL diambil dari environment, atau otomatis dari file .env.
import { readFileSync } from "node:fs";
import { PrismaClient } from "@prisma/client";

if (!process.env.DATABASE_URL) {
  try {
    for (const line of readFileSync(".env", "utf8").split("\n")) {
      const m = line.match(/^\s*DATABASE_URL\s*=\s*"?([^"\n]+)"?\s*$/);
      if (m) {
        process.env.DATABASE_URL = m[1];
        break;
      }
    }
  } catch {
    /* .env opsional */
  }
}

const db = new PrismaClient();

// Keyword foto berdasarkan kata kunci pada nama menu (urut prioritas)
const RULES = [
  [/espresso/i, "espresso"], [/cappu/i, "cappuccino"], [/latte/i, "latte,coffee"],
  [/americano/i, "americano,coffee"], [/kopi|coffee/i, "coffee"], [/matcha/i, "matcha,latte"],
  [/choco|cokelat|coklat/i, "chocolate,drink"], [/tea|teh/i, "tea"], [/juice|jus/i, "juice"],
  [/nasi goreng/i, "fried,rice"], [/nasi/i, "rice,meal"], [/mie|noodle/i, "noodles"],
  [/spaghetti|pasta|carbonara/i, "pasta"], [/steak/i, "steak"], [/ayam|chicken/i, "chicken,food"],
  [/burger/i, "burger"], [/pizza/i, "pizza"], [/fries|kentang/i, "french,fries"],
  [/croissant|roti|bread/i, "croissant,bakery"], [/cake|kue/i, "cake"], [/onion/i, "onion,rings"],
];

function keywordFor(name) {
  for (const [re, kw] of RULES) if (re.test(name)) return kw;
  const w = name.toLowerCase().replace(/[^a-z\s]/g, "").trim().split(/\s+/)[0];
  return w && w.length > 2 ? w : "food";
}

const items = await db.menuItem.findMany({ include: { photos: true } });
let added = 0;
let skipped = 0;
for (let i = 0; i < items.length; i++) {
  const it = items[i];
  if (it.photos.length > 0) {
    skipped++;
    continue; // jangan timpa foto yang sudah ada
  }
  const url = `https://loremflickr.com/600/400/${keywordFor(it.name)}?lock=${i + 1}`;
  await db.menuPhoto.create({ data: { menuItemId: it.id, url, isPrimary: true, sort: 0 } });
  console.log(`+ ${it.name} → ${url}`);
  added++;
}
console.log(`\nSelesai. Foto ditambahkan: ${added}, dilewati (sudah berfoto): ${skipped}.`);
await db.$disconnect();
