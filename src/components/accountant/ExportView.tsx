"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import type { PeriodData, TenantInfo } from "@/lib/types";
import { buildPeriodMatrix, toCsv } from "@/lib/domain/export";
import {
  EMPTY_SUMMARY,
  addSummaries,
  formatMinutes,
  summarizeWeek,
  type PeriodSummary,
} from "@/lib/domain/summary";
import { mondayOf, monthLabel, weekRangeLabel, weeksInMonth } from "@/lib/domain/week";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}

type Mode = "month" | "week";

function downloadCsv(filename: string, content: string) {
  const blob = new Blob([content], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export default function ExportView({ repo, tenant }: Props) {
  const today = new Date();
  const [mode, setMode] = useState<Mode>("month");
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth() + 1);
  const [weekStart, setWeekStart] = useState(() => mondayOf(today));
  const [data, setData] = useState<PeriodData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  const weekStarts = useMemo(
    () => (mode === "month" ? weeksInMonth(year, month) : [weekStart]),
    [mode, year, month, weekStart]
  );

  const load = useCallback(() => {
    setData(null);
    repo
      .getPeriod(tenant.id, weekStarts)
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant.id, weekStarts]);

  useEffect(load, [load]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.employees
      .map((e) => {
        const summary = data.weeks.reduce<PeriodSummary>(
          (acc, w) => addSummaries(acc, summarizeWeek(w.cells[e.id] ?? [])),
          { ...EMPTY_SUMMARY }
        );
        return { employee: e, summary };
      })
      .filter((r) => r.summary.workDays + r.summary.leaveDays + r.summary.restDays > 0);
  }, [data]);

  const totals = useMemo(
    () => rows.reduce<PeriodSummary>((acc, r) => addSummaries(acc, r.summary), { ...EMPTY_SUMMARY }),
    [rows]
  );

  const missingPayroll = useMemo(
    () =>
      rows.filter((r) => !r.employee.afm || !r.employee.payrollId).map((r) => r.employee.fullName),
    [rows]
  );
  const unpublished = (data?.weeks ?? []).filter((w) => !w.published);

  const periodLabel = mode === "month" ? monthLabel(year, month) : weekRangeLabel(weekStart);

  // Στο αρχείο μπαίνουν μόνο όσοι έχουν κάτι στην περίοδο — όχι κενές γραμμές
  // για προσωπικό που δεν δούλεψε (ίδιο φίλτρο με τη σύνοψη).
  const matrix = useMemo(() => {
    if (!data) return [];
    const included = new Set(rows.map((r) => r.employee.id));
    return buildPeriodMatrix({
      ...data,
      employees: data.employees.filter((e) => included.has(e.id)),
    });
  }, [data, rows]);

  function shiftPeriod(delta: number) {
    if (mode === "month") {
      const m = month + delta;
      if (m < 1) {
        setMonth(12);
        setYear((y) => y - 1);
      } else if (m > 12) {
        setMonth(1);
        setYear((y) => y + 1);
      } else {
        setMonth(m);
      }
    } else {
      const d = new Date(`${weekStart}T00:00:00Z`);
      d.setUTCDate(d.getUTCDate() + delta * 7);
      setWeekStart(d.toISOString().slice(0, 10));
    }
  }

  function doExport() {
    if (!data) return;
    const slug = tenant.slug || "vardia";
    const name =
      mode === "month"
        ? `${slug}-${year}-${String(month).padStart(2, "0")}.csv`
        : `${slug}-evdomada-${weekStart}.csv`;
    downloadCsv(name, toCsv(matrix));
  }

  return (
    <div className="mx-auto max-w-4xl px-3 pb-24">
      <h1 className="py-3 text-lg font-bold text-zinc-900">Εξαγωγή για μισθοδοσία</h1>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        <div className="flex overflow-hidden rounded-lg border border-zinc-300">
          {(["month", "week"] as Mode[]).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold ${
                mode === m ? "bg-indigo-600 text-white" : "bg-white text-zinc-600"
              }`}
            >
              {m === "month" ? "Μήνας" : "Εβδομάδα"}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1">
          <button
            onClick={() => shiftPeriod(-1)}
            className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-zinc-600 active:bg-zinc-100"
            aria-label="Προηγούμενη περίοδος"
          >
            ‹
          </button>
          <span className="min-w-[9rem] text-center text-sm font-bold text-zinc-800">
            {periodLabel}
          </span>
          <button
            onClick={() => shiftPeriod(1)}
            className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-zinc-600 active:bg-zinc-100"
            aria-label="Επόμενη περίοδος"
          >
            ›
          </button>
        </div>

        <span className="text-xs text-zinc-400">
          {weekStarts.length} {weekStarts.length === 1 ? "εβδομάδα" : "εβδομάδες"}
        </span>
      </div>

      {error && (
        <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
      )}

      {missingPayroll.length > 0 && (
        <div className="mb-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          ⚠ Λείπουν ΑΦΜ ή αριθμός μητρώου από {missingPayroll.length}{" "}
          {missingPayroll.length === 1 ? "εργαζόμενο" : "εργαζόμενους"}:{" "}
          <span className="font-semibold">{missingPayroll.slice(0, 5).join(", ")}</span>
          {missingPayroll.length > 5 && ` +${missingPayroll.length - 5}`}. Συμπλήρωσέ τα στο
          «Προσωπικό» — αλλιώς τα κελιά θα βγουν κενά στο αρχείο.
        </div>
      )}

      {unpublished.length > 0 && (
        <div className="mb-2 rounded-lg bg-orange-50 px-3 py-2 text-sm text-orange-800">
          ⚠ {unpublished.length}{" "}
          {unpublished.length === 1 ? "εβδομάδα δεν έχει" : "εβδομάδες δεν έχουν"} δημοσιευτεί (
          {unpublished.map((w) => weekRangeLabel(w.weekStart)).join(", ")}). Τα στοιχεία τους
          μπορεί να αλλάξουν.
        </div>
      )}

      {!data ? (
        <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 p-6 text-center text-sm text-zinc-500">
          Δεν υπάρχει πρόγραμμα για αυτή την περίοδο.
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-xl border border-zinc-200">
            <table className="w-full min-w-[34rem] border-collapse bg-white text-sm">
              <thead>
                <tr className="border-b border-zinc-200 bg-zinc-50 text-xs uppercase tracking-wide text-zinc-500">
                  <th className="px-3 py-2 text-left font-semibold">Εργαζόμενος</th>
                  <th className="px-2 py-2 text-right font-semibold">Ώρες</th>
                  <th className="px-2 py-2 text-right font-semibold">Νυχτερινά</th>
                  <th className="px-2 py-2 text-right font-semibold">Κυριακές</th>
                  <th className="px-2 py-2 text-right font-semibold">Ημ.</th>
                  <th className="px-2 py-2 text-right font-semibold">Ρεπό</th>
                  <th className="px-3 py-2 text-right font-semibold">Άδειες</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ employee, summary }) => (
                  <tr key={employee.id} className="border-b border-zinc-100 last:border-0">
                    <td className="px-3 py-2">
                      <span className="font-semibold text-zinc-900">{employee.fullName}</span>
                      {(!employee.afm || !employee.payrollId) && (
                        <span className="ml-2 text-xs text-amber-600">⚠ ελλιπή στοιχεία</span>
                      )}
                      <span className="block text-xs text-zinc-400">
                        {employee.departmentName ?? "—"}
                        {employee.payrollId ? ` · ΑΜ ${employee.payrollId}` : ""}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-right font-bold text-zinc-900">
                      {formatMinutes(summary.totalMinutes)}
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-600">
                      {formatMinutes(summary.nightMinutes)}
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-600">
                      {formatMinutes(summary.sundayMinutes)}
                    </td>
                    <td className="px-2 py-2 text-right text-zinc-600">{summary.workDays}</td>
                    <td className="px-2 py-2 text-right text-zinc-600">{summary.restDays}</td>
                    <td className="px-3 py-2 text-right text-zinc-600">{summary.leaveDays}</td>
                  </tr>
                ))}
                <tr className="bg-zinc-50 font-bold text-zinc-900">
                  <td className="px-3 py-2">Σύνολο ({rows.length})</td>
                  <td className="px-2 py-2 text-right">{formatMinutes(totals.totalMinutes)}</td>
                  <td className="px-2 py-2 text-right">{formatMinutes(totals.nightMinutes)}</td>
                  <td className="px-2 py-2 text-right">{formatMinutes(totals.sundayMinutes)}</td>
                  <td className="px-2 py-2 text-right">{totals.workDays}</td>
                  <td className="px-2 py-2 text-right">{totals.restDays}</td>
                  <td className="px-3 py-2 text-right">{totals.leaveDays}</td>
                </tr>
              </tbody>
            </table>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            <button
              onClick={doExport}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white active:bg-indigo-700"
            >
              ⬇ Κατέβασμα CSV
            </button>
            <button
              onClick={() => setShowPreview((v) => !v)}
              className="rounded-xl border border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-100"
            >
              {showPreview ? "Απόκρυψη" : "Προεπισκόπηση αρχείου"}
            </button>
          </div>

          {showPreview && (
            <div className="mt-3 overflow-x-auto rounded-xl border border-zinc-200 bg-zinc-50 p-3">
              <table className="border-collapse font-mono text-[11px]">
                <tbody>
                  {matrix.slice(0, 12).map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td
                          key={j}
                          className="whitespace-nowrap border border-zinc-200 bg-white px-1.5 py-1 text-zinc-700"
                        >
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {matrix.length > 12 && (
                <p className="mt-2 text-xs text-zinc-400">
                  …και άλλες {matrix.length - 12} γραμμές στο αρχείο.
                </p>
              )}
            </div>
          )}

          <p className="mt-3 text-xs text-zinc-400">
            Μορφή αρχείου: μία γραμμή ανά εργαζόμενο και εβδομάδα, ωράρια ως ΩΩΛΛΩΩΛΛ (17:00–01:00
            → 17000100 στην ημέρα έναρξης), ΑΝ για ρεπό, ονομασία άδειας για τις άδειες.
          </p>
        </>
      )}
    </div>
  );
}
