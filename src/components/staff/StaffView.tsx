"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import {
  CONTRACT_LABELS,
  PAY_LABELS,
  type Department,
  type EmployeeInput,
  type StaffMember,
  type TenantInfo,
} from "@/lib/types";
import EmployeeSheet from "./EmployeeSheet";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  /** Ο λογιστής βλέπει το ίδιο μητρώο αλλά χωρίς διαχείριση πρόσβασης. */
  payrollOnly?: boolean;
}

function payLabel(m: StaffMember): string {
  if (!m.payType || m.payAmount == null) return "—";
  const unit = m.payType === "hourly" ? "/ώρα" : m.payType === "daily" ? "/ημέρα" : "/μήνα";
  return `${m.payAmount}€ ${unit}`;
}

export default function StaffView({ repo, tenant, payrollOnly }: Props) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [showArchived, setShowArchived] = useState(false);
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [accountantBusy, setAccountantBusy] = useState(false);

  const load = useCallback(() => {
    repo
      .listStaff(tenant.id, showArchived)
      .then(setStaff)
      .catch((e) => setError(String(e?.message ?? e)));
    // Τα τμήματα έρχονται μαζί με την εβδομάδα· τα παίρνουμε από εκεί μία φορά.
    repo
      .getWeek(tenant.id, new Date().toISOString().slice(0, 10).replace(/-\d\d$/, "-01"))
      .then((b) => setDepartments(b.departments))
      .catch(() => {});
  }, [repo, tenant.id, showArchived]);

  useEffect(load, [load]);

  // Ο owner νοιάζεται μόνο για τον αριθμό μητρώου· το ΑΦΜ είναι δουλειά του λογιστή.
  const incomplete = useMemo(
    () =>
      (staff ?? []).filter((m) =>
        payrollOnly ? !m.payroll.afm || !m.payroll.payrollId : !m.payroll.payrollId
      ).length,
    [staff, payrollOnly]
  );
  const withoutAccess = useMemo(
    () => (staff ?? []).filter((m) => m.status === "active" && !m.hasAccess).length,
    [staff]
  );

  async function save(input: EmployeeInput) {
    if (creating) {
      await repo.createEmployee(tenant.id, input);
      setCreating(false);
      setNotice(`Προστέθηκε ο/η ${input.fullName}.`);
    } else if (editing) {
      await repo.updateEmployee(tenant.id, editing.id, input);
      setEditing(null);
      setNotice("Αποθηκεύτηκε.");
    }
    setTimeout(() => setNotice(null), 4000);
    load();
  }

  async function inviteAccountant() {
    setAccountantBusy(true);
    try {
      const token = await repo.createRoleInvite(tenant.id, "accountant");
      const url = `${location.origin}/invite/${token}`;
      const text = `Σύνδεσμος για το πρόγραμμα βαρδιών (λογιστής): ${url}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Vardia", text, url });
          return;
        } catch {
          /* ακυρώθηκε */
        }
      }
      await navigator.clipboard.writeText(url);
      setNotice("Ο σύνδεσμος του λογιστή αντιγράφηκε.");
      setTimeout(() => setNotice(null), 4000);
    } catch (e) {
      setError("Η πρόσκληση απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setAccountantBusy(false);
    }
  }

  return (
    <div className="mx-auto max-w-5xl px-3 pb-24">
      <div className="flex items-center justify-between gap-2 py-3">
        <h1 className="text-lg font-bold text-zinc-900">
          {payrollOnly ? "Στοιχεία μισθοδοσίας" : "Προσωπικό"}
        </h1>
        {!payrollOnly && (
          <button
            onClick={() => setCreating(true)}
            className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-bold text-white active:bg-indigo-700"
          >
            + Νέος
          </button>
        )}
      </div>

      {error && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}
      {notice && (
        <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {notice}
        </div>
      )}

      {staff && staff.length > 0 && (
        <div className="mb-3 flex flex-wrap gap-2 text-xs">
          {incomplete > 0 && (
            <span className="rounded-lg bg-amber-50 px-2.5 py-1.5 text-amber-800">
              ⚠ {incomplete} {payrollOnly ? "χωρίς ΑΦΜ/μητρώο" : "χωρίς αριθμό μητρώου"}
            </span>
          )}
          {!payrollOnly && withoutAccess > 0 && (
            <span className="rounded-lg bg-zinc-100 px-2.5 py-1.5 text-zinc-600">
              {withoutAccess} χωρίς κωδικούς πρόσβασης
            </span>
          )}
          <button
            onClick={() => setShowArchived((v) => !v)}
            className="rounded-lg border border-zinc-300 px-2.5 py-1.5 font-semibold text-zinc-600"
          >
            {showArchived ? "Απόκρυψη αρχειοθετημένων" : "Εμφάνιση αρχειοθετημένων"}
          </button>
        </div>
      )}

      {!staff ? (
        <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
      ) : staff.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center">
          <p className="text-sm font-semibold text-zinc-700">Κανένας εργαζόμενος ακόμα</p>
          <p className="mt-1 text-xs text-zinc-500">
            Πρόσθεσε τον πρώτο για να μπορείς να φτιάξεις πρόγραμμα.
          </p>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200">
          <table className="w-full min-w-[46rem] border-collapse bg-white text-sm">
            <thead>
              <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                <th className="px-3 py-2 text-left font-semibold">Εργαζόμενος</th>
                <th className="px-2 py-2 text-left font-semibold">Σύμβαση</th>
                <th className="px-2 py-2 text-right font-semibold">Ώρες/εβδ</th>
                <th className="px-2 py-2 text-right font-semibold">Αμοιβή</th>
                <th className="px-2 py-2 text-left font-semibold">
                  {payrollOnly ? "ΑΜ / ΑΦΜ" : "Αρ. μητρώου"}
                </th>
                {!payrollOnly && (
                  <th className="px-3 py-2 text-center font-semibold">Πρόσβαση</th>
                )}
              </tr>
            </thead>
            <tbody>
              {staff.map((m) => (
                <tr
                  key={m.id}
                  onClick={() => setEditing(m)}
                  className={`cursor-pointer border-b border-zinc-100 last:border-0 hover:bg-indigo-50/40 ${
                    m.status !== "active" ? "opacity-50" : ""
                  }`}
                >
                  <td className="px-3 py-2">
                    <span className="font-semibold text-zinc-900">{m.fullName}</span>
                    {m.status !== "active" && (
                      <span className="ml-2 rounded-full bg-zinc-200 px-1.5 py-0.5 text-[10px] font-bold text-zinc-600">
                        αρχείο
                      </span>
                    )}
                    <span className="block text-xs text-zinc-400">
                      {m.departmentName ?? "—"}
                    </span>
                  </td>
                  <td className="px-2 py-2 text-zinc-600">
                    {m.contractType ? CONTRACT_LABELS[m.contractType] : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-600">
                    {m.weeklyHours != null ? `${m.weeklyHours}ω` : "—"}
                  </td>
                  <td className="px-2 py-2 text-right text-zinc-600">
                    {payLabel(m)}
                    {m.payType && (
                      <span className="block text-[10px] text-zinc-400">
                        {PAY_LABELS[m.payType]}
                      </span>
                    )}
                  </td>
                  <td className="px-2 py-2 text-zinc-600">
                    {m.payroll.payrollId ? (
                      <>
                        {m.payroll.payrollId}
                        {payrollOnly && (
                          <span className="block text-[10px] text-zinc-400">
                            {m.payroll.afm ?? "χωρίς ΑΦΜ"}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-amber-600">⚠ λείπει</span>
                    )}
                  </td>
                  {!payrollOnly && (
                    <td className="px-3 py-2 text-center">
                      {m.hasAccess ? (
                        <span title={m.loginPhone ?? ""}>✅</span>
                      ) : (
                        <span className="text-xs text-zinc-400">—</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {!payrollOnly && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-bold text-zinc-900">Ο λογιστής σου</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Δώσ&apos; του πρόσβαση για να κατεβάζει μόνος του το αρχείο της μισθοδοσίας. Δεν
            μπορεί να αλλάξει το πρόγραμμα.
          </p>
          <button
            onClick={inviteAccountant}
            disabled={accountantBusy}
            className="mt-2 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-50 disabled:opacity-50"
          >
            Πρόσκληση λογιστή
          </button>
        </div>
      )}

      {(editing || creating) && (
        <EmployeeSheet
          member={editing}
          departments={departments}
          showAfm={payrollOnly}
          onSave={save}
          onCreateAccount={
            editing && !payrollOnly
              ? (phone, pin) => repo.createEmployeeAccount(tenant.id, editing.id, phone, pin)
              : undefined
          }
          onArchive={
            editing && !payrollOnly
              ? async (archive) => {
                  await repo.archiveEmployee(editing.id, archive);
                  setEditing(null);
                  load();
                }
              : undefined
          }
          onDelete={
            editing && !payrollOnly
              ? async () => {
                  await repo.deleteEmployee(editing.id);
                  setEditing(null);
                  load();
                }
              : undefined
          }
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}
