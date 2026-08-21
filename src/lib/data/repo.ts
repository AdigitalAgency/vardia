import type { CellValue, TenantInfo, WeekBundle } from "@/lib/types";

/**
 * Το UI μιλάει ΜΟΝΟ σε αυτό το interface. Υλοποιήσεις: SupabaseRepo (πραγματικά
 * δεδομένα, RLS) και DemoRepo (in-memory, /demo χωρίς login).
 */
export interface ScheduleRepo {
  getTenants(): Promise<TenantInfo[]>;
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
}
