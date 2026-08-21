import type {
  CellValue,
  LeaveRequest,
  MyScheduleWeek,
  StaffMember,
  TenantInfo,
  WeekBundle,
} from "@/lib/types";

/**
 * Το UI μιλάει ΜΟΝΟ σε αυτό το interface. Υλοποιήσεις: SupabaseRepo (πραγματικά
 * δεδομένα, RLS) και DemoRepo (in-memory, /demo χωρίς login).
 */
export interface ScheduleRepo {
  getTenants(): Promise<TenantInfo[]>;

  // ---------- Owner / manager ----------

  /** Φέρνει (ή δημιουργεί draft) την εβδομάδα με ό,τι χρειάζεται το grid. */
  getWeek(tenantId: string, weekStart: string): Promise<WeekBundle>;
  setCell(
    tenantId: string,
    weekId: string,
    employeeId: string,
    dayIndex: number,
    value: CellValue
  ): Promise<void>;
  /** Αντιγράφει τα κελιά της προηγούμενης εβδομάδας στην τρέχουσα (draft). */
  copyPreviousWeek(tenantId: string, weekId: string, weekStart: string): Promise<WeekBundle>;
  publish(tenantId: string, weekId: string): Promise<void>;
  listLeaveRequests(tenantId: string): Promise<LeaveRequest[]>;
  /**
   * Έγκριση/απόρριψη αιτήματος. Στην έγκριση, οι αντίστοιχες ημέρες
   * συμπληρώνονται αυτόματα στο πρόγραμμα (ΑΔΕΙΑ/ΡΕΠΟ).
   */
  decideLeaveRequest(
    tenantId: string,
    requestId: string,
    approve: boolean,
    note?: string
  ): Promise<void>;
  /** Προσωπικό με κατάσταση πρόσβασης (για τη διαχείριση προσκλήσεων). */
  listStaff(tenantId: string): Promise<StaffMember[]>;
  /** Δημιουργεί (ή ανανεώνει) invite token για εργαζόμενο· επιστρέφει το token. */
  createInvite(tenantId: string, employeeId: string): Promise<string>;

  // ---------- Employee ----------

  /** Το εβδομαδιαίο πρόγραμμα ΤΟΥ ΧΡΗΣΤΗ (μόνο δημοσιευμένο). */
  getMySchedule(tenantId: string, weekStart: string): Promise<MyScheduleWeek>;
  listMyLeaveRequests(tenantId: string): Promise<LeaveRequest[]>;
  createLeaveRequest(
    tenantId: string,
    input: { type: string; dateFrom: string; dateTo: string; comment?: string }
  ): Promise<void>;
}
