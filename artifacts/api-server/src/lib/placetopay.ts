import { createHash, randomBytes } from "crypto";

const ENDPOINT = (process.env.PLACETOPAY_ENDPOINT ?? "https://checkout-test.placetopay.com/").replace(/\/$/, "");
const LOGIN    = process.env.PLACETOPAY_LOGIN    ?? "";
const SECRET   = process.env.PLACETOPAY_SECRET_KEY ?? "";

export function isConfigured(): boolean {
  return !!(LOGIN && SECRET);
}

function buildAuth() {
  const seed     = new Date().toISOString();
  const rawNonce = randomBytes(16);
  const nonce    = rawNonce.toString("base64");
  // tranKey = Base64( SHA-256( rawNonce || seed || secretKey ) )
  // NOTE: secret key is concatenated raw (no SHA-1 pre-hashing) — confirmed by
  // exhaustive variant testing against checkout-test.placetopay.com (Jun 2026).
  const tranKey = createHash("sha256")
    .update(Buffer.concat([rawNonce, Buffer.from(seed), Buffer.from(SECRET)]))
    .digest("base64");
  return { login: LOGIN, seed, nonce, tranKey };
}

export interface PtpSessionResult {
  requestId:  number;
  processUrl: string;
}

export async function createSession(
  reference:       string,
  description:     string,
  totalUsd:        string,
  returnUrl:       string,
  customerName:    string,
  customerPhone:   string,
  notificationUrl?: string,
): Promise<PtpSessionResult> {
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  const body: Record<string, unknown> = {
    auth: buildAuth(),
    buyer: {
      name:   customerName,
      mobile: customerPhone,
    },
    payment: {
      reference,
      description,
      amount: { currency: "USD", total: totalUsd },
    },
    expiration,
    returnUrl,
    ipAddress: "127.0.0.1",
    userAgent:  "IslandTacos/1.0",
  };

  if (notificationUrl) body.notificationUrl = notificationUrl;

  const res  = await fetch(`${ENDPOINT}/api/session`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify(body),
  });
  const data = await res.json() as {
    status?:     { status?: string; message?: string };
    requestId?:  number;
    processUrl?: string;
  };

  if (data.status?.status !== "OK" || !data.requestId || !data.processUrl) {
    throw new Error(`Placetopay session failed: ${data.status?.message ?? JSON.stringify(data)}`);
  }

  return { requestId: data.requestId, processUrl: data.processUrl };
}

export type PtpStatus = "PENDING" | "APPROVED" | "REJECTED" | "FAILED" | "REVERSED" | "UNKNOWN";

export interface PtpSessionDetail {
  status:            PtpStatus;
  internalReference: number | null;  // payment-level reference needed for reversals
}

export async function getSessionStatus(requestId: number): Promise<PtpStatus> {
  const detail = await getSessionDetail(requestId);
  return detail.status;
}

export async function getSessionDetail(requestId: number): Promise<PtpSessionDetail> {
  const res  = await fetch(`${ENDPOINT}/api/session/${requestId}`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ auth: buildAuth() }),
  });
  const data = await res.json() as {
    status?:   { status?: string };
    payment?:  Array<{ status?: { status?: string }; internalReference?: number }>;
  };

  const norm = (s?: string): PtpStatus => {
    if (s === "APPROVED") return "APPROVED";
    if (s === "REJECTED") return "REJECTED";
    if (s === "PENDING")  return "PENDING";
    if (s === "FAILED")   return "FAILED";
    if (s === "REVERSED") return "REVERSED";
    return "UNKNOWN";
  };

  const last = data.payment?.at(-1);
  const paymentSt = norm(last?.status?.status);

  // Overall session status takes priority; fall back to last payment attempt
  const sessionSt = norm(data.status?.status);
  const status    = sessionSt !== "UNKNOWN" ? sessionSt : paymentSt;

  return {
    status,
    internalReference: last?.internalReference ?? null,
  };
}

/**
 * Reverse (void/refund) a previously APPROVED PlaceToPay payment.
 * Requires the payment-level internalReference (not the session requestId).
 * Returns true if PlaceToPay accepted the reversal, false otherwise.
 */
export async function reversePayment(internalReference: number): Promise<boolean> {
  const res  = await fetch(`${ENDPOINT}/api/reverse`, {
    method:  "POST",
    headers: { "Content-Type": "application/json" },
    body:    JSON.stringify({ auth: buildAuth(), internalReference }),
  });
  const data = await res.json() as { status?: { status?: string; message?: string } };
  return data.status?.status === "REVERSED";
}

/**
 * Convenience: query session to get internalReference then reverse it.
 * Returns { reversed, message } — reversed=false means PlaceToPay declined
 * or the session wasn't in a reversible state (no APPROVED payment found).
 */
export async function reverseSession(requestId: number): Promise<{ reversed: boolean; message?: string }> {
  const detail = await getSessionDetail(requestId);
  if (detail.status !== "APPROVED") {
    return { reversed: false, message: `Session not in APPROVED state (${detail.status})` };
  }
  if (!detail.internalReference) {
    return { reversed: false, message: "No internalReference found on session" };
  }
  const ok = await reversePayment(detail.internalReference);
  return { reversed: ok, message: ok ? undefined : "PlaceToPay did not accept the reversal" };
}
