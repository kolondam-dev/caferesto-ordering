const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function shortCode(prefix: string, len = 5) {
  let s = "";
  for (let i = 0; i < len; i++) s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  return `${prefix}-${s}`;
}
