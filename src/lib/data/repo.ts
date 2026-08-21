import type {
  AppNotification,
  CellValue,
  LeaveRequest,
  MyScheduleWeek,
  PayrollFields,
  PeriodData,
  StaffMember,
  TenantInfo,
  WeekBundle,
} from "@/lib/types";

/**
 * Το UI μιλάει ΜΟΝΟ σε αυτό το interface. Υλοποιήσεις: SupabaseRepo (πραγματικά
 * δεδομένα, RLS) και DemoRepo (in-memory, /demo χωρίς login).
 */
export interface ProvisionInput {
  name: string;
  departments: Array<{ name: string; employees: string[] }>;
  presets: Array<{ label: string; kind: string; start: number | null; end: number | null }>;
}

export interface ScheduleRepo {
  getTenants(): Promise<TenantInfo[]>;
  /** Στήνει νέο κατάστημα και κάνει τον τρέχοντα χρήστη owner του. */
  provisionTenant(input: ProvisionInput): Promise<{ tenantId: string; slug: string }>;

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
  /** Δημοσίευση + στοχευμένες ειδοποιήσεις· επιστρέφει πόσοι ειδοποιήθηκαν. */
  publish(tenantId: string, weekId: string): Promise<{ notified: number; firstPublish: boolean }>;
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
  /** Πρόσκληση λογιστή ή υπεύθυνου — χωρίς σύνδεση με καρτέλα εργαζομένου. */
  createRoleInvite(tenantId: string, role: "accountant" | "manager"): Promise<string>;
  updateEmployeePayroll(
    tenantId: string,
    employeeId: string,
    fields: PayrollFields
  ): Promise<void>;

  // ---------- Λογιστής ----------

  /** Δεδομένα περιόδου για σύνοψη και export (μία ή περισσότερες εβδομάδες). */
  getPeriod(tenantId: string, weekStarts: string[]): Promise<PeriodData>;

  // ---------- Employee ----------

  /** Το εβδομαδιαίο πρόγραμμα ΤΟΥ ΧΡΗΣΤΗ (μόνο δημοσιευμένο). */
  getMySchedule(tenantId: string, weekStart: string): Promise<MyScheduleWeek>;
  listMyLeaveRequests(tenantId: string): Promise<LeaveRequest[]>;
  createLeaveRequest(
    tenantId: string,
    input: { type: string; dateFrom: string; dateTo: string; comment?: string }
  ): Promise<void>;

  // ---------- Ειδοποιήσεις (όλοι οι ρόλοι) ----------

  listNotifications(tenantId: string): Promise<AppNotification[]>;
  markNotificationsRead(tenantId: string, ids: string[]): Promise<void>;
  /** Αποθηκεύει push subscription του τρέχοντος χρήστη. */
  savePushSubscription(sub: PushSubscriptionJSON): Promise<void>;
}
