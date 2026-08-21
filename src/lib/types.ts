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
