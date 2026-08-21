"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import { LEAVE_TYPES, type LeaveRequest, type TenantInfo } from "@/lib/types";
import { shortDate } from "@/lib/domain/week";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}

const REQUEST_TYPES = [{ key: "repo", label: "ΡΕΠΟ" }, ...LEAVE_TYPES];

const STATUS_BADGE: Record<string, [string, string]> = {
  pending: ["Εκκρεμεί", "bg-orange-100 text-orange-700"],
  approved: ["Εγκρίθηκε", "bg-emerald-100 text-emerald-700"],
  rejected: ["Απορρίφθηκε", "bg-red-100 text-red-600"],
  cancelled: ["Ακυρώθηκε", "bg-zinc-100 text-zinc-500"],
};

export default function MyLeaveView({ repo, tenant }: Props) {
  const [requests, setRequests] = useState<LeaveRequest[] | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [type, setType] = useState("kanoniki");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  const load = useCallback(() => {
    repo
      .listMyLeaveRequests(tenant.id)
      .then(setRequests)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant.id]);

  useEffect(load, [load]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!dateFrom) return;
    const to = dateTo || dateFrom;
    if (to < dateFrom) {
      setError("Η ημερομηνία λήξης είναι πριν την έναρξη.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await repo.createLeaveRequest(tenant.id, {
        type,
        dateFrom,
        dateTo: to,
        comment: comment.trim() || undefined,
      });
      setFormOpen(false);
      setDateFrom("");
      setDateTo("");
      setComment("");
      setSent(true);
      setTimeout(() => setSent(false), 4000);
      load();
    } catch (e) {
      setError("Η υποβολή απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-3 py-3">
        <h1 className="mx-auto max-w-lg text-base font-bold text-zinc-900">Οι άδειές μου</h1>
      </header>

      <main className="mx-auto max-w-lg px-3 pb-24 pt-3">
        {error && (
          <div className="mb-3 flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold">
              ✕
            </button>
          </div>
        )}
        {sent && (
          <div className="mb-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            Το αίτημα στάλθηκε. Θα ενημερωθείς μόλις απαντήσει ο υπεύθυνος.
          </div>
        )}

        {!formOpen ? (
          <button
            onClick={() => setFormOpen(true)}
            className="mb-4 w-full rounded-xl bg-indigo-600 py-3 text-sm font-bold text-white active:bg-indigo-700"
          >
            + Νέο αίτημα άδειας / ρεπό
          </button>
        ) : (
          <form onSubmit={submit} className="mb-4 rounded-xl border border-zinc-200 bg-white p-3">
            <p className="mb-2 text-sm font-bold text-zinc-900">Νέο αίτημα</p>

            <label className="mb-1 block text-xs font-medium text-zinc-500">Τύπος</label>
            <div className="mb-3 flex flex-wrap gap-1.5">
              {REQUEST_TYPES.map((t) => (
                <button
                  key={t.key}
                  type="button"
                  onClick={() => setType(t.key)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    type === t.key
                      ? "bg-indigo-600 text-white"
                      : "bg-zinc-100 text-zinc-600 active:bg-zinc-200"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            <div className="mb-3 flex gap-2">
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-500">Από</label>
                <input
                  type="date"
                  required
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
                />
              </div>
              <div className="flex-1">
                <label className="mb-1 block text-xs font-medium text-zinc-500">
                  Έως <span className="text-zinc-400">(προαιρετικό)</span>
                </label>
                <input
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
                />
              </div>
            </div>

            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Σχόλιο <span className="text-zinc-400">(προαιρετικό)</span>
            </label>
            <input
              type="text"
              value={comment}
              maxLength={140}
              placeholder="π.χ. οικογενειακός λόγος"
              onChange={(e) => setComment(e.target.value)}
              className="mb-3 w-full rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400"
            />

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={busy}
                className="flex-1 rounded-lg bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
              >
                Αποστολή
              </button>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="rounded-lg border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-600"
              >
                Άκυρο
              </button>
            </div>
          </form>
        )}

        {!requests ? (
          <p className="p-6 text-center text-sm text-zinc-400">Φόρτωση…</p>
        ) : requests.length === 0 ? (
          <p className="rounded-xl border border-dashed border-zinc-300 p-5 text-center text-sm text-zinc-500">
            Δεν έχεις κάνει κανένα αίτημα ακόμα.
          </p>
        ) : (
          <div className="space-y-1.5">
            {requests.map((r) => (
              <div
                key={r.id}
                className="flex items-start justify-between rounded-xl border border-zinc-200 bg-white px-3 py-2.5"
              >
                <div>
                  <p className="text-sm font-semibold text-zinc-900">
                    {REQUEST_TYPES.find((t) => t.key === r.type)?.label ?? "ΑΔΕΙΑ"} ·{" "}
                    {r.dateFrom === r.dateTo
                      ? shortDate(r.dateFrom)
                      : `${shortDate(r.dateFrom)} – ${shortDate(r.dateTo)}`}
                  </p>
                  {r.comment && <p className="text-xs text-zinc-500">«{r.comment}»</p>}
                  {r.decisionNote && (
                    <p className="text-xs text-zinc-500">Σημείωση: {r.decisionNote}</p>
                  )}
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_BADGE[r.status][1]}`}
                >
                  {STATUS_BADGE[r.status][0]}
                </span>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
