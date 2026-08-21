import { EMPTY_CELL, type CellValue, type ShiftPreset, type WeekBundle } from "@/lib/types";
import { addDaysISO } from "@/lib/domain/week";
import type { ScheduleRepo } from "./repo";

/**
 * In-memory repo για το /demo — η δομή του pilot (The Little Mosque):
 * 4 τμήματα, προσωπικό και presets όπως στο χειρόγραφο χαρτί.
 */

const DEPARTMENTS = [
  { id: "d1", name: "BAR", sortOrder: 0 },
  { id: "d2", name: "SERVICE", sortOrder: 1 },
  { id: "d3", name: "ΒΟΗΘΟΙ / ΛΑΤΖΑ", sortOrder: 2 },
  { id: "d4", name: "ΚΟΥΖΙΝΑ", sortOrder: 3 },
];

const EMPLOYEES = [
  { id: "e01", departmentId: "d1", fullName: "Ρόκκας", sortOrder: 0 },
  { id: "e02", departmentId: "d1", fullName: "Πάρης", sortOrder: 1 },
  { id: "e03", departmentId: "d1", fullName: "Ορέστης", sortOrder: 2 },
  { id: "e04", departmentId: "d2", fullName: "Τσιμπάνου", sortOrder: 0 },
  { id: "e05", departmentId: "d2", fullName: "Γιαννούλας", sortOrder: 1 },
  { id: "e06", departmentId: "d2", fullName: "Αναγνώστου", sortOrder: 2 },
  { id: "e07", departmentId: "d2", fullName: "Πάτα", sortOrder: 3 },
  { id: "e08", departmentId: "d2", fullName: "Ντέρη", sortOrder: 4 },
  { id: "e09", departmentId: "d2", fullName: "Αδαμόπουλος", sortOrder: 5 },
  { id: "e10", departmentId: "d3", fullName: "Γευμωμάτη", sortOrder: 0 },
  { id: "e11", departmentId: "d3", fullName: "Παπαθανασίου", sortOrder: 1 },
  { id: "e12", departmentId: "d3", fullName: "Φάλιας", sortOrder: 2 },
  { id: "e13", departmentId: "d3", fullName: "Παπαχρήστος", sortOrder: 3 },
  { id: "e14", departmentId: "d4", fullName: "Μακρής", sortOrder: 0 },
  { id: "e15", departmentId: "d4", fullName: "Αργύρης", sortOrder: 1 },
];

const PRESETS: ShiftPreset[] = [
  { id: "p1", label: "17–01", kind: "work", start: 1020, end: 60, sortOrder: 0 },
  { id: "p2", label: "18–02", kind: "work", start: 1080, end: 120, sortOrder: 1 },
  { id: "p3", label: "18–00", kind: "work", start: 1080, end: 0, sortOrder: 2 },
  { id: "p4", label: "19:30–00:30", kind: "work", start: 1170, end: 30, sortOrder: 3 },
  { id: "p5", label: "21–01", kind: "work", start: 1260, end: 60, sortOrder: 4 },
  { id: "p6", label: "09–17", kind: "work", start: 540, end: 1020, sortOrder: 5 },
  { id: "p7", label: "10–18", kind: "work", start: 600, end: 1080, sortOrder: 6 },
  { id: "p8", label: "ΡΕΠΟ", kind: "repo", start: null, end: null, sortOrder: 7 },
  { id: "p9", label: "ΑΔΕΙΑ", kind: "adeia", start: null, end: null, sortOrder: 8 },
];

interface DemoWeek {
  weekId: string;
  weekStart: string;
  status: WeekBundle["status"];
  cells: Record<string, CellValue[]>;
}

const weeks = new Map<string, DemoWeek>();

function emptyCells(): Record<string, CellValue[]> {
  return Object.fromEntries(
    EMPLOYEES.map((e) => [e.id, Array.from({ length: 7 }, () => ({ ...EMPTY_CELL }))])
  );
}

function seedWeek(weekStart: string): DemoWeek {
  const cells = emptyCells();
  // Ενδεικτικό γέμισμα από το χαρτί ώστε το demo να μη δείχνει άδειο.
  const set = (emp: string, day: number, presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId)!;
    cells[emp][day] = { kind: p.kind, presetId: p.id, start: p.start, end: p.end };
  };
  for (let d = 0; d < 7; d++) set("e04", d, d === 4 || d === 6 ? "p8" : "p1");
  for (let d = 0; d < 7; d++) set("e05", d, d === 1 ? "p8" : "p2");
  for (let d = 0; d < 7; d++) set("e09", d, d >= 4 ? "p8" : "p4");
  for (let d = 0; d < 7; d++) set("e14", d, d === 0 || d === 3 ? "p8" : "p6");
  cells["e15"][2] = { kind: "adeia", leaveType: "kanoniki" };
  return { weekId: `w-${weekStart}`, weekStart, status: "draft", cells };
}

function getOrCreate(weekStart: string, seed: boolean): DemoWeek {
  let w = weeks.get(weekStart);
  if (!w) {
    w = seed
      ? seedWeek(weekStart)
      : { weekId: `w-${weekStart}`, weekStart, status: "draft", cells: emptyCells() };
    weeks.set(weekStart, w);
  }
  return w;
}

let firstLoad = true;

export const demoRepo: ScheduleRepo = {
  async getTenants() {
    return [{ id: "demo", name: "The Little Mosque (demo)", slug: "demo", role: "owner" }];
  },

  async getWeek(_tenantId, weekStart) {
    const w = getOrCreate(weekStart, firstLoad);
    firstLoad = false;
    return {
      weekId: w.weekId,
      weekStart: w.weekStart,
      status: w.status,
      departments: DEPARTMENTS,
      employees: EMPLOYEES,
      presets: PRESETS,
      cells: structuredClone(w.cells),
    };
  },

  async setCell(_tenantId, weekId, employeeId, dayIndex, value) {
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (!week) return;
    week.cells[employeeId][dayIndex] = value;
    if (week.status === "published") week.status = "published_dirty";
  },

  async copyPreviousWeek(_tenantId, _weekId, weekStart) {
    const prev = getOrCreate(addDaysISO(weekStart, -7), true);
    const cur = getOrCreate(weekStart, false);
    // Μόνο το εργασιακό μοτίβο μεταφέρεται — οι άδειες δεν αντιγράφονται.
    cur.cells = Object.fromEntries(
      Object.entries(prev.cells).map(([emp, row]) => [
        emp,
        row.map((c) => (c.kind === "work" || c.kind === "repo" ? { ...c } : { ...EMPTY_CELL })),
      ])
    );
    return this.getWeek(_tenantId, weekStart);
  },

  async publish(_tenantId, weekId) {
    const week = [...weeks.values()].find((w) => `w-${w.weekStart}` === weekId);
    if (week) week.status = "published";
  },
};
