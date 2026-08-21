"use client";

import { useState } from "react";
import type { PayrollFields, StaffMember } from "@/lib/types";

interface Props {
  member: StaffMember;
  onSave: (fields: PayrollFields) => Promise<void>;
  onClose: () => void;
}

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none";

export default function PayrollSheet({ member, onSave, onClose }: Props) {
  const [payrollId, setPayrollId] = useState(member.payroll.payrollId ?? "");
  const [afm, setAfm] = useState(member.payroll.afm ?? "");
  const [lastName, setLastName] = useState(member.payroll.lastName ?? "");
  const [firstName, setFirstName] = useState(member.payroll.firstName ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const cleanAfm = afm.replace(/\D/g, "");
    if (cleanAfm && cleanAfm.length !== 9) {
      setError("Το ΑΦΜ έχει 9 ψηφία.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({
        payrollId: payrollId.trim() || null,
        afm: cleanAfm || null,
        lastName: lastName.trim() || null,
        firstName: firstName.trim() || null,
      });
    } catch (e) {
      setError("Η αποθήκευση απέτυχε: " + String((e as Error)?.message ?? e));
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/30 sm:items-center">
      <div className="w-full max-w-md rounded-t-2xl bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:rounded-2xl">
        <div className="mb-3 flex items-start justify-between">
          <div>
            <h2 className="text-base font-bold text-zinc-900">{member.fullName}</h2>
            <p className="text-xs text-zinc-500">Στοιχεία για το αρχείο της μισθοδοσίας</p>
          </div>
          <button onClick={onClose} className="px-2 text-sm font-bold text-zinc-400">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500">
                Αριθμός μητρώου
              </label>
              <input
                value={payrollId}
                onChange={(e) => setPayrollId(e.target.value)}
                placeholder="101"
                inputMode="numeric"
                className={INPUT}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Α.Φ.Μ</label>
              <input
                value={afm}
                onChange={(e) => setAfm(e.target.value)}
                placeholder="123456789"
                inputMode="numeric"
                maxLength={12}
                className={INPUT}
              />
            </div>
          </div>

          <div className="flex gap-2">
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Επώνυμο</label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder={member.fullName}
                className={INPUT}
              />
            </div>
            <div className="flex-1">
              <label className="mb-1 block text-xs font-medium text-zinc-500">Όνομα</label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className={INPUT}
              />
            </div>
          </div>

          <p className="text-[11px] text-zinc-400">
            Αν αφήσεις κενά το ονοματεπώνυμο, στο αρχείο μπαίνει το «{member.fullName}» όπως
            είναι γραμμένο στο πρόγραμμα.
          </p>

          {error && <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
          >
            Αποθήκευση
          </button>
        </form>
      </div>
    </div>
  );
}
