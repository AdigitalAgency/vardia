"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import { LEAVE_TYPES, type LeaveRequest, type TenantInfo } from "@/lib/types";
import { shortDate } from "@/lib/domain/week";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  onDecided?: () => void;
}

function typeLabel(type: string): string {
  if (type === "repo") return "ΡΕΠΟ";
  return LEAVE_TYPES.find((lt) => lt.key === type)?.label ?? "ΑΔΕΙΑ";
}

function rangeLabel(r: LeaveRequest): string {
  return r.dateFrom === r.dateTo
    ? shortDate(r.dateFrom)
    : `${shortDate(r.dateFrom)} – ${shortDate(r.dateTo)}`;
}

const STATUS_BADGE: Record<string, [string, string]> = {
  pending: ["Εκκρεμεί", "bg-orange-100 text-orange-700"],
  approved: ["Εγκρίθηκε", "bg-emerald-100 text-emerald-700"],
  rejected: ["Απορρίφθηκε", "bg-red-100 text-red-600"],
  cancelled: ["Ακυρώθηκε", "bg-zinc-100 text-zinc-500"],
};

export default function LeaveRequestsView({ repo, tenant, onDecided }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(() => {
    repo
      .listLeaveRequests(tenant.id)
      .then(setRequests)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant.id]);

  useEffect(load, [load]);

  async function decide(r: LeaveRequest, approve: boolean) {
    if (
      !window.confirm(
        approve
          ? `Έγκριση: ${r.employeeName}, ${typeLabel(r.type)} ${rangeLabel(r)};\nΟι ημέρες θα μπουν αυτόματα στο πρόγραμμα.`
          : `Απόρριψη αιτήματος του/της ${r.employeeName};`
      )
    )
      return;
    setBusyId(r.id);
    try {
      await repo.decideLeaveRequest(tenant.id, r.id, approve);
      load();
      onDecided?.();
    } catch (e) {
      setError("Απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusyId(null);
    }
  }

  const pending = (requests ?? []).filter((r) => r.status === "pending");
  const history = (requests ?? []).filter((r) => r.status !== "pending");

  return (
    <div className="mx-auto max-w-2xl px-3 pb-24">
      <h1 className="py-3 text-lg font-bold text-zinc-900">Αιτήματα άδειας & ρεπό</h1>

      {error && (
        <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="font-bold">
            ✕
          </button>
        </div>
      )}

      {!requests ? (
        <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
      ) : (
        <>
          {pending.length === 0 && (
            <div className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
              Κανένα εκκρεμές αίτημα. 🎉
            </div>
          )}
          <div className="space-y-2">
            {pending.map((r) => (
              <div key={r.id} className="rounded-xl border border-zinc-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="text-sm font-bold text-zinc-900">{r.employeeName}</p>
                    <p className="text-sm text-zinc-600">
                      {typeLabel(r.type)} · {rangeLabel(r)}
                    </p>
                    {r.comment && <p className="mt-1 text-xs text-zinc-500">«{r.comment}»</p>}
                  </div>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status][1]}`}
                  >
                    {STATUS_BADGE[r.status][0]}
                  </span>
                </div>
                <div className="mt-2.5 flex gap-2">
                  <button
                    onClick={() => decide(r, true)}
                    disabled={busyId === r.id}
                    className="flex-1 rounded-lg bg-emerald-600 py-2 text-sm font-semibold text-white active:bg-emerald-700 disabled:opacity-50"
                  >
                    ✓ Έγκριση
                  </button>
                  <button
                    onClick={() => decide(r, false)}
                    disabled={busyId === r.id}
                    className="flex-1 rounded-lg border border-red-200 py-2 text-sm font-semibold text-red-600 active:bg-red-50 disabled:opacity-50"
                  >
                    ✕ Απόρριψη
                  </button>
                </div>
              </div>
            ))}
          </div>

          {history.length > 0 && (
            <>
              <h2 className="pb-2 pt-6 text-xs font-bold uppercase tracking-wider text-zinc-400">
                Ιστορικό
              </h2>
              <div className="space-y-1.5">
                {history.map((r) => (
                  <div
                    key={r.id}
                    className="flex items-center justify-between rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2"
                  >
                    <span className="text-sm text-zinc-700">
                      <span className="font-semibold">{r.employeeName}</span> ·{" "}
                      {typeLabel(r.type)} · {rangeLabel(r)}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status][1]}`}
                    >
                      {STATUS_BADGE[r.status][0]}
                    </span>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
