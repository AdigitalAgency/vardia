"use client";

import { use, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isValidPin, normalizePhone, phoneToAuthEmail } from "@/lib/domain/phone";

interface Preview {
  valid: boolean;
  employee_name?: string;
  tenant_name?: string;
}

export default function InvitePage({ params }: PageProps<"/invite/[token]">) {
  const { token } = use(params);
  const router = useRouter();
  const supabase = createClient();

  const [preview, setPreview] = useState<Preview | null>(null);
  const [phone, setPhone] = useState("");
  const [pin, setPin] = useState("");
  const [pin2, setPin2] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .rpc("invite_preview", { p_token: token })
      .then(({ data, error }) =>
        setPreview(error ? { valid: false } : (data as Preview) ?? { valid: false })
      );
    // supabase client is stable per render of this page
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const normalized = normalizePhone(phone);
    if (!normalized) {
      setError("Δώσε έγκυρο κινητό (π.χ. 6971234567).");
      return;
    }
    if (!isValidPin(pin)) {
      setError("Το PIN πρέπει να είναι 6 ψηφία.");
      return;
    }
    if (pin !== pin2) {
      setError("Τα δύο PIN δεν ταιριάζουν.");
      return;
    }

    setBusy(true);
    try {
      const email = phoneToAuthEmail(normalized);
      // Νέος λογαριασμός· αν το κινητό χρησιμοποιείται ήδη, μπαίνουμε με το PIN του.
      const signUp = await supabase.auth.signUp({ email, password: pin });
      if (signUp.error) {
        const signIn = await supabase.auth.signInWithPassword({ email, password: pin });
        if (signIn.error) {
          throw new Error(
            "Το κινητό χρησιμοποιείται ήδη με διαφορετικό PIN. Ζήτησε βοήθεια από τον υπεύθυνό σου."
          );
        }
      }
      if (!signUp.data.session && !(await supabase.auth.getSession()).data.session) {
        throw new Error(
          "Ο λογαριασμός δημιουργήθηκε αλλά δεν έγινε σύνδεση. Ενημέρωσε τον υπεύθυνό σου."
        );
      }

      const { error: rpcError } = await supabase.rpc("accept_employee_invite", {
        p_token: token,
      });
      if (rpcError) {
        throw new Error(
          rpcError.message.includes("INVALID_INVITE")
            ? "Ο σύνδεσμος δεν ισχύει πια. Ζήτησε καινούριο."
            : "Κάτι πήγε στραβά στη σύνδεση με το κατάστημα."
        );
      }

      router.push("/app");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  if (preview && !preview.valid) {
    return (
      <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
        <div className="w-full max-w-sm rounded-2xl bg-white p-6 text-center shadow-sm">
          <p className="text-3xl">🔗</p>
          <h1 className="mt-2 text-lg font-bold text-zinc-900">Ο σύνδεσμος δεν ισχύει</h1>
          <p className="mt-1 text-sm text-zinc-500">
            Μπορεί να έχει ήδη χρησιμοποιηθεί ή να έληξε. Ζήτησε καινούριο από τον υπεύθυνό
            σου.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="flex min-h-dvh items-center justify-center bg-zinc-50 p-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-black tracking-tight text-indigo-700">Vardia</h1>
        {preview ? (
          <p className="mb-5 mt-1 text-sm text-zinc-600">
            Γεια σου <span className="font-bold">{preview.employee_name}</span>! Φτιάξε τους
            κωδικούς σου για να βλέπεις το ωράριό σου στο{" "}
            <span className="font-semibold">{preview.tenant_name}</span>.
          </p>
        ) : (
          <p className="mb-5 mt-1 text-sm text-zinc-400">Έλεγχος συνδέσμου…</p>
        )}

        <form onSubmit={submit} className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">Κινητό</label>
            <input
              type="tel"
              inputMode="numeric"
              required
              placeholder="6971234567"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              PIN (6 ψηφία)
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="······"
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm tracking-[0.4em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-zinc-500">
              Επανάλαβε το PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              maxLength={6}
              required
              placeholder="······"
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ""))}
              className="w-full rounded-xl border border-zinc-300 px-3 py-2.5 text-sm tracking-[0.4em] text-zinc-900 placeholder:tracking-normal placeholder:text-zinc-400 focus:border-indigo-500 focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={busy || !preview?.valid}
            className="w-full rounded-xl bg-indigo-600 py-2.5 text-sm font-bold text-white active:bg-indigo-700 disabled:opacity-50"
          >
            {busy ? "Γίνεται σύνδεση…" : "Ξεκίνα"}
          </button>
        </form>

        {error && <p className="mt-3 rounded-lg bg-red-50 p-2 text-sm text-red-700">{error}</p>}

        <p className="mt-4 text-center text-[11px] text-zinc-400">
          Θυμήσου το PIN σου. Θα το χρειάζεσαι κάθε φορά που μπαίνεις.
        </p>
      </div>
    </main>
  );
}
