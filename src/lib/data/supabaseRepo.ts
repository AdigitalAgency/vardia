import type { SupabaseClient } from "@supabase/supabase-js";
import {
  EMPTY_CELL,
  type CellValue,
  type EmployeeInput,
  type ShiftUsage,
  type WeekBundle,
} from "@/lib/types";
import { addDaysISO, mondayOf } from "@/lib/domain/week";
import { slugify } from "@/lib/domain/slug";
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

/** Πεδία φόρμας → στήλες πίνακα. Τα κενά strings γίνονται null. */
function employeeColumns(input: EmployeeInput) {
  const t = (v: string | null | undefined) => v?.trim() || null;
  return {
    full_name: input.fullName.trim(),
    department_id: input.departmentId || null,
    phone: t(input.phone),
    email: t(input.email),
    hire_date: input.hireDate || null,
    contract_type: input.contractType || null,
    weekly_hours: input.weeklyHours ?? null,
    pay_type: input.payType || null,
    pay_amount: input.payAmount ?? null,
    notes: t(input.notes),
    payroll_id: t(input.payroll.payrollId),
    afm: t(input.payroll.afm),
    first_name: t(input.payroll.firstName),
    last_name: t(input.payroll.lastName),
  };
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

    async provisionTenant(input) {
      const { data, error } = await supabase.rpc("provision_tenant", {
        p_name: input.name,
        p_slug: slugify(input.name),
        p_departments: input.departments,
        p_presets: input.presets,
      });
      if (error) {
        if (error.message.includes("TOO_MANY_TENANTS")) {
          throw new Error("Έχεις ήδη πολλά καταστήματα σε αυτόν τον λογαριασμό.");
        }
        if (error.message.includes("NAME_REQUIRED")) {
          throw new Error("Δώσε όνομα καταστήματος.");
        }
        throw error;
      }
      const res = data as { tenant_id: string; slug: string };
      return { tenantId: res.tenant_id, slug: res.slug };
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

      // Συχνότητα ΩΡΑΡΙΩΝ ανά εργαζόμενο (all-time), preset ή custom αδιακρίτως —
      // έτσι μαθαίνει και τα δικά του custom ωράρια, όχι μόνο τα presets του μαγαζιού.
      const { data: usageRows, error: uerr } = await supabase
        .from("shifts")
        .select("employee_id, start_time, end_time")
        .eq("tenant_id", tenantId)
        .eq("kind", "work")
        .not("start_time", "is", null)
        .limit(20000);
      if (uerr) throw uerr;
      const usage: Record<string, ShiftUsage[]> = {};
      for (const r of usageRows ?? []) {
        if (r.start_time == null || r.end_time == null) continue;
        const list = (usage[r.employee_id] ??= []);
        const hit = list.find((u) => u.start === r.start_time && u.end === r.end_time);
        if (hit) hit.count += 1;
        else list.push({ start: r.start_time, end: r.end_time, count: 1 });
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
        usage,
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

    async setRow(tenantId, weekId, employeeId, value) {
      const { data: week, error: werr } = await supabase
        .from("schedule_weeks")
        .select("week_start_date, status")
        .eq("id", weekId)
        .single();
      if (werr) throw werr;

      // Οι εγκεκριμένες άδειες είναι απόφαση, όχι πρόχειρο — δεν τις πατάμε.
      const { data: existing, error: eerr } = await supabase
        .from("shifts")
        .select("date, kind")
        .eq("week_id", weekId)
        .eq("employee_id", employeeId);
      if (eerr) throw eerr;
      const protectedDates = new Set(
        (existing ?? []).filter((s) => s.kind === "adeia").map((s) => s.date)
      );

      const dates = Array.from({ length: 7 }, (_, i) =>
        addDaysISO(week.week_start_date, i)
      ).filter((d) => !protectedDates.has(d));

      if (dates.length) {
        const crosses =
          value.kind === "work" && value.start != null && value.end != null
            ? value.end <= value.start
            : false;
        const { error } = await supabase.from("shifts").upsert(
          dates.map((date) => ({
            tenant_id: tenantId,
            week_id: weekId,
            employee_id: employeeId,
            date,
            kind: value.kind,
            preset_id: value.presetId ?? null,
            start_time: value.start ?? null,
            end_time: value.end ?? null,
            crosses_midnight: crosses,
            leave_type: value.leaveType ?? null,
            updated_at: new Date().toISOString(),
          })),
          { onConflict: "week_id,employee_id,date" }
        );
        if (error) throw error;
      }

      if (week.status === "published") {
        await supabase
          .from("schedule_weeks")
          .update({ status: "published_dirty" })
          .eq("id", weekId);
      }

      return { filled: dates.length, skippedLeave: protectedDates.size };
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

    async listStaff(tenantId, includeArchived = false) {
      let q = supabase
        .from("employees")
        .select(
          "id, full_name, user_id, sort_order, status, afm, payroll_id, first_name, last_name, department_id, phone, email, hire_date, contract_type, weekly_hours, pay_type, pay_amount, notes, login_phone, departments(name)"
        )
        .eq("tenant_id", tenantId)
        .order("sort_order");
      if (!includeArchived) q = q.eq("status", "active");

      const { data, error } = await q;
      if (error) throw error;

      return (data ?? []).map((e) => ({
        id: e.id,
        fullName: e.full_name,
        departmentId: e.department_id,
        departmentName: (e.departments as unknown as { name: string } | null)?.name ?? null,
        phone: e.phone,
        email: e.email,
        hireDate: e.hire_date,
        contractType: e.contract_type,
        weeklyHours: e.weekly_hours == null ? null : Number(e.weekly_hours),
        payType: e.pay_type,
        payAmount: e.pay_amount == null ? null : Number(e.pay_amount),
        notes: e.notes,
        status: e.status,
        sortOrder: e.sort_order,
        hasAccess: !!e.user_id,
        loginPhone: e.login_phone,
        payroll: {
          payrollId: e.payroll_id,
          afm: e.afm,
          firstName: e.first_name,
          lastName: e.last_name,
        },
      }));
    },

    async createEmployee(tenantId, input) {
      const { data, error } = await supabase
        .from("employees")
        .insert({ tenant_id: tenantId, ...employeeColumns(input) })
        .select("id")
        .single();
      if (error) throw error;
      return data.id;
    },

    async updateEmployee(tenantId, employeeId, input) {
      const { error } = await supabase
        .from("employees")
        .update(employeeColumns(input))
        .eq("id", employeeId)
        .eq("tenant_id", tenantId);
      if (error) throw error;
    },

    async archiveEmployee(employeeId, archive) {
      const { error } = await supabase.rpc("archive_employee", {
        p_employee_id: employeeId,
        p_archive: archive,
      });
      if (error) throw error;
    },

    async deleteEmployee(employeeId) {
      const { error } = await supabase.rpc("delete_employee", { p_employee_id: employeeId });
      if (error) {
        throw new Error(
          error.message.includes("HAS_SHIFTS")
            ? "Ο εργαζόμενος έχει βάρδιες στο ιστορικό. Χρησιμοποίησε «Αρχειοθέτηση» ώστε να μη χαθεί το ιστορικό της μισθοδοσίας."
            : error.message
        );
      }
    },

    async createEmployeeAccount(tenantId, employeeId, phone, pin) {
      const res = await fetch("/api/staff/account", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tenantId, employeeId, phone, pin }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error ?? "Απέτυχε η δημιουργία κωδικών.");
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

    async createRoleInvite(tenantId, role) {
      const token = crypto.randomUUID().replace(/-/g, "");
      const { data: user } = await supabase.auth.getUser();
      await supabase
        .from("employee_invites")
        .delete()
        .eq("tenant_id", tenantId)
        .eq("role", role)
        .is("employee_id", null)
        .is("used_at", null);
      const { error } = await supabase.from("employee_invites").insert({
        tenant_id: tenantId,
        employee_id: null,
        role,
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
      // Το RPC κάνει τη δημοσίευση ΚΑΙ γράφει ειδοποιήσεις μόνο στους επηρεαζόμενους.
      const { data, error } = await supabase.rpc("publish_week", { p_week_id: weekId });
      if (error) throw error;
      const res = (data ?? {}) as { notified?: number; first_publish?: boolean };
      return { notified: res.notified ?? 0, firstPublish: res.first_publish ?? false };
    },

    async listNotifications(tenantId) {
      const { data, error } = await supabase
        .from("notifications")
        .select("id, kind, payload, read_at, created_at")
        .eq("tenant_id", tenantId)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data ?? []).map((n) => ({
        id: n.id,
        kind: n.kind,
        payload: (n.payload ?? {}) as Record<string, string>,
        readAt: n.read_at,
        createdAt: n.created_at,
      }));
    },

    async markNotificationsRead(tenantId, ids) {
      if (!ids.length) return;
      const { error } = await supabase
        .from("notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("tenant_id", tenantId)
        .in("id", ids);
      if (error) throw error;
    },

    async savePushSubscription(sub) {
      const { data: user } = await supabase.auth.getUser();
      if (!user.user || !sub.endpoint) return;
      const { error } = await supabase.from("push_subscriptions").upsert(
        {
          user_id: user.user.id,
          endpoint: sub.endpoint,
          keys: sub.keys ?? {},
        },
        { onConflict: "endpoint" }
      );
      if (error) throw error;
    },
  };
}
