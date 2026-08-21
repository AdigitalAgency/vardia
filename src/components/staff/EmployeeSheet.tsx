"use client";

import { useState } from "react";
import {
  CONTRACT_LABELS,
  PAY_LABELS,
  type ContractType,
  type Department,
  type EmployeeInput,
  type PayType,
  type StaffMember,
} from "@/lib/types";
import { isValidPin, normalizePhone } from "@/lib/domain/phone";

interface Props {
  member: StaffMember | null; // null = νέος εργαζόμενος
  departments: Department[];
  onSave: (input: EmployeeInput) => Promise<void>;
  onCreateAccount?: (phone: string, pin: string) => Promise<void>;
  onArchive?: (archive: boolean) => Promise<void>;
  onDelete?: () => Promise<void>;
  onClose: () => void;
}

const INPUT =
  "w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none";
const LABEL = "mb-1 block text-xs font-medium text-zinc-500";

function emptyInput(): EmployeeInput {
  return {
    fullName: "",
    departmentId: null,
    position: null,
    phone: null,
    email: null,
    hireDate: null,
    birthDate: null,
    amka: null,
    contractType: null,
    weeklyHours: null,
    payType: null,
    payAmount: null,
    notes: null,
    payroll: { payrollId: null, afm: null, firstName: null, lastName: null },
  };
}

function fromMember(m: StaffMember): EmployeeInput {
  return {
    fullName: m.fullName,
    departmentId: m.departmentId,
    position: m.position,
    phone: m.phone,
    email: m.email,
    hireDate: m.hireDate,
    birthDate: m.birthDate,
    amka: m.amka,
    contractType: m.contractType,
    weeklyHours: m.weeklyHours,
    payType: m.payType,
    payAmount: m.payAmount,
    notes: m.notes,
    payroll: { ...m.payroll },
  };
}

export default function EmployeeSheet({
  member,
  departments,
  onSave,
  onCreateAccount,
  onArchive,
  onDelete,
  onClose,
}: Props) {
  const [form, setForm] = useState<EmployeeInput>(member ? fromMember(member) : emptyInput());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Πρόσβαση
  const [accountOpen, setAccountOpen] = useState(false);
  const [loginPhone, setLoginPhone] = useState(member?.loginPhone ?? member?.phone ?? "");
  const [pin, setPin] = useState("");
  const [accountDone, setAccountDone] = useState<{ phone: string; pin: string } | null>(null);

  const isNew = !member;

  function set<K extends keyof EmployeeInput>(key: K, value: EmployeeInput[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  function setPayroll<K extends keyof EmployeeInput["payroll"]>(
    key: K,
    value: EmployeeInput["payroll"][K]
  ) {
    setForm((f) => ({ ...f, payroll: { ...f.payroll, [key]: value } }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.fullName.trim()) {
      setError("Το όνομα είναι απαραίτητο.");
      return;
    }
    const afm = form.payroll.afm?.replace(/\D/g, "") ?? "";
    if (afm && afm.length !== 9) {
      setError("Το ΑΦΜ έχει 9 ψηφία.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onSave({ ...form, payroll: { ...form.payroll, afm: afm || null } });
    } catch (e) {
      setError("Η αποθήκευση απέτυχε: " + String((e as Error)?.message ?? e));
      setBusy(false);
    }
  }

  async function createAccount() {
    const normalized = normalizePhone(loginPhone);
    if (!normalized) {
      setError("Δώσε έγκυρο κινητό (π.χ. 6971234567).");
      return;
    }
    if (!isValidPin(pin)) {
      setError("Το PIN πρέπει να είναι 6 ψηφία.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onCreateAccount!(loginPhone, pin);
      setAccountDone({ phone: loginPhone, pin });
      setAccountOpen(false);
    } catch (e) {
      setError(String((e as Error)?.message ?? e));
    } finally {
      setBusy(false);
    }
  }

  function suggestPin() {
    setPin(String(Math.floor(100000 + Math.random() * 900000)));
  }

  async function copyCredentials() {
    if (!accountDone) return;
    const text = `Vardia — πρόγραμμα βαρδιών\nΣύνδεση: ${location.origin}/login\nΚινητό: ${accountDone.phone}\nPIN: ${accountDone.pin}`;
    try {
      if (navigator.share) await navigator.share({ text });
      else await navigator.clipboard.writeText(text);
    } catch {
      // ακυρώθηκε
    }
  }

  return (
    <div className="fixed inset-0 z-40 flex items-end justify-center bg-black/40 sm:items-center">
      <div className="flex max-h-[92dvh] w-full max-w-lg flex-col rounded-t-2xl bg-white sm:rounded-2xl">
        <div className="flex items-start justify-between border-b border-zinc-200 p-4">
          <div>
            <h2 className="text-base font-bold text-zinc-900">
              {isNew ? "Νέος εργαζόμενος" : form.fullName || member?.fullName}
            </h2>
            <p className="text-xs text-zinc-500">
              {isNew ? "Συμπλήρωσε τα στοιχεία" : "Καρτέλα εργαζομένου"}
            </p>
          </div>
          <button onClick={onClose} className="px-2 text-sm font-bold text-zinc-400">
            ✕
          </button>
        </div>

        <form onSubmit={submit} className="flex-1 space-y-4 overflow-y-auto p-4">
          {error && (
            <p className="rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>
          )}

          <Section title="Βασικά">
            <div>
              <label className={LABEL}>Όνομα στο πρόγραμμα *</label>
              <input
                autoFocus={isNew}
                value={form.fullName}
                onChange={(e) => set("fullName", e.target.value)}
                placeholder="π.χ. Ρόκκας"
                className={INPUT}
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Ό,τι γράφεις κι εσύ στο χαρτί — αυτό φαίνεται στο grid.
              </p>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={LABEL}>Τμήμα</label>
                <select
                  value={form.departmentId ?? ""}
                  onChange={(e) => set("departmentId", e.target.value || null)}
                  className={INPUT}
                >
                  <option value="">—</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1">
                <label className={LABEL}>Πόστο</label>
                <input
                  value={form.position ?? ""}
                  onChange={(e) => set("position", e.target.value)}
                  placeholder="π.χ. Barista"
                  className={INPUT}
                />
              </div>
            </div>
          </Section>

          <Section title="Επικοινωνία">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={LABEL}>Κινητό</label>
                <input
                  type="tel"
                  inputMode="numeric"
                  value={form.phone ?? ""}
                  onChange={(e) => set("phone", e.target.value)}
                  placeholder="6971234567"
                  className={INPUT}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL}>Email</label>
                <input
                  type="email"
                  value={form.email ?? ""}
                  onChange={(e) => set("email", e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
          </Section>

          <Section title="Εργασία">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={LABEL}>Ημ. πρόσληψης</label>
                <input
                  type="date"
                  value={form.hireDate ?? ""}
                  onChange={(e) => set("hireDate", e.target.value || null)}
                  className={INPUT}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL}>Ημ. γέννησης</label>
                <input
                  type="date"
                  value={form.birthDate ?? ""}
                  onChange={(e) => set("birthDate", e.target.value || null)}
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>Σύμβαση</label>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(CONTRACT_LABELS) as ContractType[]).map((k) => (
                  <button
                    key={k}
                    type="button"
                    onClick={() => set("contractType", form.contractType === k ? null : k)}
                    className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                      form.contractType === k
                        ? "bg-indigo-600 text-white"
                        : "bg-zinc-100 text-zinc-600"
                    }`}
                  >
                    {CONTRACT_LABELS[k]}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className={LABEL}>Συμφωνημένες ώρες / εβδομάδα</label>
              <input
                type="number"
                min={0}
                max={60}
                step={0.5}
                value={form.weeklyHours ?? ""}
                onChange={(e) =>
                  set("weeklyHours", e.target.value === "" ? null : Number(e.target.value))
                }
                placeholder="40"
                className={INPUT}
              />
              <p className="mt-1 text-[11px] text-zinc-400">
                Βάση σύγκρισης: θα σε ειδοποιεί όταν το πρόγραμμα ξεπερνά τις ώρες του.
              </p>
            </div>
          </Section>

          <Section title="Αμοιβή">
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(Object.keys(PAY_LABELS) as PayType[]).map((k) => (
                <button
                  key={k}
                  type="button"
                  onClick={() => set("payType", form.payType === k ? null : k)}
                  className={`rounded-lg px-3 py-1.5 text-xs font-semibold ${
                    form.payType === k ? "bg-indigo-600 text-white" : "bg-zinc-100 text-zinc-600"
                  }`}
                >
                  {PAY_LABELS[k]}
                </button>
              ))}
            </div>
            {form.payType && (
              <div>
                <label className={LABEL}>
                  Ποσό ({form.payType === "hourly" ? "€ / ώρα" : form.payType === "daily" ? "€ / ημέρα" : "€ / μήνα"})
                </label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  value={form.payAmount ?? ""}
                  onChange={(e) =>
                    set("payAmount", e.target.value === "" ? null : Number(e.target.value))
                  }
                  className={INPUT}
                />
              </div>
            )}
            <p className="mt-1 text-[11px] text-zinc-400">
              Το βλέπεις μόνο εσύ και ο λογιστής. Ο εργαζόμενος δεν έχει πρόσβαση.
            </p>
          </Section>

          <Section title="Στοιχεία μισθοδοσίας">
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={LABEL}>Αρ. μητρώου</label>
                <input
                  value={form.payroll.payrollId ?? ""}
                  onChange={(e) => setPayroll("payrollId", e.target.value)}
                  placeholder="101"
                  inputMode="numeric"
                  className={INPUT}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL}>Α.Φ.Μ</label>
                <input
                  value={form.payroll.afm ?? ""}
                  onChange={(e) => setPayroll("afm", e.target.value)}
                  placeholder="123456789"
                  inputMode="numeric"
                  maxLength={12}
                  className={INPUT}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1">
                <label className={LABEL}>Επώνυμο</label>
                <input
                  value={form.payroll.lastName ?? ""}
                  onChange={(e) => setPayroll("lastName", e.target.value)}
                  placeholder={form.fullName}
                  className={INPUT}
                />
              </div>
              <div className="flex-1">
                <label className={LABEL}>Όνομα</label>
                <input
                  value={form.payroll.firstName ?? ""}
                  onChange={(e) => setPayroll("firstName", e.target.value)}
                  className={INPUT}
                />
              </div>
            </div>
            <div>
              <label className={LABEL}>ΑΜΚΑ</label>
              <input
                value={form.amka ?? ""}
                onChange={(e) => set("amka", e.target.value)}
                inputMode="numeric"
                maxLength={11}
                className={INPUT}
              />
            </div>
          </Section>

          <Section title="Σημειώσεις">
            <textarea
              rows={2}
              value={form.notes ?? ""}
              onChange={(e) => set("notes", e.target.value)}
              placeholder="π.χ. δεν μπορεί Κυριακές πρωί"
              className={INPUT}
            />
          </Section>

          {!isNew && (
            <Section title="Πρόσβαση στην εφαρμογή">
              {accountDone ? (
                <div className="rounded-lg bg-emerald-50 p-3">
                  <p className="text-sm font-bold text-emerald-800">Οι κωδικοί είναι έτοιμοι</p>
                  <p className="mt-1 font-mono text-sm text-emerald-900">
                    Κινητό: {accountDone.phone}
                    <br />
                    PIN: {accountDone.pin}
                  </p>
                  <button
                    type="button"
                    onClick={copyCredentials}
                    className="mt-2 rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white"
                  >
                    Αποστολή / αντιγραφή
                  </button>
                  <p className="mt-2 text-[11px] text-emerald-700">
                    Το PIN δεν θα ξαναφανεί. Στείλ&apos; το τώρα.
                  </p>
                </div>
              ) : accountOpen ? (
                <div className="space-y-2 rounded-lg bg-zinc-50 p-3">
                  <div>
                    <label className={LABEL}>Κινητό σύνδεσης</label>
                    <input
                      type="tel"
                      inputMode="numeric"
                      value={loginPhone}
                      onChange={(e) => setLoginPhone(e.target.value)}
                      placeholder="6971234567"
                      className={INPUT}
                    />
                  </div>
                  <div>
                    <label className={LABEL}>PIN (6 ψηφία)</label>
                    <div className="flex gap-2">
                      <input
                        inputMode="numeric"
                        maxLength={6}
                        value={pin}
                        onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                        className={INPUT}
                      />
                      <button
                        type="button"
                        onClick={suggestPin}
                        className="shrink-0 rounded-lg border border-zinc-300 px-3 text-xs font-semibold text-zinc-600"
                      >
                        Τυχαίο
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={createAccount}
                      disabled={busy}
                      className="flex-1 rounded-lg bg-indigo-600 py-2 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {member?.hasAccess ? "Αλλαγή PIN" : "Δημιουργία κωδικών"}
                    </button>
                    <button
                      type="button"
                      onClick={() => setAccountOpen(false)}
                      className="rounded-lg border border-zinc-300 px-3 text-sm font-semibold text-zinc-600"
                    >
                      Άκυρο
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center justify-between gap-2 rounded-lg bg-zinc-50 p-3">
                  <p className="text-sm text-zinc-600">
                    {member?.hasAccess ? (
                      <>
                        ✓ Έχει πρόσβαση
                        {member.loginPhone && (
                          <span className="block text-xs text-zinc-400">
                            Κινητό: {member.loginPhone}
                          </span>
                        )}
                      </>
                    ) : (
                      <>
                        Δεν έχει πρόσβαση
                        <span className="block text-xs text-zinc-400">
                          Φτιάξε κωδικούς και δώσ&apos; τους στον εργαζόμενο.
                        </span>
                      </>
                    )}
                  </p>
                  <button
                    type="button"
                    onClick={() => setAccountOpen(true)}
                    className="shrink-0 rounded-lg border border-indigo-300 px-3 py-1.5 text-xs font-semibold text-indigo-700"
                  >
                    {member?.hasAccess ? "Αλλαγή PIN" : "Δημιουργία κωδικών"}
                  </button>
                </div>
              )}
            </Section>
          )}
        </form>

        <div className="space-y-2 border-t border-zinc-200 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          <button
            onClick={submit}
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
          >
            {isNew ? "Προσθήκη" : "Αποθήκευση"}
          </button>
          {!isNew && (
            <div className="flex gap-2">
              <button
                onClick={async () => {
                  const archiving = member!.status === "active";
                  if (
                    !window.confirm(
                      archiving
                        ? `Αρχειοθέτηση του/της ${member!.fullName}; Θα φύγει από το πρόγραμμα αλλά το ιστορικό μένει για τον λογιστή.`
                        : `Επαναφορά του/της ${member!.fullName} στο ενεργό προσωπικό;`
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onArchive!(archiving);
                  } catch (e) {
                    setError(String((e as Error)?.message ?? e));
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="flex-1 rounded-xl border border-zinc-300 py-2 text-xs font-semibold text-zinc-600 disabled:opacity-50"
              >
                {member!.status === "active" ? "Αρχειοθέτηση" : "Επαναφορά"}
              </button>
              <button
                onClick={async () => {
                  if (
                    !window.confirm(
                      `Οριστική διαγραφή του/της ${member!.fullName}; Δεν αναιρείται.`
                    )
                  )
                    return;
                  setBusy(true);
                  try {
                    await onDelete!();
                  } catch (e) {
                    setError(String((e as Error)?.message ?? e));
                    setBusy(false);
                  }
                }}
                disabled={busy}
                className="flex-1 rounded-xl border border-red-200 py-2 text-xs font-semibold text-red-600 disabled:opacity-50"
              >
                Διαγραφή
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
        {title}
      </p>
      <div className="space-y-2">{children}</div>
    </div>
  );
}
