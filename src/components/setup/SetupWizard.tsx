"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { ScheduleRepo } from "@/lib/data/repo";
import {
  DEFAULT_DEPARTMENTS,
  DEFAULT_PRESETS,
  MANDATORY_PRESETS,
  type PresetDraft,
} from "@/lib/setupDefaults";
import { formatInterval, parseHHMM } from "@/lib/domain/time";

interface Props {
  repo: ScheduleRepo;
  /** true όταν ο χρήστης δεν έχει ακόμα κανένα κατάστημα */
  firstTime?: boolean;
  /** Το /demo δεν έχει σύνδεση — δείχνει μήνυμα αντί για μετάβαση στο app. */
  demoMode?: boolean;
}

interface DeptDraft {
  name: string;
  /** ονόματα, ένα ανά γραμμή — γρήγορη μαζική εισαγωγή */
  employeesText: string;
}

const STEPS = ["Το μαγαζί", "Τμήματα", "Προσωπικό", "Ωράρια", "Έτοιμο"] as const;

export default function SetupWizard({ repo, firstTime, demoMode }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);
  const [name, setName] = useState("");
  const [depts, setDepts] = useState<DeptDraft[]>(
    DEFAULT_DEPARTMENTS.filter((d) => d.suggested).map((d) => ({
      name: d.name,
      employeesText: "",
    }))
  );
  const [newDept, setNewDept] = useState("");
  const [presets, setPresets] = useState<PresetDraft[]>(
    DEFAULT_PRESETS.filter((p) => p.suggested).map(({ label, kind, start, end }) => ({
      label,
      kind,
      start,
      end,
    }))
  );
  const [customStart, setCustomStart] = useState("17:00");
  const [customEnd, setCustomEnd] = useState("01:00");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const employeeCount = useMemo(
    () =>
      depts.reduce(
        (n, d) => n + d.employeesText.split("\n").filter((s) => s.trim()).length,
        0
      ),
    [depts]
  );

  function toggleDept(deptName: string) {
    setDepts((ds) =>
      ds.some((d) => d.name === deptName)
        ? ds.filter((d) => d.name !== deptName)
        : [...ds, { name: deptName, employeesText: "" }]
    );
  }

  function addCustomDept() {
    const n = newDept.trim().toUpperCase();
    if (!n || depts.some((d) => d.name === n)) return;
    setDepts((ds) => [...ds, { name: n, employeesText: "" }]);
    setNewDept("");
  }

  function togglePreset(p: PresetDraft) {
    setPresets((ps) =>
      ps.some((x) => x.label === p.label)
        ? ps.filter((x) => x.label !== p.label)
        : [...ps, p]
    );
  }

  function addCustomPreset() {
    try {
      const start = parseHHMM(customStart.replace(":", ""));
      const end = parseHHMM(customEnd.replace(":", ""));
      const label = formatInterval({ start, end }).replace(/:00/g, "");
      if (presets.some((p) => p.label === label)) return;
      setPresets((ps) => [...ps, { label, kind: "work", start, end }]);
    } catch {
      setError("Μη έγκυρο ωράριο.");
    }
  }

  async function finish() {
    setBusy(true);
    setError(null);
    try {
      await repo.provisionTenant({
        name: name.trim(),
        departments: depts.map((d) => ({
          name: d.name,
          employees: d.employeesText
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean),
        })),
        presets: [...presets, ...MANDATORY_PRESETS],
      });
      if (demoMode) {
        setDone(true);
        setBusy(false);
        return;
      }
      router.push("/app");
      router.refresh();
    } catch (e) {
      setError((e as Error).message ?? "Κάτι πήγε στραβά.");
      setBusy(false);
    }
  }

  const canNext =
    (step === 0 && name.trim().length > 1) ||
    (step === 1 && depts.length > 0) ||
    (step === 2 && employeeCount > 0) ||
    step === 3 ||
    step === 4;

  if (done) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-6">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">🎉</p>
          <h1 className="mt-2 text-lg font-bold text-zinc-900">Το «{name}» στήθηκε</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {depts.length} τμήματα · {employeeCount} εργαζόμενοι · {presets.length} ωράρια.
            Σε πραγματικό λογαριασμό θα πήγαινες τώρα στο πρόγραμμα.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-dvh bg-zinc-50 pb-28">
      <header className="border-b border-zinc-200 bg-white px-4 py-3">
        <div className="mx-auto max-w-lg">
          <p className="text-lg font-black tracking-tight text-indigo-700">Vardia</p>
          <p className="text-xs text-zinc-500">
            {firstTime ? "Ας στήσουμε το μαγαζί σου" : "Νέο κατάστημα"} · Βήμα {step + 1} από{" "}
            {STEPS.length}
          </p>
          <div className="mt-2 flex gap-1">
            {STEPS.map((s, i) => (
              <div
                key={s}
                className={`h-1 flex-1 rounded-full ${
                  i <= step ? "bg-indigo-600" : "bg-zinc-200"
                }`}
              />
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-lg px-4 py-4">
        <h1 className="mb-3 text-xl font-bold text-zinc-900">{STEPS[step]}</h1>

        {error && (
          <div className="mb-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{error}</div>
        )}

        {step === 0 && (
          <>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Πώς λέγεται το μαγαζί;
            </label>
            <input
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="π.χ. The Little Mosque"
              className="w-full rounded-xl border border-zinc-300 px-3 py-3 text-base text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
            />
            <p className="mt-2 text-xs text-zinc-400">
              Αυτό βλέπουν οι εργαζόμενοι όταν μπαίνουν στο πρόγραμμα.
            </p>
          </>
        )}

        {step === 1 && (
          <>
            <p className="mb-3 text-sm text-zinc-500">
              Διάλεξε τα τμήματα του μαγαζιού. Έτσι ομαδοποιείται το πρόγραμμα, όπως στο χαρτί.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {DEFAULT_DEPARTMENTS.map((d) => {
                const on = depts.some((x) => x.name === d.name);
                return (
                  <button
                    key={d.name}
                    onClick={() => toggleDept(d.name)}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      on ? "bg-indigo-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-300"
                    }`}
                  >
                    {on ? "✓ " : "+ "}
                    {d.name}
                  </button>
                );
              })}
              {depts
                .filter((d) => !DEFAULT_DEPARTMENTS.some((x) => x.name === d.name))
                .map((d) => (
                  <button
                    key={d.name}
                    onClick={() => toggleDept(d.name)}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    ✓ {d.name}
                  </button>
                ))}
            </div>
            <div className="flex gap-2">
              <input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && addCustomDept()}
                placeholder="Άλλο τμήμα…"
                className="flex-1 rounded-xl border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
              />
              <button
                onClick={addCustomDept}
                className="rounded-xl border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700"
              >
                Προσθήκη
              </button>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <p className="mb-3 text-sm text-zinc-500">
              Γράψε τα ονόματα, ένα σε κάθε γραμμή. Μπορείς να τα αλλάξεις αργότερα.
            </p>
            <div className="space-y-3">
              {depts.map((d, i) => (
                <div key={d.name} className="rounded-xl border border-zinc-200 bg-white p-3">
                  <p className="mb-1.5 text-xs font-bold uppercase tracking-wider text-zinc-500">
                    {d.name}
                  </p>
                  <textarea
                    rows={4}
                    value={d.employeesText}
                    onChange={(e) =>
                      setDepts((ds) =>
                        ds.map((x, j) =>
                          j === i ? { ...x, employeesText: e.target.value } : x
                        )
                      )
                    }
                    placeholder={"Παπαδόπουλος\nΓεωργίου\n…"}
                    className="w-full resize-y rounded-lg border border-zinc-300 px-2 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              ))}
            </div>
            <p className="mt-2 text-xs text-zinc-400">{employeeCount} άτομα συνολικά</p>
          </>
        )}

        {step === 3 && (
          <>
            <p className="mb-3 text-sm text-zinc-500">
              Τα ωράρια που χρησιμοποιείς συχνά. Θα εμφανίζονται ως κουμπιά όταν φτιάχνεις το
              πρόγραμμα — και θα ταξινομούνται ανάλογα με το ποιος τα χρησιμοποιεί.
            </p>
            <div className="mb-3 flex flex-wrap gap-2">
              {DEFAULT_PRESETS.map((p) => {
                const on = presets.some((x) => x.label === p.label);
                return (
                  <button
                    key={p.label}
                    onClick={() => togglePreset({ label: p.label, kind: p.kind, start: p.start, end: p.end })}
                    className={`rounded-xl px-3 py-2 text-sm font-semibold ${
                      on ? "bg-indigo-600 text-white" : "bg-white text-zinc-600 ring-1 ring-zinc-300"
                    }`}
                  >
                    {on ? "✓ " : "+ "}
                    {p.label}
                  </button>
                );
              })}
              {presets
                .filter((p) => !DEFAULT_PRESETS.some((x) => x.label === p.label))
                .map((p) => (
                  <button
                    key={p.label}
                    onClick={() => togglePreset(p)}
                    className="rounded-xl bg-indigo-600 px-3 py-2 text-sm font-semibold text-white"
                  >
                    ✓ {p.label}
                  </button>
                ))}
            </div>
            <div className="flex items-center gap-2">
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
                onClick={addCustomPreset}
                className="rounded-lg border border-indigo-300 px-4 py-2 text-sm font-semibold text-indigo-700"
              >
                Προσθήκη
              </button>
            </div>
            <p className="mt-2 text-xs text-zinc-400">
              Το ΡΕΠΟ και οι άδειες υπάρχουν πάντα, δεν χρειάζεται να τα προσθέσεις.
            </p>
          </>
        )}

        {step === 4 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4">
            <p className="text-sm text-zinc-500">Θα δημιουργηθεί το κατάστημα:</p>
            <p className="mb-3 text-lg font-bold text-zinc-900">{name}</p>
            <dl className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <dt className="text-zinc-500">Τμήματα</dt>
                <dd className="font-semibold text-zinc-900">{depts.length}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Εργαζόμενοι</dt>
                <dd className="font-semibold text-zinc-900">{employeeCount}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-zinc-500">Ωράρια</dt>
                <dd className="font-semibold text-zinc-900">{presets.length} + ΡΕΠΟ/άδειες</dd>
              </div>
            </dl>
            <p className="mt-3 text-xs text-zinc-400">
              Μετά τη δημιουργία: φτιάχνεις το πρώτο πρόγραμμα και στέλνεις προσκλήσεις στους
              εργαζόμενους από το «Προσωπικό».
            </p>
          </div>
        )}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-zinc-200 bg-white px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex max-w-lg gap-2">
          {step > 0 && (
            <button
              onClick={() => setStep((s) => s - 1)}
              disabled={busy}
              className="rounded-xl border border-zinc-300 px-5 py-2.5 text-sm font-semibold text-zinc-600 disabled:opacity-50"
            >
              Πίσω
            </button>
          )}
          {step < STEPS.length - 1 ? (
            <button
              onClick={() => setStep((s) => s + 1)}
              disabled={!canNext}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-40"
            >
              Συνέχεια
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={busy}
              className="flex-1 rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
            >
              {busy ? "Δημιουργία…" : "Δημιουργία καταστήματος"}
            </button>
          )}
        </div>
      </div>
    </main>
  );
}
