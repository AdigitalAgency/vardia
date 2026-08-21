export const DAY_NAMES = [
  "Δευτέρα",
  "Τρίτη",
  "Τετάρτη",
  "Πέμπτη",
  "Παρασκευή",
  "Σάββατο",
  "Κυριακή",
] as const;

export const DAY_NAMES_SHORT = ["Δευ", "Τρι", "Τετ", "Πεμ", "Παρ", "Σαβ", "Κυρ"] as const;

/** ISO date (YYYY-MM-DD) της Δευτέρας της εβδομάδας που περιέχει την d. */
export function mondayOf(d: Date): string {
  const copy = new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()));
  const dow = copy.getUTCDay(); // 0 = Κυριακή
  const diff = dow === 0 ? -6 : 1 - dow;
  copy.setUTCDate(copy.getUTCDate() + diff);
  return copy.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function isMondayISO(iso: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(iso) && new Date(`${iso}T00:00:00Z`).getUTCDay() === 1;
}

/** "17/8" από ISO */
export function shortDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00Z`);
  return `${d.getUTCDate()}/${d.getUTCMonth() + 1}`;
}

export function weekRangeLabel(weekStart: string): string {
  return `${shortDate(weekStart)} – ${shortDate(addDaysISO(weekStart, 6))}`;
}

export const MONTH_NAMES = [
  "Ιανουάριος",
  "Φεβρουάριος",
  "Μάρτιος",
  "Απρίλιος",
  "Μάιος",
  "Ιούνιος",
  "Ιούλιος",
  "Αύγουστος",
  "Σεπτέμβριος",
  "Οκτώβριος",
  "Νοέμβριος",
  "Δεκέμβριος",
] as const;

/**
 * Οι Δευτέρες όλων των εβδομάδων που τέμνουν τον μήνα. Ο λογιστής σκέφτεται σε
 * μήνες (μισθοδοσία) αλλά το αρχείο του είναι εβδομαδιαίο.
 * @param month 1-12
 */
export function weeksInMonth(year: number, month: number): string[] {
  const first = `${year}-${String(month).padStart(2, "0")}-01`;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const last = `${year}-${String(month).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;

  const out: string[] = [];
  let cursor = mondayOf(new Date(`${first}T00:00:00Z`));
  const lastMonday = mondayOf(new Date(`${last}T00:00:00Z`));
  while (cursor <= lastMonday) {
    out.push(cursor);
    cursor = addDaysISO(cursor, 7);
  }
  return out;
}

export function monthLabel(year: number, month: number): string {
  return `${MONTH_NAMES[month - 1]} ${year}`;
}
