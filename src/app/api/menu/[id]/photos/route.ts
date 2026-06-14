import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { isSession } from "@/lib/auth";
import { requirePermission } from "@/lib/permissions";
import { saveUpload, storageMode } from "@/lib/storage";

type Ctx = { params: Promise<{ id: string }> };

const MAX_SIZE = 3 * 1024 * 1024; // 3MB
const ALLOWED = ["image/jpeg", "image/png", "image/webp"];

export async function GET(_req: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const photos = await db.menuPhoto.findMany({
    where: { menuItemId: id },
    orderBy: [{ isPrimary: "desc" }, { sort: "asc" }],
  });
  return NextResponse.json({ photos });
}

/**
 * Tambah foto katalog menu. Dua mode:
 * - multipart/form-data dengan field "file" → disimpan ke <root>/uploads/menu,
 *   disajikan via /api/uploads (storage lokal; pindah ke S3/R2 cukup ganti saveFile)
 * - JSON { url } → pakai URL eksternal
 * Foto pertama otomatis menjadi foto utama.
 */
export async function POST(req: NextRequest, ctx: Ctx) {
  const guard = await requirePermission("menu.edit");
  if (!isSession(guard)) return guard;
  const { id } = await ctx.params;

  const item = await db.menuItem.findUnique({ where: { id } });
  if (!item) return NextResponse.json({ error: "Menu tidak ditemukan" }, { status: 404 });

  try {
    let url: string;
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("multipart/form-data")) {
      // Di serverless (Vercel) filesystem read-only — upload file hanya bisa bila
      // R2 dikonfigurasi. Beri pesan jelas alih-alih error tanpa body.
      if (storageMode() === "local" && process.env.VERCEL) {
        return NextResponse.json(
          { error: "Upload file butuh penyimpanan R2. Isi env R2_* di Vercel, atau gunakan opsi 'tempel URL foto'." },
          { status: 400 }
        );
      }
      const form = await req.formData();
      const file = form.get("file");
      if (!(file instanceof File)) return NextResponse.json({ error: "File tidak ditemukan" }, { status: 400 });
      if (!ALLOWED.includes(file.type))
        return NextResponse.json({ error: "Format harus JPG/PNG/WebP" }, { status: 400 });
      if (file.size > MAX_SIZE) return NextResponse.json({ error: "Maksimal 3MB" }, { status: 400 });
      url = await saveFile(id, file);
    } else {
      const body = (await req.json().catch(() => ({}))) as { url?: string };
      if (!body.url?.trim()) return NextResponse.json({ error: "URL foto kosong" }, { status: 400 });
      url = body.url.trim();
    }

    const count = await db.menuPhoto.count({ where: { menuItemId: id } });
    const photo = await db.menuPhoto.create({
      data: { menuItemId: id, url, isPrimary: count === 0, sort: count },
    });
    return NextResponse.json({ photo }, { status: 201 });
  } catch (e) {
    // Selalu balas JSON agar client tidak crash saat parse respons
    return NextResponse.json({ error: `Gagal mengunggah foto: ${(e as Error).message}` }, { status: 500 });
  }
}

async function saveFile(menuItemId: string, file: File) {
  const ext = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  const name = `${menuItemId}-${Date.now()}.${ext}`;
  const saved = await saveUpload("menu", name, Buffer.from(await file.arrayBuffer()), file.type);
  return saved.url;
}
