// Single-user auth: password from env, HMAC-signed expiry token in an httpOnly cookie.
// Uses Web Crypto only, so the same code runs in route handlers and the proxy.

export const SESSION_COOKIE = "alex_session";
const SESSION_DAYS = 7;

function secret(): string {
  const s = process.env.SESSION_SECRET;
  if (!s) throw new Error("SESSION_SECRET is not set — see README setup");
  return s;
}

async function hmac(message: string, key: string): Promise<string> {
  const enc = new TextEncoder();
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    enc.encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, enc.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createSessionToken(): Promise<{
  token: string;
  maxAge: number;
}> {
  const exp = Date.now() + SESSION_DAYS * 24 * 60 * 60 * 1000;
  const sig = await hmac(String(exp), secret());
  return { token: `${exp}.${sig}`, maxAge: SESSION_DAYS * 24 * 60 * 60 };
}

export async function verifySessionToken(
  token: string | undefined,
): Promise<boolean> {
  if (!token) return false;
  const dot = token.indexOf(".");
  if (dot < 1) return false;
  const exp = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  let expected: string;
  try {
    expected = await hmac(exp, secret());
  } catch {
    return false;
  }
  if (expected.length !== sig.length) return false;
  // constant-time compare
  let diff = 0;
  for (let i = 0; i < expected.length; i++)
    diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i);
  return diff === 0;
}

export function checkPassword(input: string): boolean {
  const pw = process.env.ALEX_PASSWORD;
  if (!pw) throw new Error("ALEX_PASSWORD is not set — see README setup");
  if (input.length !== pw.length) return false;
  let diff = 0;
  for (let i = 0; i < pw.length; i++)
    diff |= pw.charCodeAt(i) ^ input.charCodeAt(i);
  return diff === 0;
}
