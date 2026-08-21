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
