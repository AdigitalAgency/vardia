/**
 * Weekly matrix export στο format του λογιστή (LITTLEMOSQUE_BRAIN §5α):
 * ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ | Α.Φ.Μ | ΕΠΩΝΥΜΟ | ΟΝΟΜΑ | ΔΕΥΤΕΡΑ … ΚΥΡΙΑΚΗ
 * Κελιά: HHMMHHMM (έναρξη+λήξη) | ΑΝ (ανάπαυση/ρεπό) | label άδειας (ΑΔΕΙΑ, ΠΑΤΡΟΤΗΤΑ…)
 */

import { formatHHMM, type WorkInterval } from "./time";

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
 * HHMMHHMM με ώρα ρολογιού λήξης — ΚΑΙ για βάρδιες που περνούν μεσάνυχτα
 * (17:00–01:00 → "17000100"). Εκκρεμεί επιβεβαίωση λογιστή για το
 * midnight-crossing (VARDIA_BRAIN «ΑΝΟΙΧΤΟ»)· το δείγμα του δεν είχε τέτοια περίπτωση.
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
