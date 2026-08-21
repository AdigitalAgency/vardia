"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { StaffMember, TenantInfo } from "@/lib/types";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}

export default function StaffView({ repo, tenant }: Props) {
  const [staff, setStaff] = useState<StaffMember[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

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

  return (
    <div className="mx-auto max-w-2xl px-3 pb-24">
      <h1 className="py-3 text-lg font-bold text-zinc-900">Προσωπικό</h1>
      <p className="-mt-2 mb-3 text-xs text-zinc-500">
        Στείλε σε κάθε εργαζόμενο τον προσωπικό του σύνδεσμο. Μπαίνει με κινητό και PIN και
        βλέπει μόνο το δικό του ωράριο.
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
          {staff.map((m) => (
            <div
              key={m.id}
              className="flex items-center justify-between gap-2 rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-bold text-zinc-900">{m.fullName}</p>
                <p className="text-xs text-zinc-500">
                  {m.departmentName ?? "—"}
                  {m.hasAccess ? (
                    <span className="ml-2 text-emerald-600">✓ έχει πρόσβαση</span>
                  ) : m.pendingToken ? (
                    <span className="ml-2 text-orange-600">πρόσκληση σε αναμονή</span>
                  ) : (
                    <span className="ml-2 text-zinc-400">χωρίς πρόσβαση</span>
                  )}
                </p>
              </div>

              {m.hasAccess ? (
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
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
