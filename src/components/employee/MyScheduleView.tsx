"use client";

import { useCallback, useEffect, useState } from "react";
import type { ScheduleRepo } from "@/lib/data/repo";
import { LEAVE_TYPES, type CellValue, type MyScheduleWeek, type TenantInfo } from "@/lib/types";
import { durationMinutes, formatInterval } from "@/lib/domain/time";
import { DAY_NAMES, addDaysISO, mondayOf, shortDate, weekRangeLabel } from "@/lib/domain/week";
import NotificationBanner from "./NotificationBanner";

interface Props {
  repo: ScheduleRepo;
  tenant: TenantInfo;
}


function hoursOf(c: CellValue): number {
  if (c.kind !== "work" || c.start == null || c.end == null) return 0;
  return durationMinutes({ start: c.start, end: c.end }) / 60;
}

function formatHours(h: number): string {
  const whole = Math.floor(h);
  const mins = Math.round((h - whole) * 60);
  return mins ? `${whole}ω ${mins}′` : `${whole}ω`;
}

export default function MyScheduleView({ repo, tenant }: Props) {
  const [weekStart, setWeekStart] = useState(() => mondayOf(new Date()));
  const [data, setData] = useState<MyScheduleWeek | null>(null);
  const [error, setError] = useState<string | null>(null);
  const todayISO = new Date().toISOString().slice(0, 10);

  const load = useCallback(() => {
    setData(null);
    repo
      .getMySchedule(tenant.id, weekStart)
      .then(setData)
      .catch((e) => setError(String(e?.message ?? e)));
  }, [repo, tenant.id, weekStart]);

  useEffect(load, [load]);

  const totalHours = (data?.cells ?? []).reduce((sum, c) => sum + hoursOf(c), 0);
  const workDays = (data?.cells ?? []).filter((c) => c.kind === "work").length;

  return (
    <div className="min-h-dvh bg-zinc-50">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white px-3 py-2">
        <div className="mx-auto flex max-w-lg items-center justify-between">
          <div>
            <p className="text-base font-black tracking-tight text-indigo-700">Vardia</p>
            {data?.employeeName && (
              <p className="text-xs text-zinc-500">{data.employeeName}</p>
            )}
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
      </header>

      <NotificationBanner repo={repo} tenant={tenant} onOpenWeek={setWeekStart} />

      <main className="mx-auto max-w-lg px-3 pb-24 pt-3">
        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {!data ? (
          <p className="p-8 text-center text-sm text-zinc-400">Φόρτωση…</p>
        ) : !data.published ? (
          <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-6 text-center">
            <p className="text-2xl">🕐</p>
            <p className="mt-2 text-sm font-semibold text-zinc-700">
              Το πρόγραμμα δεν έχει βγει ακόμα
            </p>
            <p className="mt-1 text-xs text-zinc-500">
              Μόλις το δημοσιεύσει ο υπεύθυνος, θα το δεις εδώ.
            </p>
          </div>
        ) : (
          <>
            <div className="mb-3 flex gap-2">
              <div className="flex-1 rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xl font-black text-indigo-700">{formatHours(totalHours)}</p>
                <p className="text-[11px] font-medium text-zinc-500">σύνολο εβδομάδας</p>
              </div>
              <div className="flex-1 rounded-xl bg-white p-3 text-center shadow-sm">
                <p className="text-xl font-black text-zinc-800">{workDays}</p>
                <p className="text-[11px] font-medium text-zinc-500">ημέρες εργασίας</p>
              </div>
            </div>

            <div className="space-y-1.5">
              {data.cells.map((c, i) => {
                const dateISO = addDaysISO(weekStart, i);
                const isToday = dateISO === todayISO;
                return (
                  <DayRow key={i} dayIndex={i} dateISO={dateISO} cell={c} isToday={isToday} />
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

function DayRow({
  dayIndex,
  dateISO,
  cell,
  isToday,
}: {
  dayIndex: number;
  dateISO: string;
  cell: CellValue;
  isToday: boolean;
}) {
  const isWork = cell.kind === "work" && cell.start != null && cell.end != null;
  const label =
    cell.kind === "work" && cell.start != null && cell.end != null
      ? formatInterval({ start: cell.start, end: cell.end })
      : cell.kind === "repo"
        ? "ΡΕΠΟ"
        : cell.kind === "adeia"
          ? (LEAVE_TYPES.find((lt) => lt.key === cell.leaveType)?.label ?? "ΑΔΕΙΑ")
          : "—";

  return (
    <div
      className={`flex items-center justify-between rounded-xl border bg-white px-3 py-3 ${
        isToday ? "border-indigo-400 ring-1 ring-indigo-200" : "border-zinc-200"
      }`}
    >
      <div>
        <p className="text-sm font-bold text-zinc-900">
          {DAY_NAMES[dayIndex]}
          {isToday && (
            <span className="ml-2 rounded-full bg-indigo-100 px-1.5 py-0.5 text-[10px] font-bold text-indigo-700">
              σήμερα
            </span>
          )}
        </p>
        <p className="text-xs text-zinc-400">{shortDate(dateISO)}</p>
      </div>
      <div className="text-right">
        <p
          className={`text-sm font-bold ${
            isWork
              ? "text-indigo-700"
              : cell.kind === "adeia"
                ? "text-amber-700"
                : "text-zinc-400"
          }`}
        >
          {label}
        </p>
        {isWork && (
          <p className="text-[11px] text-zinc-400">
            {formatHours(
              durationMinutes({ start: cell.start!, end: cell.end! }) / 60
            )}
          </p>
        )}
      </div>
    </div>
  );
}
