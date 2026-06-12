/**
 * Encoder ESC/POS minimal untuk thermal printer 58/80mm (Epson-compatible:
 * EPPOS, Iware, Xprinter, dsb). Output berupa byte mentah yang dikirim ke
 * printer jaringan via port RAW 9100 (lihat sendToPrinter).
 */

const ESC = 0x1b;
const GS = 0x1d;

export class EscPosBuilder {
  private bytes: number[] = [];

  constructor() {
    this.bytes.push(ESC, 0x40); // init
  }

  align(mode: "left" | "center" | "right") {
    this.bytes.push(ESC, 0x61, mode === "center" ? 1 : mode === "right" ? 2 : 0);
    return this;
  }

  bold(on: boolean) {
    this.bytes.push(ESC, 0x45, on ? 1 : 0);
    return this;
  }

  doubleSize(on: boolean) {
    this.bytes.push(GS, 0x21, on ? 0x11 : 0x00);
    return this;
  }

  line(text = "") {
    // Non-ASCII (emoji dsb.) diganti agar aman di code page default printer
    for (const ch of text) {
      const c = ch.charCodeAt(0);
      this.bytes.push(c >= 0x20 && c <= 0x7e ? c : 0x20);
    }
    this.bytes.push(0x0a);
    return this;
  }

  /** Baris dua kolom rata kiri-kanan selebar `width` karakter (80mm ≈ 48, 58mm ≈ 32). */
  row(left: string, right: string, width = 32) {
    const space = Math.max(1, width - left.length - right.length);
    return this.line(left.slice(0, width - right.length - 1) + " ".repeat(space) + right);
  }

  divider(width = 32) {
    return this.line("-".repeat(width));
  }

  feed(n = 3) {
    this.bytes.push(ESC, 0x64, n);
    return this;
  }

  cut() {
    this.bytes.push(GS, 0x56, 0x42, 0x00); // partial cut
    return this;
  }

  build(): Buffer {
    return Buffer.from(this.bytes);
  }
}

/** Kirim byte ESC/POS ke printer jaringan (RAW/JetDirect port 9100). */
export async function sendToPrinter(host: string, port: number, data: Buffer): Promise<void> {
  const net = await import("net");
  return new Promise((resolve, reject) => {
    const socket = net.createConnection({ host, port, timeout: 5000 });
    socket.on("connect", () => {
      socket.write(data, (err) => {
        if (err) reject(err);
        else socket.end(resolve as () => void);
      });
    });
    socket.on("timeout", () => {
      socket.destroy();
      reject(new Error(`Printer ${host}:${port} tidak merespons (timeout 5 dtk)`));
    });
    socket.on("error", (err) => reject(new Error(`Gagal terhubung ke printer: ${err.message}`)));
  });
}
