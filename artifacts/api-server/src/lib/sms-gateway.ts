/**
 * SMS sending. Two backends, tried in this order:
 *
 * 1. Local SMS Gateway — Android phone running https://sms-gate.app on the
 *    shop's WiFi, holding the BVI business SIM. Free per message.
 *    Used when SMS_GATEWAY_URL/USERNAME/PASSWORD are all set.
 *
 * 2. Twilio HTTP API — fallback for the transition window while the phone is
 *    being set up. Used when TWILIO_ACCOUNT_SID + TWILIO_AUTH_TOKEN are set.
 *    Once the gateway is configured, Twilio stops being called automatically.
 *
 * Bodies must already be ≤ 160 chars (one segment) — callers are responsible.
 */

import { logger } from "./logger";

export interface SendSmsResult {
  ok: boolean;
  id?: string;
  via?: "gateway" | "twilio";
  error?: string;
}

export async function sendSms(toE164: string, body: string): Promise<SendSmsResult> {
  // Try local gateway first.
  const gatewayConfigured =
    process.env.SMS_GATEWAY_URL &&
    process.env.SMS_GATEWAY_USERNAME &&
    process.env.SMS_GATEWAY_PASSWORD;

  if (gatewayConfigured) {
    const result = await sendViaGateway(toE164, body);
    if (result.ok) return result;
    logger.warn({ err: result.error }, "[sms] gateway failed — trying Twilio fallback");
  }

  // Fallback (or primary, if gateway not configured): Twilio.
  if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN) {
    return await sendViaTwilio(toE164, body);
  }

  logger.warn("[sms] no SMS backend configured — skipping send");
  return { ok: false, error: "no_backend_configured" };
}

async function sendViaGateway(toE164: string, body: string): Promise<SendSmsResult> {
  const baseUrl  = process.env.SMS_GATEWAY_URL!;
  const username = process.env.SMS_GATEWAY_USERNAME!;
  const password = process.env.SMS_GATEWAY_PASSWORD!;

  const credentials = Buffer.from(`${username}:${password}`).toString("base64");
  const url = `${baseUrl.replace(/\/+$/, "")}/messages`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ message: body, phoneNumbers: [toE164] }),
      signal: controller.signal,
    });

    const text = await resp.text();
    if (!resp.ok) {
      logger.error({ status: resp.status, body: text.slice(0, 300) },
        "[sms] gateway send failed");
      return { ok: false, via: "gateway", error: `http_${resp.status}` };
    }

    let id: string | undefined;
    try { id = JSON.parse(text)?.id; } catch { /* non-JSON 2xx — still success */ }
    logger.info({ to: toE164, id }, "[sms] sent via gateway");
    return { ok: true, via: "gateway", id };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[sms] gateway send error");
    return { ok: false, via: "gateway", error: msg };
  } finally {
    clearTimeout(timeout);
  }
}

async function sendViaTwilio(toE164: string, body: string): Promise<SendSmsResult> {
  const accountSid = process.env.TWILIO_ACCOUNT_SID!;
  const authToken  = process.env.TWILIO_AUTH_TOKEN!;
  const fromNumber = process.env.TWILIO_FROM_NUMBER ?? "+14245448088";

  const params = new URLSearchParams({ To: toE164, From: fromNumber, Body: body });
  const url = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
  const credentials = Buffer.from(`${accountSid}:${authToken}`).toString("base64");

  try {
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: params.toString(),
    });

    const text = await resp.text();
    if (!resp.ok) {
      logger.error({ status: resp.status, body: text.slice(0, 300) },
        "[sms] Twilio send failed");
      return { ok: false, via: "twilio", error: `http_${resp.status}` };
    }

    let sid: string | undefined;
    try { sid = JSON.parse(text)?.sid; } catch { /* ignore */ }
    logger.info({ to: toE164, sid }, "[sms] sent via Twilio");
    return { ok: true, via: "twilio", id: sid };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    logger.error({ err: msg }, "[sms] Twilio send error");
    return { ok: false, via: "twilio", error: msg };
  }
}

/** Lightweight health check — pings the gateway's /health endpoint. */
export async function pingSmsGateway(): Promise<boolean> {
  const baseUrl = process.env.SMS_GATEWAY_URL;
  if (!baseUrl) return false;
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const resp = await fetch(`${baseUrl.replace(/\/+$/, "")}/health`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return resp.ok;
  } catch {
    return false;
  }
}
