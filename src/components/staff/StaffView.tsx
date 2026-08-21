"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { PayrollFields, StaffMember, TenantInfo } from "@/lib/types";
import PayrollSheet from "./PayrollSheet";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  /** Ο λογιστής βλέπει μόνο τα στοιχεία μισθοδοσίας, όχι τις προσκλήσεις. */
  payrollOnly?: boolean;
}

export default function StaffView({ repo, tenant, payrollOnly }: Props) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StaffMember | null>(null);

  const load = useCallback(() => {
    repo
      .listStaff(tenant.id)
      .then(setStaff)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant.id]);

  useEffect(load, [load]);

  function inviteUrl(token: string): string {
    return `${location.origin}/invite/${token}`;
  }

  async function share(member: StaffMember, token: string) {
    const url = inviteUrl(token);
    const text = `${member.fullName}, μπες στο πρόγραμμα βαρδιών εδώ: ${url}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: "Vardia", text, url });
        return;
      } catch {
        // ο χρήστης ακύρωσε το share — πέφτουμε στην αντιγραφή
      }
    }
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(member.id);
      setTimeout(() => setCopiedId(null), 2500);
    } catch {
      setError("Δεν έγινε αντιγραφή. Το link: " + url);
    }
  }

  async function createAndShare(member: StaffMember) {
    setBusyId(member.id);
    try {
      const token = await repo.createInvite(tenant.id, member.id);
      setStaff(
        (s) => s?.map((m) => (m.id === member.id ? { ...m, pendingToken: token } : m)) ?? s
      );
      await share(member, token);
    } catch (e) {
      setError("Η δημιουργία πρόσκλησης απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  async function inviteAccountant() {
    setBusyId("accountant");
    try {
      const token = await repo.createRoleInvite(tenant.id, "accountant");
      const url = `${location.origin}/invite/${token}`;
      const text = `Σύνδεσμος για το πρόγραμμα βαρδιών (λογιστής): ${url}`;
      if (navigator.share) {
        try {
          await navigator.share({ title: "Vardia", text, url });
          return;
        } catch {
          // ακυρώθηκε — αντιγράφουμε
        }
      }
      await navigator.clipboard.writeText(url);
      setCopiedId("accountant");
      setTimeout(() => setCopiedId(null), 2500);
    } catch (e) {
      setError("Η πρόσκληση απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  async function savePayroll(member: StaffMember, fields: PayrollFields) {
    await repo.updateEmployeePayroll(tenant.id, member.id, fields);
    setStaff((s) => s?.map((m) => (m.id === member.id ? { ...m, payroll: fields } : m)) ?? s);
    setEditing(null);
  }

  return (
    <div className="mx-auto max-w-2xl px-3 pb-24">
      <h1 className="py-3 text-lg font-bold text-zinc-900">
        {payrollOnly ? "Στοιχεία μισθοδοσίας" : "Προσωπικό"}
      </h1>
      <p className="-mt-2 mb-3 text-xs text-zinc-500">
        {payrollOnly
          ? "Συμπλήρωσε ΑΦΜ, αριθμό μητρώου και ονοματεπώνυμο — αυτά μπαίνουν στο αρχείο της μισθοδοσίας."
          : "Πάτησε σε έναν εργαζόμενο για τα στοιχεία μισθοδοσίας. Με το κουμπί «Πρόσκληση» στέλνεις τον προσωπικό του σύνδεσμο: μπαίνει με κινητό και PIN και βλέπει μόνο το δικό του ωράριο."}
      </p>

      {error && (
        <div className="mb-3 flex items-start justify-between gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span className="break-all">{error}</span>
          <button onClick={() => setError(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {!staff ? (
        <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
      ) : (
        <div className="space-y-1.5">
          {staff.map((m) => {
            const missing = !m.payroll.afm || !m.payroll.payrollId;
            return (
              <div
                key={m.id}
                className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
              >
                <button
                  onClick={() => setEditing(m)}
                  className="min-w-0 flex-1 text-left"
                  aria-label={`Στοιχεία μισθοδοσίας ${m.fullName}`}
                >
                  <p className="truncate text-sm font-bold text-zinc-900">{m.fullName}</p>
                  <p className="text-xs text-zinc-500">
                    {m.departmentName ?? "—"}
                    {missing ? (
                      <span className="ml-2 text-amber-600">⚠ λείπουν ΑΦΜ/μητρώο</span>
                    ) : (
                      <span className="ml-2 text-zinc-400">ΑΜ {m.payroll.payrollId}</span>
                    )}
                    {!payrollOnly &&
                      (m.hasAccess ? (
                        <span className="ml-2 text-emerald-600">✓ πρόσβαση</span>
                      ) : m.pendingToken ? (
                        <span className="ml-2 text-orange-600">πρόσκληση σε αναμονή</span>
                      ) : null)}
                  </p>
                </button>

                {!payrollOnly &&
                  (m.hasAccess ? (
                    <span className="shrink-0 text-lg">✅</span>
                  ) : m.pendingToken ? (
                    <button
                      onClick={() => share(m, m.pendingToken!)}
                      className="shrink-0 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-50"
                    >
                      {copiedId === m.id ? "✓ Αντιγράφηκε" : "Στείλε ξανά"}
                    </button>
                  ) : (
                    <button
                      onClick={() => createAndShare(m)}
                      disabled={busyId === m.id}
                      className="shrink-0 rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
                    >
                      {copiedId === m.id ? "✓ Αντιγράφηκε" : "Πρόσκληση"}
                    </button>
                  ))}
              </div>
            );
          })}
        </div>
      )}

      {!payrollOnly && staff && (
        <div className="mt-6 rounded-xl border border-zinc-200 bg-zinc-50 p-3">
          <p className="text-sm font-bold text-zinc-900">Ο λογιστής σου</p>
          <p className="mt-0.5 text-xs text-zinc-500">
            Δώσ&apos; του πρόσβαση για να κατεβάζει μόνος του το αρχείο της μισθοδοσίας. Δεν
            μπορεί να αλλάξει το πρόγραμμα.
          </p>
          <button
            onClick={inviteAccountant}
            disabled={busyId === "accountant"}
            className="mt-2 rounded-lg border border-indigo-300 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 active:bg-indigo-50 disabled:opacity-50"
          >
            {copiedId === "accountant" ? "✓ Αντιγράφηκε" : "Πρόσκληση λογιστή"}
          </button>
        </div>
      )}

      {editing && (
        <PayrollSheet
          member={editing}
          onSave={(fields) => savePayroll(editing, fields)}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
