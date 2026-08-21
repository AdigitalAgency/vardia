/**
 * Ο εργαζόμενος μπαίνει με κινητό + PIN, όχι με email (απόφαση PM §2.4).
 * Πίσω από τις κουρτίνες το κινητό γίνεται σταθερό identifier για το Supabase Auth.
 */

const EMPLOYEE_EMAIL_DOMAIN = "employee.vardia.app";

/** Επιστρέφει το κινητό σε μορφή 30XXXXXXXXXX, ή null αν δεν είναι έγκυρο. */
export function normalizePhone(input: string): string | null {
  const digits = input.replace(/\D/g, "");
  if (/^69\d{8}$/.test(digits)) return `30${digits}`;
  if (/^30 ?69\d{8}$/.test(digits)) return digits;
  if (/^0030(69\d{8})$/.test(digits)) return digits.slice(2);
  if (/^00(30 ?69\d{8})$/.test(digits)) return digits.slice(2);
  return null;
}

/** Εμφάνιση: 6971234567 */
export function displayPhone(normalized: string): string {
  return normalized.startsWith("30") ? normalized.slice(2) : normalized;
}

export function phoneToAuthEmail(normalized: string): string {
  return `${normalized}@${EMPLOYEE_EMAIL_DOMAIN}`;
}

export function isValidPin(pin: string): boolean {
  return /^\d{6}$/.test(pin);
}
