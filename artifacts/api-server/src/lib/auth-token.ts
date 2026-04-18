import { createHmac } from "crypto";

const SECRET = process.env["SESSION_SECRET"] ?? "island-tacos-dev-secret";
const COOKIE_NAME = "it_auth";
const MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 hours
const MAX_AGE_S = 12 * 60 * 60;

interface TokenPayload {
  staffAuthed: boolean;
  exp: number;
}

function sign(payload: string): string {
  return createHmac("sha256", SECRET).update(payload).digest("base64url");
}

export function createToken(): string {
  const data: TokenPayload = { staffAuthed: true, exp: Date.now() + MAX_AGE_MS };
  const payload = Buffer.from(JSON.stringify(data)).toString("base64url");
  return `${payload}.${sign(payload)}`;
}

export function verifyToken(token: string): TokenPayload | null {
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx === -1) return null;
  const payload = token.slice(0, dotIdx);
  const sig = token.slice(dotIdx + 1);
  if (sig !== sign(payload)) return null;
  try {
    const data = JSON.parse(Buffer.from(payload, "base64url").toString()) as TokenPayload;
    if (Date.now() > data.exp) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCookies(cookieHeader: string): Record<string, string> {
  return Object.fromEntries(
    cookieHeader.split(";").map((c) => {
      const [k, ...v] = c.trim().split("=");
      return [k.trim(), decodeURIComponent(v.join("="))];
    })
  );
}

export function makeSetCookieHeader(token: string): string {
  const isProduction = process.env["NODE_ENV"] === "production";
  const parts = [
    `${COOKIE_NAME}=${token}`,
    "HttpOnly",
    "Path=/",
    `Max-Age=${MAX_AGE_S}`,
    `SameSite=${isProduction ? "None" : "Lax"}`,
  ];
  if (isProduction) parts.push("Secure");
  return parts.join("; ");
}

export function makeClearCookieHeader(): string {
  return `${COOKIE_NAME}=; HttpOnly; Path=/; Max-Age=0; SameSite=Lax`;
}

export function getTokenFromRequest(cookieHeader?: string): TokenPayload | null {
  if (!cookieHeader) return null;
  const cookies = parseCookies(cookieHeader);
  const token = cookies[COOKIE_NAME];
  if (!token) return null;
  return verifyToken(token);
}
