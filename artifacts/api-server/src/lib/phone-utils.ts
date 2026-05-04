/**
 * BVI phone number utilities used for SMS eligibility checks.
 */

/**
 * Normalise any BVI phone number to E.164 (+1284XXXXXXX).
 */
export function formatBVIPhone(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (digits.startsWith("1284") && digits.length === 11) return `+${digits}`;
  if (digits.startsWith("284") && digits.length === 10) return `+1${digits}`;
  if (digits.length === 7) return `+1284${digits}`;
  if (digits.startsWith("11284") && digits.length === 12) return `+${digits.slice(1)}`;
  return `+${digits}`;
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
