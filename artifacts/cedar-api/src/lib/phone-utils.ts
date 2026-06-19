/**
 * BVI phone number utilities used for SMS eligibility checks.
 */

/**
 * Normalise any BVI phone number to E.164 (+1284XXXXXXX).
 * Used for SMS (requires strict E.164).
 */
export function formatBVIPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1284") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("284") && digits.length === 10) return `+1${digits}`;
  if (digits.length === 7) return `+1284${digits}`;
  if (digits.startsWith("11284") && digits.length === 12) return `+${digits.slice(1)}`;
  return `+${digits}`;
}

/**
 * Normalise a phone number for WhatsApp Business API.
 *
 * Meta's API requires digits-only in E.164 format (no + prefix).
 * BVI numbers must include the NANP country code (1) — i.e. 1284XXXXXXX —
 * otherwise Meta cannot look up the WhatsApp account and silently accepts
 * the send request but the message is never delivered.
 *
 * Examples:
 *   "4991449"      → "12844991449"  (7-digit BVI → full E.164)
 *   "2844991449"   → "12844991449"  (10-digit BVI → prepend country code)
 *   "12844991449"  → "12844991449"  (already full E.164, keep)
 *   "+18005551234" → "18005551234"  (strip + only, non-BVI passes through)
 */
export function normalizePhoneForWhatsApp(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 7)                                   return `1284${digits}`;
  if (digits.length === 10 && digits.startsWith("284"))      return `1${digits}`;
  if (digits.startsWith("1284") && digits.length === 11)     return digits;
  return digits;
}

const BVI_LANDLINE_NXX = new Set(["229", "394", "494", "495"]);

/**
 * Returns true if the E.164 number (+1284XXXXXXX) is likely a BVI mobile.
 */
export function isBVIMobile(e164: string): boolean {
  const digits = e164.replace(/\D/g, "");
  if (!digits.startsWith("1284") || digits.length !== 11) return false;
  const nxx = digits.slice(4, 7);
  if (BVI_LANDLINE_NXX.has(nxx)) return false;
  if (nxx === "496") {
    const last4 = parseInt(digits.slice(7), 10);
    return last4 >= 6000;
  }
  return true;
}
