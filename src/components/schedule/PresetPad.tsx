"use client";

import { useState } from "react";
import { LEAVE_TYPES, type CellValue, type ShiftPreset } from "@/lib/types";
import { parseHHMM } from "@/lib/domain/time";

interface Props {
  presets: ShiftPreset[];
  onApply: (value: CellValue) => void;
  onClear: () => void;
  onClose: () => void;
  selectionLabel: string;
}

export default function PresetPad({ presets, onApply, onClear, onClose, selectionLabel }: Props) {
  const [customOpen, setCustomOpen] = useState(false);
  const [customStart, setCustomStart] = useState("17:00");
  const [customEnd, setCustomEnd] = useState("01:00");

  const workPresets = presets.filter((p) => p.kind === "work");

  function applyPreset(p: ShiftPreset) {
    if (p.kind === "work") {
      onApply({ kind: "work", presetId: p.id, start: p.start, end: p.end });
    } else if (p.kind === "repo") {
      onApply({ kind: "repo" });
    } else {
      onApply({ kind: "adeia", leaveType: "kanoniki" });
    }
  }

  function applyCustom() {
    try {
      const start = parseHHMM(customStart.replace(":", ""));
      const end = parseHHMM(customEnd.replace(":", ""));
      onApply({ kind: "work", presetId: null, start, end });
      setCustomOpen(false);
    } catch {
      // invalid input — τα <input type="time"> το αποτρέπουν ούτως ή άλλως
    }
  }

  return (
    <div className="fixed inset-x-0 bottom-0 z-40 rounded-t-2xl border-t border-zinc-200 bg-white p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] shadow-[0_-8px_30px_rgba(0,0,0,0.12)]">
      <div className="mx-auto max-w-3xl">
        <div className="mb-2 flex items-center justify-between">
          <span className="text-sm font-medium text-zinc-600">{selectionLabel}</span>
          <button
            onClick={onClose}
            className="rounded-full px-3 py-1 text-sm font-medium text-zinc-500 active:bg-zinc-100"
          >
            Κλείσιμο ✕
          </button>
        </div>

        <div className="flex flex-wrap gap-2">
          {workPresets.map((p) => (
            <button
              key={p.id}
              onClick={() => applyPreset(p)}
              className="rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white active:bg-indigo-700"
            >
              {p.label}
            </button>
          ))}
          <button
            onClick={() => onApply({ kind: "repo" })}
            className="rounded-xl bg-zinc-200 px-4 py-2.5 text-sm font-semibold text-zinc-700 active:bg-zinc-300"
          >
            ΡΕΠΟ
          </button>
          {LEAVE_TYPES.map((lt) => (
            <button
              key={lt.key}
              onClick={() => onApply({ kind: "adeia", leaveType: lt.key })}
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
              className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            />
            <span className="text-zinc-400">–</span>
            <input
              type="time"
              value={customEnd}
              onChange={(e) => setCustomEnd(e.target.value)}
              className="rounded-lg border border-zinc-300 px-2 py-2 text-sm"
            />
            <button
              onClick={applyCustom}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white active:bg-indigo-700"
            >
              ΟΚ
            </button>
          </div>
        )}

        <p className="mt-2 text-xs text-zinc-400">
          Με κάθε επιλογή προχωράς αυτόματα στο επόμενο κελί.
        </p>
      </div>
    </div>
  );
}
