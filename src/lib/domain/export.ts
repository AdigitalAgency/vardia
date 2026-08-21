/**
 * Weekly matrix export στο format του λογιστή (LITTLEMOSQUE_BRAIN §5α):
 * ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ | Α.Φ.Μ | ΕΠΩΝΥΜΟ | ΟΝΟΜΑ | ΔΕΥΤΕΡΑ … ΚΥΡΙΑΚΗ
 * Κελιά: HHMMHHMM (έναρξη+λήξη) | ΑΝ (ανάπαυση/ρεπό) | label άδειας (ΑΔΕΙΑ, ΠΑΤΡΟΤΗΤΑ…)
 */

import { formatHHMM, type WorkInterval } from "./time";
import type { CellValue, PeriodData } from "@/lib/types";
import { weekRangeLabel } from "./week";

export type ExportCell =
  | { kind: "work"; interval: WorkInterval }
  | { kind: "repo" }
  | { kind: "adeia"; leaveType?: string }
  | { kind: "empty" };

export interface ExportEmployeeRow {
  payrollId: string;
  afm: string;
  lastName: string;
  firstName: string;
  /** 7 κελιά, index 0 = Δευτέρα */
  cells: ExportCell[];
}

export const WEEK_HEADERS = [
  "ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ",
  "Α.Φ.Μ",
  "ΕΠΩΝΥΜΟ",
  "ΟΝΟΜΑ",
  "ΔΕΥΤΕΡΑ",
  "ΤΡΙΤΗ",
  "ΤΕΤΑΡΤΗ",
  "ΠΕΜΠΤΗ",
  "ΠΑΡΑΣΚΕΥΗ",
  "ΣΑΒΒΑΤΟ",
  "ΚΥΡΙΑΚΗ",
] as const;

export const LEAVE_LABELS: Record<string, string> = {
  kanoniki: "ΑΔΕΙΑ",
  patrotita: "ΠΑΤΡΟΤΗΤΑ",
  mitrotita: "ΜΗΤΡΟΤΗΤΑ",
  astheneia: "ΑΣΘΕΝΕΙΑ",
};

/**
 * HHMMHHMM με ώρα ρολογιού λήξης — ΚΑΙ για βάρδιες που περνούν μεσάνυχτα:
 * 17:00–01:00 → "17000100" στην ημέρα έναρξης (επιβεβαιωμένο από Φώτη 2026-08-21).
 */
export function encodeCell(cell: ExportCell): string {
  switch (cell.kind) {
    case "work":
      return formatHHMM(cell.interval.start) + formatHHMM(cell.interval.end);
    case "repo":
      return "ΑΝ";
    case "adeia":
      return (cell.leaveType && LEAVE_LABELS[cell.leaveType]) ?? "ΑΔΕΙΑ";
    case "empty":
      return "";
  }
}

export function buildMatrix(rows: ExportEmployeeRow[]): string[][] {
  return [
    [...WEEK_HEADERS],
    ...rows.map((r) => {
      if (r.cells.length !== 7) {
        throw new Error(`Expected 7 cells for ${r.lastName}, got ${r.cells.length}`);
      }
      return [r.payrollId, r.afm, r.lastName, r.firstName, ...r.cells.map(encodeCell)];
    }),
  ];
}

/** Μετατροπή κελιού προγράμματος σε κελί export. */
export function toExportCell(c: CellValue): ExportCell {
  if (c.kind === "work" && c.start != null && c.end != null) {
    return { kind: "work", interval: { start: c.start, end: c.end } };
  }
  if (c.kind === "repo") return { kind: "repo" };
  if (c.kind === "adeia") return { kind: "adeia", leaveType: c.leaveType ?? undefined };
  return { kind: "empty" };
}

/** Το επώνυμο/όνομα για το export· fallback σε split του full_name. */
export function splitName(
  fullName: string,
  lastName: string | null,
  firstName: string | null
): { lastName: string; firstName: string } {
  if (lastName || firstName) {
    return { lastName: lastName ?? "", firstName: firstName ?? "" };
  }
  const parts = fullName.trim().split(/\s+/);
  return { lastName: parts[0] ?? "", firstName: parts.slice(1).join(" ") };
}

/**
 * Πίνακας για ολόκληρη περίοδο. Μία εβδομάδα → ακριβώς το format του δείγματος
 * του λογιστή. Περισσότερες → ένα block ανά εβδομάδα με γραμμή τίτλου, ώστε να
 * παραμένει αναγνωρίσιμο και ανοιχτό σε Excel.
 */
export function buildPeriodMatrix(data: PeriodData): string[][] {
  const rowsFor = (weekIndex: number): ExportEmployeeRow[] =>
    data.employees.map((e) => {
      const { lastName, firstName } = splitName(e.fullName, e.lastName, e.firstName);
      return {
        payrollId: e.payrollId ?? "",
        afm: e.afm ?? "",
        lastName,
        firstName,
        cells: (
          data.weeks[weekIndex].cells[e.id] ??
          Array.from({ length: 7 }, () => ({ kind: "empty" as const }))
        ).map(toExportCell),
      };
    });

  if (data.weeks.length === 1) return buildMatrix(rowsFor(0));

  const out: string[][] = [];
  data.weeks.forEach((w, i) => {
    if (i > 0) out.push([]);
    out.push([`ΕΒΔΟΜΑΔΑ ${weekRangeLabel(w.weekStart)}`]);
    out.push(...buildMatrix(rowsFor(i)));
  });
  return out;
}

/**
 * CSV με UTF-8 BOM και ';' delimiter — ό,τι ανοίγει σωστά το ελληνικό Excel out of the box.
 */
export function toCsv(matrix: string[][], delimiter = ";"): string {
  const escape = (v: string) =>
    v.includes(delimiter) || v.includes('"') || v.includes("\n")
      ? `"${v.replace(/"/g, '""')}"`
      : v;
  return "﻿" + matrix.map((row) => row.map(escape).join(delimiter)).join("\r\n");
}
