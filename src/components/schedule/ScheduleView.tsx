"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import { EMPTY_CELL, type CellValue, type TenantInfo, type WeekBundle } from "@/lib/types";
import { violatesDailyRest, formatInterval } from "@/lib/domain/time";
import { DAY_NAMES, addDaysISO, mondayOf, weekRangeLabel } from "@/lib/domain/week";
import WeekGrid from "./WeekGrid";
import PresetPad from "./PresetPad";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
  demoBadge?: boolean;
}

interface Selection {
  employeeId: string;
  dayIndex: number;
}

export default function ScheduleView({ repo, tenant, demoBadge }: Props) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [bundle, setBundle] = useState<WeekBundle | null>(null);
  const [selected, setSelected] = useState<Selection | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const loadWeek = useCallback(() => {
    if (!tenant) return;
    setBundle(null);
    repo
      .getWeek(tenant.id, weekStart)
      .then(setBundle)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant, weekStart]);

  useEffect(loadWeek, [loadWeek]);

  const isEmpty = useMemo(
    () =>
      !!bundle &&
      Object.values(bundle.cells).every((row) => row.every((c) => c.kind === "empty")),
    [bundle]
  );

  /** Τοπικό bump ώστε οι προτάσεις να προσαρμόζονται αμέσως, χωρίς reload. */
  function bumpUsage(employeeId: string, value: CellValue, times = 1) {
    if (value.kind !== "work" || value.start == null || value.end == null) return;
    setBundle((b) => {
      if (!b) return b;
      const list = [...(b.usage[employeeId] ?? [])];
      const i = list.findIndex((u) => u.start === value.start && u.end === value.end);
      if (i >= 0) list[i] = { ...list[i], count: list[i].count + times };
      else list.push({ start: value.start!, end: value.end!, count: times });
      return { ...b, usage: { ...b.usage, [employeeId]: list } };
    });
  }

  function applyToSelected(value: CellValue) {
    if (!bundle || !selected || !tenant) return;
    const { employeeId, dayIndex } = selected;

    setBundle((b) => {
      if (!b) return b;
      const cells = { ...b.cells, [employeeId]: [...b.cells[employeeId]] };
      cells[employeeId][dayIndex] = value;
      const status = b.status === "published" ? "published_dirty" : b.status;
      return { ...b, cells, status };
    });
    bumpUsage(employeeId, value);
    repo
      .setCell(tenant.id, bundle.weekId, employeeId, dayIndex, value)
      .catch((e) => setError("Η αποθήκευση απέτυχε: " + String(e?.message ?? e)));
    advance();
  }

  /** Γεμίζει όλη τη γραμμή ενός εργαζόμενου, χωρίς να πατά εγκεκριμένες άδειες. */
  async function fillRow(employeeId: string, value: CellValue) {
    if (!bundle || !tenant) return;
    const name = bundle.employees.find((e) => e.id === employeeId)?.fullName ?? "";
    setSelected(null);
    setBundle((b) => {
      if (!b) return b;
      const row = (b.cells[employeeId] ?? []).map((c) =>
        c.kind === "adeia" ? c : { ...value }
      );
      const status = b.status === "published" ? "published_dirty" : b.status;
      return { ...b, cells: { ...b.cells, [employeeId]: row }, status };
    });
    bumpUsage(employeeId, value, 7);
    try {
      const res = await repo.setRow(tenant.id, bundle.weekId, employeeId, value);
      setNotice(
        res.skippedLeave > 0
          ? `${name}: γέμισαν ${res.filled} ημέρες. ${res.skippedLeave === 1 ? "1 άδεια έμεινε" : `${res.skippedLeave} άδειες έμειναν`} ως έχει.`
          : `${name}: όλη η εβδομάδα γέμισε.`
      );
      setTimeout(() => setNotice(null), 5000);
    } catch (e) {
      setError("Η αντιγραφή απέτυχε: " + String((e as Error)?.message ?? e));
      loadWeek();
    }
  }

  /** Long-press σε γεμάτο κελί → αντιγραφή του σε όλη την εβδομάδα. */
  function copyCellToWeek(employeeId: string, dayIndex: number) {
    if (!bundle) return;
    const cell = bundle.cells[employeeId]?.[dayIndex];
    if (!cell || cell.kind === "empty") return;
    const name = bundle.employees.find((e) => e.id === employeeId)?.fullName ?? "";
    const what =
      cell.kind === "work" && cell.start != null && cell.end != null
        ? formatInterval({ start: cell.start, end: cell.end })
        : cell.kind === "repo"
          ? "ΡΕΠΟ"
          : "ΑΔΕΙΑ";
    if (!window.confirm(`Να μπει «${what}» σε όλη την εβδομάδα του/της ${name};`)) return;
    fillRow(employeeId, cell);
  }

  /** Auto-advance: επόμενη ημέρα ίδιου εργαζόμενου· μετά την Κυριακή, επόμενος εργαζόμενος. */
  function advance() {
    if (!bundle || !selected) return;
    const { employeeId, dayIndex } = selected;
    if (dayIndex < 6) {
      setSelected({ employeeId, dayIndex: dayIndex + 1 });
      return;
    }
    const order = orderedEmployeeIds(bundle);
    const idx = order.indexOf(employeeId);
    if (idx >= 0 && idx < order.length - 1) {
      setSelected({ employeeId: order[idx + 1], dayIndex: 0 });
    } else {
      setSelected(null);
    }
  }

  async function copyPrevious() {
    if (!bundle || !tenant) return;
    setBusy(true);
    try {
      setBundle(await repo.copyPreviousWeek(tenant.id, bundle.weekId, weekStart));
    } catch (e) {
      setError("Η αντιγραφή απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    if (!bundle || !tenant) return;
    const warnings = restWarnings(bundle);
    const msg =
      warnings.length > 0
        ? `⚠ Προσοχή — πιθανή παραβίαση 11ωρης ανάπαυσης:\n\n${warnings.join(
            "\n"
          )}\n\nΔημοσίευση του προγράμματος;`
        : "Δημοσίευση του προγράμματος; Οι εργαζόμενοι θα δουν το ωράριό τους.";
    if (!window.confirm(msg)) return;
    setBusy(true);
    try {
      const res = await repo.publish(tenant.id, bundle.weekId);
      setBundle((b) => (b ? { ...b, status: "published" } : b));
      const people = res.notified === 1 ? "1 άτομο" : `${res.notified} άτομα`;
      setNotice(
        res.notified === 0
          ? "Το πρόγραμμα δημοσιεύτηκε. Κανείς δεν χρειάστηκε ειδοποίηση."
          : res.firstPublish
            ? `Το πρόγραμμα δημοσιεύτηκε. Ειδοποιήθηκ${res.notified === 1 ? "ε" : "αν"} ${people}.`
            : `Οι αλλαγές δημοσιεύτηκαν. Ειδοποιήθηκ${res.notified === 1 ? "ε" : "αν"} μόνο ${people} που επηρεάστηκ${res.notified === 1 ? "ε" : "αν"}.`
      );
      setTimeout(() => setNotice(null), 6000);
    } catch (e) {
      setError("Η δημοσίευση απέτυχε: " + String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  const selectionLabel = (() => {
    if (!bundle || !selected) return "";
    const emp = bundle.employees.find((e) => e.id === selected.employeeId);
    return `${emp?.fullName ?? ""} · ${DAY_NAMES[selected.dayIndex]}`;
  })();

  return (
    <div className="min-h-dvh bg-white pb-56">
      <header className="sticky top-0 z-30 border-b border-zinc-200 bg-white/95 px-3 py-2 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="text-base font-black tracking-tight text-indigo-700">Vardia</span>
            {demoBadge && (
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
                DEMO
              </span>
            )}
            <StatusChip status={bundle?.status} />
          </div>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setWeekStart((w) => addDaysISO(w, -7))}
              className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-zinc-600 active:bg-zinc-100"
              aria-label="Προηγούμενη εβδομάδα"
            >
              ‹
            </button>
            <span className="min-w-[7.5rem] text-center text-sm font-semibold text-zinc-800">
              {weekRangeLabel(weekStart)}
            </span>
            <button
              onClick={() => setWeekStart((w) => addDaysISO(w, 7))}
              className="rounded-lg px-2.5 py-1.5 text-lg leading-none text-zinc-600 active:bg-zinc-100"
              aria-label="Επόμενη εβδομάδα"
            >
              ›
            </button>
          </div>
        </div>
        <div className="mx-auto mt-1.5 flex max-w-5xl items-center gap-2">
          <button
            onClick={copyPrevious}
            disabled={busy || !bundle}
            className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-semibold text-zinc-700 active:bg-zinc-100 disabled:opacity-40"
          >
            ⧉ Αντιγραφή προηγούμενης
          </button>
          <button
            onClick={publish}
            disabled={busy || !bundle || isEmpty || bundle?.status === "published"}
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white active:bg-indigo-700 disabled:opacity-40"
          >
            Δημοσίευση
          </button>
        </div>
      </header>

      {error && (
        <div className="mx-auto mt-2 max-w-5xl px-3">
          <div className="flex items-center justify-between rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            <span>{error}</span>
            <button onClick={() => setError(null)} className="font-bold">
              ✕
            </button>
          </div>
        </div>
      )}

      {notice && (
        <div className="mx-auto mt-2 max-w-5xl px-3">
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {notice}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-5xl">
        {!bundle ? (
          <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
        ) : (
          <>
            {isEmpty && (
              <div className="m-3 rounded-xl border border-dashed border-zinc-300 p-4 text-center text-sm text-zinc-500">
                Κενή εβδομάδα. Ξεκίνα με «Αντιγραφή προηγούμενης» ή πάτησε ένα κελί.
              </div>
            )}
            <WeekGrid
              weekStart={weekStart}
              departments={bundle.departments}
              employees={bundle.employees}
              cells={bundle.cells}
              selected={selected}
              onSelect={(employeeId, dayIndex) => setSelected({ employeeId, dayIndex })}
              onLongPress={copyCellToWeek}
            />
          </>
        )}
      </main>

      {bundle && selected && (
        <PresetPad
          presets={bundle.presets}
          usage={bundle.usage[selected.employeeId]}
          employeeName={
            bundle.employees.find((e) => e.id === selected.employeeId)?.fullName ?? ""
          }
          selectionLabel={selectionLabel}
          onApply={applyToSelected}
          onClear={() => applyToSelected({ ...EMPTY_CELL })}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}

function StatusChip({ status }: { status?: WeekBundle["status"] }) {
  if (!status) return null;
  const map = {
    draft: ["Πρόχειρο", "bg-zinc-100 text-zinc-600"],
    published: ["Δημοσιευμένο", "bg-emerald-100 text-emerald-700"],
    published_dirty: ["Αλλαγές μετά τη δημοσίευση", "bg-orange-100 text-orange-700"],
  } as const;
  const [label, cls] = map[status];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${cls}`}>{label}</span>
  );
}

function orderedEmployeeIds(b: WeekBundle): string[] {
  const deptOrder = new Map(b.departments.map((d) => [d.id, d.sortOrder]));
  return [...b.employees]
    .sort(
      (a, x) =>
        (deptOrder.get(a.departmentId ?? "") ?? 99) - (deptOrder.get(x.departmentId ?? "") ?? 99) ||
        a.sortOrder - x.sortOrder
    )
    .map((e) => e.id);
}

/** Warnings 11ωρης ανάπαυσης μεταξύ διαδοχικών ημερών, ανά εργαζόμενο. */
function restWarnings(b: WeekBundle): string[] {
  const out: string[] = [];
  for (const emp of b.employees) {
    const row = b.cells[emp.id] ?? [];
    for (let d = 0; d < 6; d++) {
      const a = row[d];
      const nxt = row[d + 1];
      if (
        a?.kind === "work" &&
        nxt?.kind === "work" &&
        a.start != null &&
        a.end != null &&
        nxt.start != null &&
        nxt.end != null
      ) {
        const iva = { start: a.start, end: a.end };
        const ivb = { start: nxt.start, end: nxt.end };
        if (violatesDailyRest(iva, ivb, 1)) {
          out.push(
            `${emp.fullName}: ${DAY_NAMES[d]} ${formatInterval(iva)} → ${DAY_NAMES[d + 1]} ${formatInterval(ivb)}`
          );
        }
      }
    }
  }
  return out;
}
