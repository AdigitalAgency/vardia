import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_CELL, type CellValue, type WeekBundle } from "@/lib/types";
import { addDaysISO } from "@/lib/domain/week";
import type { ScheduleRepo } from "./repo";

function cellFromShiftRow(row: {
  kind: string;
  preset_id: string | null;
  start_time: number | null;
  end_time: number | null;
  leave_type: string | null;
  note: string | null;
}): CellValue {
  return {
    kind: row.kind as CellValue["kind"],
    presetId: row.preset_id,
    start: row.start_time,
    end: row.end_time,
    leaveType: row.leave_type,
    note: row.note,
  };
}

async function loadCells(
  supabase: SupabaseClient,
  weekId: string,
  weekStart: string,
  employeeIds: string[]
): Promise<Record<string, CellValue[]>> {
  const cells: Record<string, CellValue[]> = Object.fromEntries(
    employeeIds.map((id) => [id, Array.from({ length: 7 }, () => ({ ...EMPTY_CELL }))])
  );
  const { data: shifts, error } = await supabase
    .from("shifts")
    .select("employee_id, date, kind, preset_id, start_time, end_time, leave_type, note")
    .eq("week_id", weekId);
  if (error) throw error;
  for (const s of shifts ?? []) {
    const dayIndex = Math.round(
      (Date.parse(s.date) - Date.parse(weekStart)) / (24 * 3600 * 1000)
    );
    if (dayIndex >= 0 && dayIndex < 7 && cells[s.employee_id]) {
      cells[s.employee_id][dayIndex] = cellFromShiftRow(s);
    }
  }
  return cells;
}

export function createSupabaseRepo(supabase: SupabaseClient): ScheduleRepo {
  return {
    async getTenants() {
      const { data, error } = await supabase
        .from("memberships")
        .select("role, tenants(id, name, slug)")
        .eq("status", "active");
      if (error) throw error;
      return (data ?? [])
        .filter((m) => m.tenants)
        .map((m) => {
          const t = m.tenants as unknown as { id: string; name: string; slug: string };
          return { id: t.id, name: t.name, slug: t.slug, role: m.role };
        });
    },

    async getWeek(tenantId, weekStart) {
      // Βρες ή δημιούργησε (draft) τη schedule_week.
      const { data: existing, error: werr } = await supabase
        .from("schedule_weeks")
        .select("id, status")
        .eq("tenant_id", tenantId)
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (werr) throw werr;

      let week = existing;
      if (!week) {
        const { data: created, error } = await supabase
          .from("schedule_weeks")
          .insert({ tenant_id: tenantId, week_start_date: weekStart, status: "draft" })
          .select("id, status")
          .single();
        if (error) throw error;
        week = created;
      }

      const [departments, employees, presets] = await Promise.all([
        supabase
          .from("departments")
          .select("id, name, sort_order")
          .eq("tenant_id", tenantId)
          .order("sort_order"),
        supabase
          .from("employees")
          .select("id, department_id, full_name, sort_order")
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("sort_order"),
        supabase
          .from("shift_presets")
          .select("id, label, kind, start_time, end_time, sort_order")
          .eq("tenant_id", tenantId)
          .order("sort_order"),
      ]);
      for (const r of [departments, employees, presets]) {
        if (r.error) throw r.error;
      }

      const employeeList = (employees.data ?? []).map((e) => ({
        id: e.id,
        departmentId: e.department_id,
        fullName: e.full_name,
        sortOrder: e.sort_order,
      }));

      return {
        weekId: week.id,
        weekStart,
        status: week.status,
        departments: (departments.data ?? []).map((d) => ({
          id: d.id,
          name: d.name,
          sortOrder: d.sort_order,
        })),
        employees: employeeList,
        presets: (presets.data ?? []).map((p) => ({
          id: p.id,
          label: p.label,
          kind: p.kind,
          start: p.start_time,
          end: p.end_time,
          sortOrder: p.sort_order,
        })),
        cells: await loadCells(supabase, week.id, weekStart, employeeList.map((e) => e.id)),
      } satisfies WeekBundle;
    },

    async setCell(tenantId, weekId, employeeId, dayIndex, value) {
      const { data: week, error: werr } = await supabase
        .from("schedule_weeks")
        .select("week_start_date, status")
        .eq("id", weekId)
        .single();
      if (werr) throw werr;
      const date = addDaysISO(week.week_start_date, dayIndex);

      if (value.kind === "empty") {
        const { error } = await supabase
          .from("shifts")
          .delete()
          .eq("week_id", weekId)
          .eq("employee_id", employeeId)
          .eq("date", date);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("shifts").upsert(
          {
            tenant_id: tenantId,
            week_id: weekId,
            employee_id: employeeId,
            date,
            kind: value.kind,
            preset_id: value.presetId ?? null,
            start_time: value.start ?? null,
            end_time: value.end ?? null,
            crosses_midnight:
              value.kind === "work" && value.start != null && value.end != null
                ? value.end <= value.start
                : false,
            leave_type: value.leaveType ?? null,
            note: value.note ?? null,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "week_id,employee_id,date" }
        );
        if (error) throw error;
      }

      if (week.status === "published") {
        const { error } = await supabase
          .from("schedule_weeks")
          .update({ status: "published_dirty" })
          .eq("id", weekId);
        if (error) throw error;
      }
    },

    async copyPreviousWeek(tenantId, weekId, weekStart) {
      const prevStart = addDaysISO(weekStart, -7);
      const { data: prevWeek, error } = await supabase
        .from("schedule_weeks")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("week_start_date", prevStart)
        .maybeSingle();
      if (error) throw error;

      if (prevWeek) {
        const { data: prevShifts, error: serr } = await supabase
          .from("shifts")
          .select("employee_id, date, kind, preset_id, start_time, end_time, crosses_midnight, leave_type")
          .eq("week_id", prevWeek.id);
        if (serr) throw serr;
        // Άδειες/ρεπό της προηγούμενης εβδομάδας ΔΕΝ αντιγράφονται ως άδειες —
        // μεταφέρεται μόνο το εργασιακό μοτίβο.
        const rows = (prevShifts ?? [])
          .filter((s) => s.kind === "work" || s.kind === "repo")
          .map((s) => ({
            tenant_id: tenantId,
            week_id: weekId,
            employee_id: s.employee_id,
            date: addDaysISO(s.date, 7),
            kind: s.kind,
            preset_id: s.preset_id,
            start_time: s.start_time,
            end_time: s.end_time,
            crosses_midnight: s.crosses_midnight,
          }));
        if (rows.length) {
          const { error: uerr } = await supabase
            .from("shifts")
            .upsert(rows, { onConflict: "week_id,employee_id,date" });
          if (uerr) throw uerr;
        }
      }
      return this.getWeek(tenantId, weekStart);
    },

    async publish(_tenantId, weekId) {
      const { data: user } = await supabase.auth.getUser();
      const { error } = await supabase
        .from("schedule_weeks")
        .update({
          status: "published",
          published_at: new Date().toISOString(),
          published_by: user.user?.id ?? null,
        })
        .eq("id", weekId);
      if (error) throw error;
    },
  };
}
