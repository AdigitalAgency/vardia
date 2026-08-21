"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidPin, normalizePhone, phoneToAuthEmail } from "@/lib/domain/phone";

type Mode = "password" | "magic" | "employee";

const INPUT =
  "w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-500 focus:border-indigo-500 focus:outline-none";

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") ?? "/app";
  const [mode, setMode] = useState<Mode>("password");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    setMsg(null);
    const supabase = createClient();
    try {
      if (mode === "employee") {
        const normalized = normalizePhone(phone);
        if (!normalized) throw new Error("Δώσε έγκυρο κινητό (π.χ. 6971234567).");
        if (!isValidPin(pin)) throw new Error("Το PIN είναι 6 ψηφία.");
        const { error } = await supabase.auth.signInWithPassword({
          email: phoneToAuthEmail(normalized),
          password: pin,
        });
        if (error) throw new Error("Λάθος κινητό ή PIN.");
        router.push(next);
        router.refresh();
      } else if (mode === "password") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw new Error("Η σύνδεση απέτυχε. Έλεγξε τα στοιχεία σου.");
        router.push(next);
        router.refresh();
      } else {
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: `${location.origin}/auth/callback?next=${next}` },
        });
        if (error) throw new Error("Δεν στάλθηκε το link. Δοκίμασε ξανά.");
        setMsg("Σου στείλαμε link σύνδεσης στο email.");
      }
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-2xl font-black tracking-tight text-indigo-700">Vardia</h1>
        <p className="mb-5 text-sm text-zinc-500">Το πρόγραμμα βαρδιών του μαγαζιού σου.</p>

        <form onSubmit={submit} className="space-y-3">
          {mode === "employee" ? (
            <>
              <input
                type="tel"
                inputMode="numeric"
                required
                placeholder="Κινητό (6971234567)"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className={INPUT}
              />
              <input
                type="password"
                inputMode="numeric"
                maxLength={6}
                required
                placeholder="PIN 6 ψηφίων"
                value={pin}
                onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                className={INPUT}
              />
            </>
          ) : (
            <>
              <input
                type="email"
                required
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={INPUT}
              />
              {mode === "password" && (
                <input
                  type="password"
                  required
                  placeholder="Κωδικός"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className={INPUT}
                />
              )}
            </>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-semibold text-white active:bg-indigo-700 disabled:opacity-50"
          >
            {mode === "magic" ? "Στείλε μου link σύνδεσης" : "Σύνδεση"}
          </button>
        </form>

        <div className="mt-3 flex flex-col gap-1.5 text-center text-xs font-medium">
          {mode === "employee" ? (
            <button onClick={() => setMode("password")} className="text-indigo-600">
              Είμαι υπεύθυνος / λογιστής
            </button>
          ) : (
            <>
              <button
                onClick={() => setMode(mode === "password" ? "magic" : "password")}
                className="text-indigo-600"
              >
                {mode === "password" ? "Σύνδεση με link στο email" : "Σύνδεση με κωδικό"}
              </button>
              <button onClick={() => setMode("employee")} className="text-zinc-500">
                Είμαι εργαζόμενος (κινητό & PIN)
              </button>
            </>
          )}
        </div>

        {msg && <p className="mt-3 rounded-lg bg-emerald-50 p-2 text-sm text-emerald-700">{msg}</p>}
        {err && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{err}</p>}
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
