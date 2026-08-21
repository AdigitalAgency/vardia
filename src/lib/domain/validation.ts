/**
 * Έλεγχοι φόρμας εργαζομένου. Χωρίζονται σε **σφάλματα** (μπλοκάρουν την
 * αποθήκευση) και **προειδοποιήσεις** (ο owner αποφασίζει — π.χ. συμφωνημένες
 * ώρες πάνω από το νόμιμο πλαίσιο μπορεί να είναι σκόπιμες).
 */

import type { EmployeeInput, StaffMember } from "@/lib/types";
import { normalizePhone } from "./phone";

/** Πλήρες εβδομαδιαίο ωράριο κατά την ελληνική εργατική νομοθεσία. */
export const FULL_TIME_WEEKLY_HOURS = 40;
export const MAX_WEEKLY_HOURS = 48;

export interface ValidationResult {
  /** πεδίο → μήνυμα· αν δεν είναι κενό, δεν αποθηκεύουμε */
  errors: Record<string, string>;
  /** πεδίο → μήνυμα· εμφανίζονται αλλά επιτρέπουν αποθήκευση */
  warnings: Record<string, string>;
}

export function isValidEmail(value: string): boolean {
  const v = value.trim();
  if (!v || v.length > 254) return false;
  // Σκόπιμα απλό: ένα @, κάτι πριν, domain με τελεία και 2+ γράμματα κατάληξη.
  return /^[^\s@]+@[^\s@.]+(\.[^\s@.]+)*\.[A-Za-z]{2,}$/.test(v);
}

export function validateEmployee(
  input: EmployeeInput,
  others: Pick<StaffMember, "id" | "payroll" | "fullName">[] = [],
  currentId?: string
): ValidationResult {
  const errors: Record<string, string> = {};
  const warnings: Record<string, string> = {};

  // --- Υποχρεωτικά ---
  if (!input.fullName.trim()) {
    errors.fullName = "Το όνομα στο πρόγραμμα είναι υποχρεωτικό.";
  }
  if (!input.departmentId) {
    errors.departmentId = "Διάλεξε τμήμα.";
  }
  if (!input.payroll.lastName?.trim()) {
    errors.lastName = "Το επώνυμο είναι υποχρεωτικό.";
  }
  if (!input.payroll.firstName?.trim()) {
    errors.firstName = "Το όνομα είναι υποχρεωτικό.";
  }

  // --- Κινητό ---
  const phone = input.phone?.trim() ?? "";
  if (!phone) {
    errors.phone = "Το κινητό είναι υποχρεωτικό.";
  } else if (!normalizePhone(phone)) {
    errors.phone = "Μη έγκυρο κινητό. Δώσε 10ψήφιο που αρχίζει με 69.";
  }

  // --- Email (προαιρετικό, αλλά αν δοθεί πρέπει να στέκει) ---
  const email = input.email?.trim() ?? "";
  if (email && !isValidEmail(email)) {
    errors.email = "Μη έγκυρο email.";
  }

  // --- ΑΦΜ (προαιρετικό εδώ· ο λογιστής το συμπληρώνει) ---
  const afm = input.payroll.afm?.replace(/\D/g, "") ?? "";
  if (afm && afm.length !== 9) {
    errors.afm = "Το ΑΦΜ έχει 9 ψηφία.";
  }

  // --- Αριθμός μητρώου: μοναδικός μέσα στο κατάστημα ---
  const payrollId = input.payroll.payrollId?.trim() ?? "";
  if (payrollId) {
    const clash = others.find(
      (o) => o.id !== currentId && o.payroll.payrollId?.trim() === payrollId
    );
    if (clash) {
      errors.payrollId = `Ο αριθμός μητρώου ${payrollId} ανήκει ήδη στον/στην ${clash.fullName}.`;
    }
  }

  // --- Ώρες εβδομάδας ---
  const hours = input.weeklyHours;
  if (hours != null) {
    if (hours <= 0) {
      errors.weeklyHours = "Οι ώρες πρέπει να είναι θετικός αριθμός.";
    } else if (hours > MAX_WEEKLY_HOURS) {
      errors.weeklyHours = `Πάνω από ${MAX_WEEKLY_HOURS} ώρες/εβδομάδα δεν επιτρέπεται.`;
    } else if (hours > FULL_TIME_WEEKLY_HOURS) {
      warnings.weeklyHours = `${hours} ώρες: πάνω από το πλήρες ωράριο των ${FULL_TIME_WEEKLY_HOURS}. Οι επιπλέον ώρες μετρούν ως υπερωρία.`;
    }
  }

  // --- Αμοιβή ---
  if (input.payType && (input.payAmount == null || input.payAmount <= 0)) {
    errors.payAmount = "Συμπλήρωσε ποσό αμοιβής.";
  }
  if (input.payType === "hourly" && input.payAmount != null && input.payAmount > 50) {
    warnings.payAmount = "Το ποσό μοιάζει υψηλό για ωρομίσθιο. Μήπως εννοείς ημερομίσθιο;";
  }

  // --- Σύμβαση vs ώρες ---
  if (input.contractType === "part" && hours != null && hours >= FULL_TIME_WEEKLY_HOURS) {
    warnings.contractType = "Μερική απασχόληση με ώρες πλήρους ωραρίου.";
  }

  return { errors, warnings };
}

export function hasErrors(result: ValidationResult): boolean {
  return Object.keys(result.errors).length > 0;
}
