"use client";

import { useState } from "react";
import { LEAVE_TYPES, type CellValue, type ShiftPreset, type ShiftUsage } from "@/lib/types";
import { parseHHMM } from "@/lib/domain/time";
import { orderedPresets, personalSuggestions, shortLabel } from "@/lib/domain/suggestions";

interface Props {
  presets: ShiftPreset[];
  /** ιστορικό ωραρίων του επιλεγμένου εργαζόμενου */
  usage: ShiftUsage[] | undefined;
  employeeName: string;
  onApply: (value: CellValue, wholeWeek: boolean) => void;
  onClear: () => void;
  onClose: () => void;
  selectionLabel: string;
}

export default function PresetPad({
  presets,
  usage,
  employeeName,
  onApply,
  onClear,
  onClose,
  selectionLabel,
}: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("17:00");
  const [customEnd, setCustomEnd] = useState("01:00");
  const [wholeWeek, setWholeWeek] = useState(false);

  const suggestions = personalSuggestions(usage, presets);
  const rest = orderedPresets(presets, usage, suggestions).filter((p) => p.kind === "work");

  function apply(value: CellValue) {
    onApply(value, wholeWeek);
    if (wholeWeek) setWholeWeek(false); // one-shot: δεν κρατιέται κατά λάθος
  }

  function applyCustom() {
    try {
      const start = parseHHMM(customStart.replace(":", ""));
      const end = parseHHMM(customEnd.replace(":", ""));
      apply({ kind: "work", presetId: null, start, end });
      setCustomOpen(false);
    } catch {
      // τα <input type="time"> το αποτρέπουν ούτως ή άλλως
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-zinc-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className="truncate text-sm font-medium text-zinc-600">{selectionLabel}</span>
          <div className="flex shrink-0 items-center gap-1">
            <button
              onClick={() => setWholeWeek((v) => !v)}
              aria-pressed={wholeWeek}
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                wholeWeek
                  ? "bg-indigo-600 text-white"
                  : "bg-zinc-100 text-zinc-600 active:bg-zinc-200"
              }`}
            >
              {wholeWeek ? "✓ Όλη η εβδομάδα" : "Όλη η εβδομάδα"}
            </button>
            <button
              onClick={onClose}
              className="rounded-full px-2 py-1 text-sm font-medium text-zinc-400 active:bg-zinc-100"
              aria-label="Κλείσιμο"
            >
              ✕
            </button>
          </div>
        </div>

        {wholeWeek && (
          <p className="mb-2 rounded-lg bg-indigo-50 px-2.5 py-1.5 text-xs text-indigo-800">
            Ό,τι διαλέξεις μπαίνει και στις 7 μέρες του/της {employeeName}. Οι εγκεκριμένες
            άδειες μένουν ως έχουν.
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="mb-2">
            <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Συχνά του/της {employeeName}
            </p>
            <div className="flex flex-wrap gap-2">
              {suggestions.map((s) => (
                <button
                  key={`${s.start}-${s.end}`}
                  onClick={() =>
                    apply({
                      kind: "work",
                      presetId: s.presetId,
                      start: s.start,
                      end: s.end,
                    })
                  }
                  className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-indigo-700"
                >
                  {s.label}
                  <span className="ml-1.5 text-[10px] font-normal text-indigo-200">
                    ×{s.count}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          {rest.map((p) => (
            <button
              key={p.id}
              onClick={() =>
                apply({ kind: "work", presetId: p.id, start: p.start, end: p.end })
              }
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ${
                suggestions.length
                  ? "bg-white text-indigo-700 ring-1 ring-indigo-200 active:bg-indigo-50"
                  : "bg-indigo-600 text-white active:bg-indigo-700"
              }`}
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => apply({ kind: "repo" })}
            className="rounded-xl bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-300"
          >
            ΡΕΠΟ
          </button>
          {LEAVE_TYPES.map((lt) => (
            <button
              key={lt.key}
              onClick={() => apply({ kind: "adeia", leaveType: lt.key })}
              className="rounded-xl bg-amber-100 px-4 py-2.5 text-sm font-semibold text-amber-800 active:bg-amber-200"
            >
              {lt.label}
            </button>
          ))}
          <button
            onClick={onClear}
            className="rounded-xl border border-dashed border-zinc-300 px-4 py-2.5 text-sm font-semibold text-zinc-500 active:bg-zinc-100"
          >
            Καθαρό
          </button>
          <button
            onClick={() => setCustomOpen((v) => !v)}
            className="rounded-xl border border-indigo-300 px-4 py-2.5 text-sm font-semibold text-indigo-700 active:bg-indigo-50"
          >
            Άλλο ωράριο…
          </button>
        </div>

        {customOpen && (
          <div className="mt-3 flex items-center gap-2">
            <input
              type="time"
              value={customStart}
              onChange={(e) => setCustomStart(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
            />
            <span className="text-zinc-400">–</span>
            <input
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900"
            />
            <button
              onClick={applyCustom}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white active:bg-indigo-700"
            >
              ΟΚ
            </button>
            <span className="text-xs text-zinc-400">
              {(() => {
                try {
                  return shortLabel(
                    parseHHMM(customStart.replace(":", "")),
                    parseHHMM(customEnd.replace(":", ""))
                  );
                } catch {
                  return "";
                }
              })()}
            </span>
          </div>
        )}

        <p className="mt-2 text-xs text-zinc-400">
          {wholeWeek
            ? "Θα γεμίσει όλη η γραμμή με μία επιλογή."
            : "Με κάθε επιλογή προχωράς αυτόματα στο επόμενο κελί. Κράτα πατημένο ένα κελί για αντιγραφή σε όλη την εβδομάδα."}
        </p>
      </div>
    </div>
  );
}
