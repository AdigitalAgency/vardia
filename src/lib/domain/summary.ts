/**
 * Σύνοψη περιόδου για τον λογιστή — pure functions πάνω από τα κελιά του προγράμματος.
 * Ο επιμερισμός ανά ημερολογιακή ημέρα είναι κρίσιμος: βάρδια Σαββάτου 17:00–01:00
 * έχει 1 ώρα που ανήκει στην Κυριακή.
 */

import type { CellValue } from "@/lib/types";
import { durationMinutes, nightMinutes, splitByCalendarDay } from "./time";

export interface PeriodSummary {
  totalMinutes: number;
  nightMinutes: number;
  sundayMinutes: number;
  workDays: number;
  leaveDays: number;
  restDays: number;
}

export const EMPTY_SUMMARY: PeriodSummary = {
  totalMinutes: 0,
  nightMinutes: 0,
  sundayMinutes: 0,
  workDays: 0,
  leaveDays: 0,
  restDays: 0,
};

/**
 * @param cells 7 κελιά, index 0 = Δευτέρα
 */
export function summarizeWeek(cells: CellValue[]): PeriodSummary {
  const out = { ...EMPTY_SUMMARY };

  cells.forEach((c, dayIndex) => {
    if (c.kind === "repo") {
      out.restDays += 1;
      return;
    }
    if (c.kind === "adeia") {
      out.leaveDays += 1;
      return;
    }
    if (c.kind !== "work" || c.start == null || c.end == null) return;

    const iv = { start: c.start, end: c.end };
    out.workDays += 1;
    out.totalMinutes += durationMinutes(iv);
    out.nightMinutes += nightMinutes(iv);

    for (const seg of splitByCalendarDay(iv)) {
      // index 6 = Κυριακή· βάρδια Κυριακής που περνά μεσάνυχτα συνεχίζει σε Δευτέρα.
      if ((dayIndex + seg.dayOffset) % 7 === 6) {
        out.sundayMinutes += seg.end - seg.start;
      }
    }
  });

  return out;
}

export function addSummaries(a: PeriodSummary, b: PeriodSummary): PeriodSummary {
  return {
    totalMinutes: a.totalMinutes + b.totalMinutes,
    nightMinutes: a.nightMinutes + b.nightMinutes,
    sundayMinutes: a.sundayMinutes + b.sundayMinutes,
    workDays: a.workDays + b.workDays,
    leaveDays: a.leaveDays + b.leaveDays,
    restDays: a.restDays + b.restDays,
  };
}

/** «8ω 30′» — η μορφή που διαβάζει ο λογιστής χωρίς να κάνει πράξεις. */
export function formatMinutes(min: number): string {
  const h = Math.floor(min / 60);
  const m = Math.round(min % 60);
  return m ? `${h}ω ${m}′` : `${h}ω`;
}

/** Δεκαδικές ώρες για το CSV (2 δεκαδικά) — αυτό δέχονται τα μισθοδοτικά. */
export function decimalHours(min: number): string {
  return (min / 60).toFixed(2).replace(".", ",");
}
