import { createHash, randomBytes } from "crypto";

const ENDPOINT = (process.env.PLACETOPAY_ENDPOINT ?? "https://checkout-test.placetopay.com/").replace(/\/$/, "");
const LOGIN    = process.env.PLACETOPAY_LOGIN    ?? "";
const SECRET   = process.env.PLACETOPAY_SECRET_KEY ?? "";

export function isConfigured(): boolean {
  return !!(LOGIN && SECRET);
}

/**
 * Validate the sha256 signature that PlaceToPay includes in webhook notifications.
 * Signature format: "sha256:<hex>" computed as sha256(requestId + status + date + secretKey).
 * Returns false if the signature is missing, malformed, or doesn't match.
 */
export function verifyWebhookSignature(
  requestId:         number,
  statusStatus:      string,
  statusDate:        string,
  receivedSignature: string,
): boolean {
  if (!SECRET) return false;
  const prefix = "sha256:";
  if (!receivedSignature.startsWith(prefix)) return false;
  const received = receivedSignature.slice(prefix.length);
  const expected = createHash("sha256")
    .update(`${requestId}${statusStatus}${statusDate}${SECRET}`)
    .digest("hex");
  return received === expected;
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
  reference:        string,
  description:      string,
  totalUsd:         string,
  returnUrl:        string,
  customerName:     string,
  customerPhone:    string,
  notificationUrl?: string,
  customerEmail?:   string,
  ipAddress?:       string,
  userAgent?:       string,
): Promise<PtpSessionResult> {
  const expiration = new Date(Date.now() + 30 * 60 * 1000).toISOString();

  // Split "First Last" → name + surname for PlaceToPay buyer object.
  // PlaceToPay certification requires separate name/surname fields.
  const nameParts = customerName.trim().split(/\s+/);
  const buyerName    = nameParts[0] ?? customerName;
  const buyerSurname = nameParts.length > 1 ? nameParts.slice(1).join(" ") : buyerName;

  const buyer: Record<string, string> = {
    name:    buyerName,
    surname: buyerSurname,
    mobile:  customerPhone,
  };
  if (customerEmail) buyer.email = customerEmail;

  const body: Record<string, unknown> = {
    auth: buildAuth(),
    buyer,
    payment: {
      reference,
      description,
      amount: { currency: "USD", total: totalUsd },
    },
    expiration,
    returnUrl,
    ipAddress: ipAddress ?? "127.0.0.1",
    userAgent:  userAgent  ?? "Mozilla/5.0 IslandTacos/1.0",
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
  date:              string | null;  // ISO-8601 timestamp of the latest status change
  reasonMessage:     string | null;  // human-readable status message from PlaceToPay
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
    status?:   { status?: string; date?: string; message?: string };
    payment?:  Array<{
      status?:            { status?: string; date?: string; message?: string };
      internalReference?: number;
    }>;
  };

  const norm = (s?: string): PtpStatus => {
    if (s === "APPROVED") return "APPROVED";
    if (s === "REJECTED") return "REJECTED";
    if (s === "PENDING")  return "PENDING";
    if (s === "FAILED")   return "FAILED";
    if (s === "REVERSED") return "REVERSED";
    return "UNKNOWN";
  };

  const last      = data.payment?.at(-1);
  const paymentSt = norm(last?.status?.status);

  // Overall session status takes priority; fall back to last payment attempt
  const sessionSt = norm(data.status?.status);
  const status    = sessionSt !== "UNKNOWN" ? sessionSt : paymentSt;

  // Prefer the payment-level date (most specific); fall back to session-level date
  const date          = last?.status?.date ?? data.status?.date ?? null;
  const reasonMessage = last?.status?.message ?? data.status?.message ?? null;

  return {
    status,
    internalReference: last?.internalReference ?? null,
    date,
    reasonMessage,
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
