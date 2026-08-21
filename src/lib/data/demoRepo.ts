import {
  EMPTY_CELL,
  type AppNotification,
  type CellValue,
  type LeaveRequest,
  type EmployeeInput,
  type PayrollFields,
  type ShiftPreset,
  type ShiftUsage,
  type WeekBundle,
} from "@/lib/types";

/** Ποιον εργαζόμενο «παίζει» το /demo/employee. */
const DEMO_EMPLOYEE_ID = "e04";
import { addDaysISO, mondayOf } from "@/lib/domain/week";
import { slugify } from "@/lib/domain/slug";
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

interface DemoEmployee {
  id: string;
  departmentId: string | null;
  fullName: string;
  sortOrder: number;
}

const EMPLOYEES: DemoEmployee[] = [
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
  /** ποιοι άλλαξαν από την τελευταία δημοσίευση — ίδια λογική με το shift_revisions */
  changedSincePublish: Set<string>;
}

const weeks = new Map<string, DemoWeek>();
const usage: Record<string, ShiftUsage[]> = {};
const leaveRequests: LeaveRequest[] = [];
const notifications: AppNotification[] = [];
let seeded = false;

// Στο demo οι δύο πρώτοι έχουν στοιχεία μισθοδοσίας, οι υπόλοιποι όχι — ώστε να
// φαίνεται το warning ελλιπών στοιχείων στην οθόνη του λογιστή.
const payrollById: Record<string, PayrollFields> = {
  e04: { payrollId: "101", afm: "123456789", firstName: "Μαρία", lastName: "Τσιμπάνου" },
  e05: { payrollId: "104", afm: "234567891", firstName: "Νίκος", lastName: "Γιαννούλας" },
};

type EmployeeDetails = Omit<
  EmployeeInput,
  "fullName" | "departmentId" | "payroll"
>;

const EMPTY_DETAILS: EmployeeDetails = {
  position: null,
  phone: null,
  email: null,
  hireDate: null,
  birthDate: null,
  amka: null,
  contractType: null,
  weeklyHours: null,
  payType: null,
  payAmount: null,
  notes: null,
};

function extractDetails(input: EmployeeInput): EmployeeDetails {
  const { fullName: _n, departmentId: _d, payroll: _p, ...rest } = input;
  return rest;
}

const details: Record<string, EmployeeDetails> = {
  e04: {
    ...EMPTY_DETAILS,
    position: "Σερβιτόρα",
    phone: "6971234567",
    contractType: "full",
    weeklyHours: 40,
    payType: "monthly",
    payAmount: 950,
    hireDate: "2024-05-01",
  },
  e05: {
    ...EMPTY_DETAILS,
    position: "Σερβιτόρος",
    contractType: "part",
    weeklyHours: 20,
    payType: "hourly",
    payAmount: 6.5,
  },
};

/** Ποιοι έχουν λογαριασμό (employeeId → κινητό σύνδεσης) και ποιοι αρχειοθετήθηκαν. */
const accounts = new Map<string, string>([["e04", "6971234567"]]);
const archived = new Set<string>();

/** Μετρά ωράρια (preset ή custom) ανά εργαζόμενο — ό,τι κάνει και το SQL. */
function bumpUsage(employeeId: string, cell: CellValue, delta = 1) {
  if (cell.kind !== "work" || cell.start == null || cell.end == null) return;
  const list = (usage[employeeId] ??= []);
  const hit = list.find((u) => u.start === cell.start && u.end === cell.end);
  if (hit) hit.count += delta;
  else list.push({ start: cell.start, end: cell.end, count: delta });
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
    const cell: CellValue = { kind: p.kind, presetId: p.id, start: p.start, end: p.end };
    cells[emp][day] = cell;
    bumpUsage(emp, cell);
  };
  for (let d = 0; d < 7; d++) set("e04", d, d === 4 || d === 6 ? "p8" : "p1");
  for (let d = 0; d < 7; d++) set("e05", d, d === 1 ? "p8" : "p2");
  for (let d = 0; d < 7; d++) set("e09", d, d >= 4 ? "p8" : "p4");
  for (let d = 0; d < 7; d++) set("e14", d, d === 0 || d === 3 ? "p8" : "p6");
  cells["e15"][2] = { kind: "adeia", leaveType: "kanoniki" };
  return {
    weekId: `w-${weekStart}`,
    weekStart,
    status: "draft",
    cells,
    changedSincePublish: new Set(),
  };
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
    w = {
      weekId: `w-${weekStart}`,
      weekStart,
      status: "draft",
      cells: emptyCells(),
      changedSincePublish: new Set(),
    };
    weeks.set(weekStart, w);
  }
  return w;
}

export const demoRepo: ScheduleRepo = {
  async getTenants() {
    return [{ id: "demo", name: "The Little Mosque (demo)", slug: "demo", role: "owner" }];
  },

  async provisionTenant(input) {
    // Το demo δεν γράφει πουθενά — επιστρέφει επιτυχία ώστε να δοκιμάζεται ο wizard.
    return { tenantId: "demo-new", slug: slugify(input.name) };
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
      usage: structuredClone(usage),
    };
  },

  async setCell(_tenantId, weekId, employeeId, dayIndex, value) {
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (!week) return;
    week.cells[employeeId][dayIndex] = value;
    bumpUsage(employeeId, value);
    if (week.status === "published" || week.status === "published_dirty") {
      week.status = "published_dirty";
      week.changedSincePublish.add(employeeId);
    }
  },

  async setRow(_tenantId, weekId, employeeId, value) {
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (!week) return { filled: 0, skippedLeave: 0 };
    const row = week.cells[employeeId];
    let filled = 0;
    let skippedLeave = 0;
    for (let d = 0; d < 7; d++) {
      if (row[d].kind === "adeia") {
        skippedLeave += 1;
        continue;
      }
      row[d] = { ...value };
      bumpUsage(employeeId, value);
      filled += 1;
    }
    if (week.status === "published" || week.status === "published_dirty") {
      week.status = "published_dirty";
      week.changedSincePublish.add(employeeId);
    }
    return { filled, skippedLeave };
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
    if (cur.status === "published" || cur.status === "published_dirty") {
      cur.status = "published_dirty";
      Object.keys(cur.cells).forEach((id) => cur.changedSincePublish.add(id));
    }
    return this.getWeek(_tenantId, weekStart);
  },

  async publish(_tenantId, weekId) {
    const week = [...weeks.values()].find((w) => w.weekId === weekId);
    if (!week) return { notified: 0, firstPublish: false };
    const firstPublish = week.status === "draft";
    // Πρώτη δημοσίευση: όλοι με κελί. Επαναδημοσίευση: μόνο όσοι άλλαξαν.
    const notified = firstPublish
      ? Object.values(week.cells).filter((row) => row.some((c) => c.kind !== "empty")).length
      : week.changedSincePublish.size;
    week.status = "published";
    week.changedSincePublish.clear();
    notifications.unshift({
      id: `n${notifications.length + 1}`,
      kind: firstPublish ? "schedule_published" : "schedule_changed",
      payload: { week_start: week.weekStart, tenant_name: "The Little Mosque (demo)" },
      readAt: null,
      createdAt: new Date().toISOString(),
    });
    return { notified, firstPublish };
  },

  async createRoleInvite(_tenantId, role) {
    return `demo-token-${role}`;
  },

  async listNotifications() {
    return structuredClone(notifications);
  },

  async markNotificationsRead(_tenantId, ids) {
    for (const n of notifications) {
      if (ids.includes(n.id)) n.readAt = new Date().toISOString();
    }
  },

  async savePushSubscription() {
    // no-op στο demo
  },

  async listStaff(_tenantId, includeArchived = false) {
    return EMPLOYEES.filter((e) => includeArchived || !archived.has(e.id)).map((e) => ({
      id: e.id,
      fullName: e.fullName,
      departmentId: e.departmentId,
      departmentName: DEPARTMENTS.find((d) => d.id === e.departmentId)?.name ?? null,
      status: archived.has(e.id) ? "archived" : "active",
      sortOrder: e.sortOrder,
      hasAccess: accounts.has(e.id),
      loginPhone: accounts.get(e.id) ?? null,
      payroll: payrollById[e.id] ?? {
        payrollId: null,
        afm: null,
        firstName: null,
        lastName: null,
      },
      ...(details[e.id] ?? EMPTY_DETAILS),
    }));
  },

  async createEmployee(_tenantId, input) {
    const id = `e${EMPLOYEES.length + 1}${Math.floor(Date.now() % 1000)}`;
    EMPLOYEES.push({
      id,
      departmentId: input.departmentId,
      fullName: input.fullName,
      sortOrder: EMPLOYEES.length,
    });
    details[id] = extractDetails(input);
    payrollById[id] = { ...input.payroll };
    return id;
  },

  async updateEmployee(_tenantId, employeeId, input) {
    const emp = EMPLOYEES.find((e) => e.id === employeeId);
    if (emp) {
      emp.fullName = input.fullName;
      emp.departmentId = input.departmentId;
    }
    details[employeeId] = extractDetails(input);
    payrollById[employeeId] = { ...input.payroll };
  },

  async archiveEmployee(employeeId, archive) {
    if (archive) archived.add(employeeId);
    else archived.delete(employeeId);
  },

  async deleteEmployee(employeeId) {
    const hasShifts = [...weeks.values()].some((w) =>
      (w.cells[employeeId] ?? []).some((c) => c.kind !== "empty")
    );
    if (hasShifts) {
      throw new Error(
        "Ο εργαζόμενος έχει βάρδιες στο ιστορικό. Χρησιμοποίησε «Αρχειοθέτηση» ώστε να μη χαθεί το ιστορικό της μισθοδοσίας."
      );
    }
    const i = EMPLOYEES.findIndex((e) => e.id === employeeId);
    if (i >= 0) EMPLOYEES.splice(i, 1);
    delete details[employeeId];
    delete payrollById[employeeId];
  },

  async createEmployeeAccount(_tenantId, employeeId, phone) {
    accounts.set(employeeId, phone);
  },

  async updateEmployeePayroll(_tenantId, employeeId, fields) {
    payrollById[employeeId] = { ...fields };
  },

  async getPeriod(_tenantId, weekStarts) {
    seedOnce(weekStarts[0]);
    return {
      employees: EMPLOYEES.map((e) => ({
        id: e.id,
        fullName: e.fullName,
        departmentName: DEPARTMENTS.find((d) => d.id === e.departmentId)?.name ?? null,
        ...(payrollById[e.id] ?? {
          payrollId: null,
          afm: null,
          firstName: null,
          lastName: null,
        }),
      })),
      weeks: [...weekStarts].sort().map((weekStart) => {
        const w = weeks.get(weekStart);
        return {
          weekStart,
          published: !!w && w.status !== "draft",
          cells: w
            ? structuredClone(w.cells)
            : Object.fromEntries(
                EMPLOYEES.map((e) => [
                  e.id,
                  Array.from({ length: 7 }, () => ({ ...EMPTY_CELL })),
                ])
              ),
        };
      }),
    };
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
      if (week.status === "published" || week.status === "published_dirty") {
        week.status = "published_dirty";
        week.changedSincePublish.add(req.employeeId);
      }
    }
  },
};
