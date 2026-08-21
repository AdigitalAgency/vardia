/**
 * Πυρήνας υπολογισμών ωρών — pure functions, χωρίς I/O.
 * Όλες οι ώρες εκφράζονται σε λεπτά από τα μεσάνυχτα (0–1439).
 * Βάρδια που περνά μεσάνυχτα: end <= start (π.χ. 17:00–01:00).
 */

export interface WorkInterval {
  /** λεπτά από μεσάνυχτα, 0–1439 */
  start: number;
  /** λεπτά από μεσάνυχτα (ώρα ρολογιού λήξης), 0–1439 */
  end: number;
}

export interface DaySegment {
  /** 0 = ημέρα έναρξης, 1 = επόμενη ημερολογιακή ημέρα */
  dayOffset: 0 | 1;
  start: number;
  end: number; // exclusive, 1–1440
}

const MIN_PER_DAY = 1440;
// Νυχτερινή απασχόληση κατά την ελληνική νομοθεσία: 22:00–06:00.
const NIGHT_WINDOWS: Array<[number, number]> = [
  [0, 360], // 00:00–06:00 της ημέρας έναρξης
  [1320, 1800], // 22:00 ημέρας έναρξης – 06:00 επόμενης
  [2760, 3240], // 22:00 επόμενης – 06:00 μεθεπόμενης (βάρδιες που ξεκινούν αργά και κρατούν ως 24h)
];

export function parseHHMM(s: string): number {
  if (!/^\d{4}$/.test(s)) throw new Error(`Invalid HHMM: "${s}"`);
  const h = Number(s.slice(0, 2));
  const m = Number(s.slice(2, 4));
  if (h > 23 || m > 59) throw new Error(`Invalid HHMM: "${s}"`);
  return h * 60 + m;
}

export function formatHHMM(minutes: number): string {
  if (!Number.isInteger(minutes) || minutes < 0 || minutes >= MIN_PER_DAY) {
    throw new Error(`Minutes out of range: ${minutes}`);
  }
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}${String(m).padStart(2, "0")}`;
}

/** Ωράριο σε ανθρώπινη μορφή π.χ. "17:00–01:00" */
export function formatInterval(iv: WorkInterval): string {
  const f = (x: number) =>
    `${String(Math.floor(x / 60)).padStart(2, "0")}:${String(x % 60).padStart(2, "0")}`;
  return `${f(iv.start)}–${f(iv.end)}`;
}

export function crossesMidnight(iv: WorkInterval): boolean {
  return iv.end <= iv.start;
}

/** Συνολική διάρκεια σε λεπτά (βάρδια 0 διάρκειας δεν υπάρχει· end===start = 24ωρο δεν υποστηρίζεται, θεωρείται μεσάνυχτα-crossing 24h → error) */
export function durationMinutes(iv: WorkInterval): number {
  validate(iv);
  return crossesMidnight(iv) ? iv.end + MIN_PER_DAY - iv.start : iv.end - iv.start;
}

function validate(iv: WorkInterval): void {
  for (const v of [iv.start, iv.end]) {
    if (!Number.isInteger(v) || v < 0 || v >= MIN_PER_DAY) {
      throw new Error(`Interval value out of range: ${JSON.stringify(iv)}`);
    }
  }
  if (iv.start === iv.end) {
    throw new Error(`Zero/24h interval not supported: ${JSON.stringify(iv)}`);
  }
}

/**
 * Νυχτερινά λεπτά (παράθυρο 22:00–06:00), για τη σύνοψη του λογιστή.
 */
export function nightMinutes(iv: WorkInterval): number {
  const dur = durationMinutes(iv);
  const absStart = iv.start;
  const absEnd = iv.start + dur;
  let total = 0;
  for (const [ws, we] of NIGHT_WINDOWS) {
    total += Math.max(0, Math.min(absEnd, we) - Math.max(absStart, ws));
  }
  return total;
}

/**
 * Split βάρδιας ανά ημερολογιακή ημέρα — απαραίτητο για τον επιμερισμό
 * του λογιστή (π.χ. 19:30–00:30 → 19:30–24:00 ημέρα 0 + 00:00–00:30 ημέρα 1).
 */
export function splitByCalendarDay(iv: WorkInterval): DaySegment[] {
  validate(iv);
  if (!crossesMidnight(iv)) {
    return [{ dayOffset: 0, start: iv.start, end: iv.end }];
  }
  const segments: DaySegment[] = [{ dayOffset: 0, start: iv.start, end: MIN_PER_DAY }];
  if (iv.end > 0) segments.push({ dayOffset: 1, start: 0, end: iv.end });
  return segments;
}

/**
 * Λεπτά ανάπαυσης μεταξύ δύο διαδοχικών βαρδιών (η δεύτερη ξεκινά
 * dayGap ημερολογιακές ημέρες μετά την ημέρα έναρξης της πρώτης).
 * Χρησιμοποιείται από το guardrail 11ωρης ανάπαυσης στο publish.
 */
export function restMinutesBetween(a: WorkInterval, b: WorkInterval, dayGap: number): number {
  const aEndAbs = a.start + durationMinutes(a);
  const bStartAbs = dayGap * MIN_PER_DAY + b.start;
  return bStartAbs - aEndAbs;
}

export const MIN_REST_MINUTES = 11 * 60;

export function violatesDailyRest(a: WorkInterval, b: WorkInterval, dayGap: number): boolean {
  return restMinutesBetween(a, b, dayGap) < MIN_REST_MINUTES;
}
