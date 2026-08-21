import {
  EMPTY_CELL,
  type CellValue,
  type LeaveRequest,
  type ShiftPreset,
  type WeekBundle,
} from "@/lib/types";

/** Ποιον εργαζόμενο «παίζει» το /demo/employee. */
const DEMO_EMPLOYEE_ID = "e04";
import { addDaysISO, mondayOf } from "@/lib/domain/week";
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
const presetUsage: Record<string, Record<string, number>> = {};
const leaveRequests: LeaveRequest[] = [];
let seeded = false;

function bumpUsage(employeeId: string, presetId: string | null | undefined, delta = 1) {
  if (!presetId) return;
  presetUsage[employeeId] ??= {};
  presetUsage[employeeId][presetId] = (presetUsage[employeeId][presetId] ?? 0) + delta;
}

function emptyCells(): Record<string, CellValue[]> {
  return Object.fromEntries(
    EMPLOYEES.map((e) => [e.id, Array.from({ length: 7 }, () => ({ ...EMPTY_CELL }))])
  );
}

function seedWeek(weekStart: string): DemoWeek {
  const cells = emptyCells();
  const set = (emp: string, day: number, presetId: string) => {
    const p = PRESETS.find((x) => x.id === presetId)!;
    cells[emp][day] = { kind: p.kind, presetId: p.id, start: p.start, end: p.end };
    bumpUsage(emp, p.kind === "work" ? p.id : null);
  };
  for (let d = 0; d < 7; d++) set("e04", d, d === 4 || d === 6 ? "p8" : "p1");
  for (let d = 0; d < 7; d++) set("e05", d, d === 1 ? "p8" : "p2");
  for (let d = 0; d < 7; d++) set("e09", d, d >= 4 ? "p8" : "p4");
  for (let d = 0; d < 7; d++) set("e14", d, d === 0 || d === 3 ? "p8" : "p6");
  cells["e15"][2] = { kind: "adeia", leaveType: "kanoniki" };
  return { weekId: `w-${weekStart}`, weekStart, status: "draft", cells };
}

function seedOnce(weekStart: string) {
  if (seeded) return;
  seeded = true;
  weeks.set(weekStart, seedWeek(weekStart));
  // Δύο pending αιτήματα ώστε το tab «Αιτήματα» να έχει περιεχόμενο στο demo.
  leaveRequests.push(
    {
      id: "lr1",
      employeeId: "e08",
      employeeName: "Ντέρη",
      type: "kanoniki",
      dateFrom: addDaysISO(weekStart, 11),
      dateTo: addDaysISO(weekStart, 13),
      comment: "Γάμος αδερφής",
      status: "pending",
      decisionNote: null,
      createdAt: new Date().toISOString(),
    },
    {
      id: "lr2",
      employeeId: "e14",
      employeeName: "Μακρής",
      type: "repo",
      dateFrom: addDaysISO(weekStart, 8),
      dateTo: addDaysISO(weekStart, 8),
      comment: null,
      status: "pending",
      decisionNote: null,
      createdAt: new Date().toISOString(),
    }
  );
}

function getOrCreate(weekStart: string): DemoWeek {
  let w = weeks.get(weekStart);
  if (!w) {
    w = { weekId: `w-${weekStart}`, weekStart, status: "draft", cells: emptyCells() };
    weeks.set(weekStart, w);
  }
  return w;
}

export const demoRepo: ScheduleRepo = {
  async getTenants() {
    return [{ id: "demo", name: "The Little Mosque (demo)", slug: "demo", role: "owner" }];
  },

  async getWeek(_tenantId, weekStart) {
    seedOnce(weekStart);
    const w = getOrCreate(weekStart);
    return {
      weekId: w.weekId,
      weekStart: w.weekStart,
      status: w.status,
      departments: DEPARTMENTS,
      employees: EMPLOYEES,
      presets: PRESETS,
      cells: structuredClone(w.cells),
      presetUsage: structuredClone(presetUsage),
    };
  },

  async setCell(_tenantId, weekId, employeeId, dayIndex, value) {
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (!week) return;
    week.cells[employeeId][dayIndex] = value;
    if (value.kind === "work") bumpUsage(employeeId, value.presetId);
    if (week.status === "published") week.status = "published_dirty";
  },

  async copyPreviousWeek(_tenantId, _weekId, weekStart) {
    const prev = getOrCreate(addDaysISO(weekStart, -7));
    const cur = getOrCreate(weekStart);
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
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (week) week.status = "published";
  },

  async listStaff() {
    return EMPLOYEES.map((e) => ({
      id: e.id,
      fullName: e.fullName,
      departmentName: DEPARTMENTS.find((d) => d.id === e.departmentId)?.name ?? null,
      // Στο demo: οι δύο πρώτοι έχουν ήδη πρόσβαση, ένας έχει εκκρεμή πρόσκληση.
      hasAccess: e.id === DEMO_EMPLOYEE_ID || e.id === "e14",
      pendingToken: e.id === "e05" ? "demo-token-e05" : null,
    }));
  },

  async createInvite(_tenantId, employeeId) {
    return `demo-token-${employeeId}`;
  },

  async getMySchedule(_tenantId, weekStart) {
    seedOnce(weekStart);
    const w = getOrCreate(weekStart);
    const emp = EMPLOYEES.find((e) => e.id === DEMO_EMPLOYEE_ID)!;
    const published = w.status !== "draft";
    return {
      weekStart,
      employeeName: emp.fullName,
      published,
      cells: published
        ? structuredClone(w.cells[DEMO_EMPLOYEE_ID])
        : Array.from({ length: 7 }, () => ({ ...EMPTY_CELL })),
    };
  },

  async listMyLeaveRequests() {
    return structuredClone(leaveRequests.filter((r) => r.employeeId === DEMO_EMPLOYEE_ID));
  },

  async createLeaveRequest(_tenantId, input) {
    const emp = EMPLOYEES.find((e) => e.id === DEMO_EMPLOYEE_ID)!;
    leaveRequests.unshift({
      id: `lr${leaveRequests.length + 1}`,
      employeeId: emp.id,
      employeeName: emp.fullName,
      type: input.type,
      dateFrom: input.dateFrom,
      dateTo: input.dateTo,
      comment: input.comment ?? null,
      status: "pending",
      decisionNote: null,
      createdAt: new Date().toISOString(),
    });
  },

  async listLeaveRequests() {
    return structuredClone(leaveRequests).sort((a, b) =>
      a.status === "pending" === (b.status === "pending")
        ? b.createdAt.localeCompare(a.createdAt)
        : a.status === "pending"
          ? -1
          : 1
    );
  },

  async decideLeaveRequest(_tenantId, requestId, approve, note) {
    const req = leaveRequests.find((r) => r.id === requestId);
    if (!req || req.status !== "pending") return;
    req.status = approve ? "approved" : "rejected";
    req.decisionNote = note ?? null;
    if (!approve) return;
    // Auto-fill: κάθε ημέρα του αιτήματος γίνεται ΑΔΕΙΑ/ΡΕΠΟ στο πρόγραμμα.
    for (let d = req.dateFrom; d <= req.dateTo; d = addDaysISO(d, 1)) {
      const week = getOrCreate(mondayOf(new Date(`${d}T00:00:00Z`)));
      const dayIndex = Math.round((Date.parse(d) - Date.parse(week.weekStart)) / 86400000);
      week.cells[req.employeeId][dayIndex] =
        req.type === "repo" ? { kind: "repo" } : { kind: "adeia", leaveType: req.type };
      if (week.status === "published") week.status = "published_dirty";
    }
  },
};
