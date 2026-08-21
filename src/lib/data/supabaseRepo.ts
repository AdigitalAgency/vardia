import type { SupabaseClient } from "@supabase/supabase-js";
import { EMPTY_CELL, type CellValue, type WeekBundle } from "@/lib/types";
import { addDaysISO, mondayOf } from "@/lib/domain/week";
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

      // Συχνότητα χρήσης preset ανά εργαζόμενο (all-time) — δυναμική σειρά στο pad.
      const { data: usageRows, error: uerr } = await supabase
        .from("shifts")
        .select("employee_id, preset_id")
        .eq("tenant_id", tenantId)
        .eq("kind", "work")
        .not("preset_id", "is", null)
        .limit(20000);
      if (uerr) throw uerr;
      const presetUsage: Record<string, Record<string, number>> = {};
      for (const r of usageRows ?? []) {
        presetUsage[r.employee_id] ??= {};
        presetUsage[r.employee_id][r.preset_id!] =
          (presetUsage[r.employee_id][r.preset_id!] ?? 0) + 1;
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
        presetUsage,
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

    async listLeaveRequests(tenantId) {
      const { data, error } = await supabase
        .from("leave_requests")
        .select(
          "id, employee_id, type, date_from, date_to, comment, status, decision_note, created_at, employees(full_name)"
        )
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? [])
        .map((r) => ({
          id: r.id,
          employeeId: r.employee_id,
          employeeName:
            (r.employees as unknown as { full_name: string } | null)?.full_name ?? "—",
          type: r.type,
          dateFrom: r.date_from,
          dateTo: r.date_to,
          comment: r.comment,
          status: r.status,
          decisionNote: r.decision_note,
          createdAt: r.created_at,
        }))
        .sort((a, b) =>
          (a.status === "pending") === (b.status === "pending")
            ? b.createdAt.localeCompare(a.createdAt)
            : a.status === "pending"
              ? -1
              : 1
        );
    },

    async decideLeaveRequest(tenantId, requestId, approve, note) {
      const { data: user } = await supabase.auth.getUser();
      const { data: req, error } = await supabase
        .from("leave_requests")
        .update({
          status: approve ? "approved" : "rejected",
          decided_by: user.user?.id ?? null,
          decided_at: new Date().toISOString(),
          decision_note: note ?? null,
        })
        .eq("id", requestId)
        .eq("tenant_id", tenantId)
        .eq("status", "pending")
        .select("employee_id, type, date_from, date_to")
        .single();
      if (error) throw error;
      if (!approve || !req) return;

      // Auto-fill στο πρόγραμμα: κάθε ημέρα του αιτήματος → ΑΔΕΙΑ/ΡΕΠΟ.
      for (let d = req.date_from; d <= req.date_to; d = addDaysISO(d, 1)) {
        const weekStart = mondayOf(new Date(`${d}T00:00:00Z`));
        let { data: week } = await supabase
          .from("schedule_weeks")
          .select("id, status")
          .eq("tenant_id", tenantId)
          .eq("week_start_date", weekStart)
          .maybeSingle();
        if (!week) {
          const { data: created, error: cerr } = await supabase
            .from("schedule_weeks")
            .insert({ tenant_id: tenantId, week_start_date: weekStart, status: "draft" })
            .select("id, status")
            .single();
          if (cerr) throw cerr;
          week = created;
        }
        const { error: serr } = await supabase.from("shifts").upsert(
          {
            tenant_id: tenantId,
            week_id: week.id,
            employee_id: req.employee_id,
            date: d,
            kind: req.type === "repo" ? "repo" : "adeia",
            preset_id: null,
            start_time: null,
            end_time: null,
            crosses_midnight: false,
            leave_type: req.type === "repo" ? null : req.type,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "week_id,employee_id,date" }
        );
        if (serr) throw serr;
        if (week.status === "published") {
          await supabase
            .from("schedule_weeks")
            .update({ status: "published_dirty" })
            .eq("id", week.id);
        }
      }
    },

    async listStaff(tenantId) {
      const [emps, invites] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id, full_name, user_id, sort_order, afm, payroll_id, first_name, last_name, departments(name)"
          )
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("sort_order"),
        supabase
          .from("employee_invites")
          .select("employee_id, token, expires_at")
          .eq("tenant_id", tenantId)
          .is("used_at", null),
      ]);
      if (emps.error) throw emps.error;
      if (invites.error) throw invites.error;

      const now = Date.now();
      const tokenByEmployee = new Map(
        (invites.data ?? [])
          .filter((i) => Date.parse(i.expires_at) > now)
          .map((i) => [i.employee_id, i.token])
      );

      return (emps.data ?? []).map((e) => ({
        id: e.id,
        fullName: e.full_name,
        departmentName:
          (e.departments as unknown as { name: string } | null)?.name ?? null,
        hasAccess: !!e.user_id,
        pendingToken: tokenByEmployee.get(e.id) ?? null,
        payroll: {
          payrollId: e.payroll_id,
          afm: e.afm,
          firstName: e.first_name,
          lastName: e.last_name,
        },
      }));
    },

    async updateEmployeePayroll(tenantId, employeeId, fields) {
      const { error } = await supabase
        .from("employees")
        .update({
          payroll_id: fields.payrollId?.trim() || null,
          afm: fields.afm?.trim() || null,
          first_name: fields.firstName?.trim() || null,
          last_name: fields.lastName?.trim() || null,
        })
        .eq("id", employeeId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },

    async getPeriod(tenantId, weekStarts) {
      const [emps, weeksRes] = await Promise.all([
        supabase
          .from("employees")
          .select(
            "id, full_name, afm, payroll_id, first_name, last_name, sort_order, departments(name, sort_order)"
          )
          .eq("tenant_id", tenantId)
          .eq("status", "active")
          .order("sort_order"),
        supabase
          .from("schedule_weeks")
          .select("id, week_start_date, status")
          .eq("tenant_id", tenantId)
          .in("week_start_date", weekStarts),
      ]);
      if (emps.error) throw emps.error;
      if (weeksRes.error) throw weeksRes.error;

      const employees = (emps.data ?? []).map((e) => ({
        id: e.id,
        fullName: e.full_name,
        departmentName: (e.departments as unknown as { name: string } | null)?.name ?? null,
        payrollId: e.payroll_id,
        afm: e.afm,
        firstName: e.first_name,
        lastName: e.last_name,
      }));
      const employeeIds = employees.map((e) => e.id);
      const byStart = new Map(
        (weeksRes.data ?? []).map((w) => [w.week_start_date, w])
      );

      const weeks = await Promise.all(
        [...weekStarts].sort().map(async (weekStart) => {
          const w = byStart.get(weekStart);
          if (!w) {
            return {
              weekStart,
              published: false,
              cells: Object.fromEntries(
                employeeIds.map((id) => [
                  id,
                  Array.from({ length: 7 }, () => ({ ...EMPTY_CELL })),
                ])
              ),
            };
          }
          return {
            weekStart,
            published: w.status !== "draft",
            cells: await loadCells(supabase, w.id, weekStart, employeeIds),
          };
        })
      );

      return { employees, weeks };
    },

    async createInvite(tenantId, employeeId) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const { data: user } = await supabase.auth.getUser();
      // Ακυρώνουμε τυχόν παλιότερα αχρησιμοποίητα invites του ίδιου εργαζόμενου.
      await supabase
        .from("employee_invites")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("employee_id", employeeId)
        .is("used_at", null);
      const { error } = await supabase.from("employee_invites").insert({
        tenant_id: tenantId,
        employee_id: employeeId,
        token,
        created_by: user.user?.id ?? null,
      });
      if (error) throw error;
      return token;
    },

    async getMySchedule(tenantId, weekStart) {
      const { data: me, error: eerr } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (eerr) throw eerr;
      const empty = Array.from({ length: 7 }, () => ({ ...EMPTY_CELL }));
      if (!me) {
        return { weekStart, employeeName: "", published: false, cells: empty };
      }

      // Το RLS επιστρέφει schedule_weeks μόνο όταν είναι published.
      const { data: week, error: werr } = await supabase
        .from("schedule_weeks")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("week_start_date", weekStart)
        .maybeSingle();
      if (werr) throw werr;
      if (!week) {
        return { weekStart, employeeName: me.full_name, published: false, cells: empty };
      }

      const cells = await loadCells(supabase, week.id, weekStart, [me.id]);
      return {
        weekStart,
        employeeName: me.full_name,
        published: true,
        cells: cells[me.id] ?? empty,
      };
    },

    async listMyLeaveRequests(tenantId) {
      const { data, error } = await supabase
        .from("leave_requests")
        .select("id, employee_id, type, date_from, date_to, comment, status, decision_note, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.id,
        employeeId: r.employee_id,
        employeeName: "",
        type: r.type,
        dateFrom: r.date_from,
        dateTo: r.date_to,
        comment: r.comment,
        status: r.status,
        decisionNote: r.decision_note,
        createdAt: r.created_at,
      }));
    },

    async createLeaveRequest(tenantId, input) {
      const { data: me, error: eerr } = await supabase
        .from("employees")
        .select("id")
        .eq("tenant_id", tenantId)
        .maybeSingle();
      if (eerr) throw eerr;
      if (!me) throw new Error("Δεν βρέθηκε καρτέλα εργαζόμενου.");
      const { error } = await supabase.from("leave_requests").insert({
        tenant_id: tenantId,
        employee_id: me.id,
        type: input.type,
        date_from: input.dateFrom,
        date_to: input.dateTo,
        comment: input.comment ?? null,
        status: "pending",
      });
      if (error) throw error;
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
