const ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function generateRoomCode(): string {
  let out = "";
  const bytes = new Uint8Array(5);
  crypto.getRandomValues(bytes);
  for (let i = 0; i < 5; i++) {
    out += ROOM_CODE_ALPHABET[bytes[i] % ROOM_CODE_ALPHABET.length];
  }
  return out;
}

export function generateSessionToken(): string {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return base64UrlEncode(bytes);
}

const GUEST_NAMES = [
  "neon_ghost",
  "void_falcon",
  "scarlet_buzz",
  "lime_specter",
  "pixel_drifter",
  "ember_owl",
  "cobalt_jinx",
  "amber_dash",
  "midnight_rook",
  "static_lynx",
];
const AVATARS = ["fox", "octo", "dragon", "rex", "uni", "frog", "tiger", "panda", "wolf", "alien", "bot", "ghost"];

export function generateGuestHandle(): string {
  const base = GUEST_NAMES[Math.floor(Math.random() * GUEST_NAMES.length)];
  const suffix = Math.floor(100 + Math.random() * 900);
  return `${base}_${suffix}`;
}

export function pickAvatar(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATARS[Math.abs(hash) % AVATARS.length];
}

export async function hashPassword(password: string, saltB64?: string): Promise<{ hash: string; salt: string }> {
  const saltBytes = saltB64 ? base64Decode(saltB64) : crypto.getRandomValues(new Uint8Array(16));
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt: saltBytes as BufferSource, iterations: 100_000, hash: "SHA-256" },
    keyMaterial,
    256,
  );
  return {
    hash: base64UrlEncode(new Uint8Array(bits)),
    salt: base64UrlEncode(saltBytes),
  };
}

function base64UrlEncode(bytes: Uint8Array): string {
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function base64Decode(b64: string): Uint8Array {
  const norm = b64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = norm.length % 4 === 0 ? "" : "=".repeat(4 - (norm.length % 4));
  const bin = atob(norm + pad);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}
