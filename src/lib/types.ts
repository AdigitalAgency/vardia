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

export type ContractType = "full" | "part" | "rotational";
export type PayType = "hourly" | "daily" | "monthly";

export const CONTRACT_LABELS: Record<ContractType, string> = {
  full: "Πλήρης",
  part: "Μερική",
  rotational: "Εκ περιτροπής",
};

export const PAY_LABELS: Record<PayType, string> = {
  hourly: "Ωρομίσθιο",
  daily: "Ημερομίσθιο",
  monthly: "Μηνιαίος",
};

/** Η πλήρης καρτέλα εργαζομένου, όπως τη διαχειρίζεται ο owner. */
export interface StaffMember {
  id: string;
  fullName: string;
  departmentId: string | null;
  departmentName: string | null;
  phone: string | null;
  email: string | null;
  hireDate: string | null;
  contractType: ContractType | null;
  weeklyHours: number | null;
  payType: PayType | null;
  payAmount: number | null;
  notes: string | null;
  status: string;
  sortOrder: number;
  /** true όταν η καρτέλα έχει δεθεί με λογαριασμό σύνδεσης */
  hasAccess: boolean;
  loginPhone: string | null;
  payroll: PayrollFields;
}

/**
 * Τα πεδία που χρειάζεται το αρχείο του λογιστή.
 * Το `afm` είναι στήλη του export — επεξεργάσιμο ΜΟΝΟ από την οθόνη του λογιστή.
 */
export interface PayrollFields {
  payrollId: string | null;
  afm: string | null;
  firstName: string | null;
  lastName: string | null;
}

/** Τα επεξεργάσιμα πεδία της καρτέλας (ό,τι στέλνει η φόρμα). */
export type EmployeeInput = Omit<
  StaffMember,
  "id" | "departmentName" | "hasAccess" | "loginPhone" | "status" | "sortOrder"
>;

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
