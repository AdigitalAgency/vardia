export type CellKind = "work" | "repo" | "adeia" | "empty";

export interface CellValue {
  kind: CellKind;
  presetId?: string | null;
  /** λεπτά από μεσάνυχτα */
  start?: number | null;
  end?: number | null;
  leaveType?: string | null;
  note?: string | null;
}

export interface Department {
  id: string;
  name: string;
  sortOrder: number;
}

export interface Employee {
  id: string;
  departmentId: string | null;
  fullName: string;
  sortOrder: number;
}

export interface ShiftPreset {
  id: string;
  label: string;
  kind: "work" | "repo" | "adeia";
  start: number | null;
  end: number | null;
  sortOrder: number;
}

export type WeekStatus = "draft" | "published" | "published_dirty";

export interface WeekBundle {
  weekId: string;
  weekStart: string; // ISO date (Δευτέρα)
  status: WeekStatus;
  departments: Department[];
  employees: Employee[];
  presets: ShiftPreset[];
  /** employeeId → 7 κελιά (index 0 = Δευτέρα) */
  cells: Record<string, CellValue[]>;
  /**
   * employeeId → ωράρια που έχει δουλέψει με πλήθος χρήσεων (all-time).
   * Μετρά ΚΑΙ τα custom ωράρια, όχι μόνο τα presets του μαγαζιού.
   */
  usage: Record<string, ShiftUsage[]>;
}

/** Ένα ωράριο (λεπτά από μεσάνυχτα) και πόσες φορές το έχει δουλέψει ο εργαζόμενος. */
export interface ShiftUsage {
  start: number;
  end: number;
  count: number;
}

export interface StaffMember {
  id: string;
  fullName: string;
  departmentName: string | null;
  /** true όταν το employee record έχει δεθεί με λογαριασμό */
  hasAccess: boolean;
  /** ενεργό invite token, αν υπάρχει και δεν έχει χρησιμοποιηθεί */
  pendingToken: string | null;
  payroll: PayrollFields;
}

/** Τα πεδία που χρειάζεται το αρχείο του λογιστή. */
export interface PayrollFields {
  payrollId: string | null;
  afm: string | null;
  firstName: string | null;
  lastName: string | null;
}

export interface PeriodEmployee extends PayrollFields {
  id: string;
  fullName: string;
  departmentName: string | null;
}

export interface PeriodWeek {
  weekStart: string;
  published: boolean;
  /** employeeId → 7 κελιά */
  cells: Record<string, CellValue[]>;
}

export interface PeriodData {
  employees: PeriodEmployee[];
  weeks: PeriodWeek[];
}

/** Το πρόγραμμα ενός εργαζόμενου για μία εβδομάδα (employee view). */
export interface MyScheduleWeek {
  weekStart: string;
  employeeName: string;
  /** null όταν η εβδομάδα δεν έχει δημοσιευτεί ακόμα */
  published: boolean;
  /** 7 κελιά (index 0 = Δευτέρα)· κενά όταν δεν είναι published */
  cells: CellValue[];
}

export interface AppNotification {
  id: string;
  kind: "schedule_published" | "schedule_changed" | string;
  /** { week_start, tenant_name } */
  payload: Record<string, string>;
  readAt: string | null;
  createdAt: string;
}

export type LeaveRequestStatus = "pending" | "approved" | "rejected" | "cancelled";

export interface LeaveRequest {
  id: string;
  employeeId: string;
  employeeName: string;
  /** leave type key (kanoniki/patrotita/…) ή "repo" */
  type: string;
  dateFrom: string; // ISO
  dateTo: string; // ISO
  comment: string | null;
  status: LeaveRequestStatus;
  decisionNote: string | null;
  createdAt: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  role: "owner" | "manager" | "accountant" | "employee";
}

export const EMPTY_CELL: CellValue = { kind: "empty" };

export const LEAVE_TYPES: Array<{ key: string; label: string }> = [
  { key: "kanoniki", label: "ΑΔΕΙΑ" },
  { key: "patrotita", label: "ΠΑΤΡΟΤΗΤΑ" },
  { key: "mitrotita", label: "ΜΗΤΡΟΤΗΤΑ" },
  { key: "astheneia", label: "ΑΣΘΕΝΕΙΑ" },
];
