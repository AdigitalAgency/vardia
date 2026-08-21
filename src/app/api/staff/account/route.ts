import { createClient as createAdminClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isValidPin, normalizePhone, phoneToAuthEmail } from "@/lib/domain/phone";

/**
 * Δημιουργία (ή αλλαγή) κωδικών σύνδεσης εργαζομένου.
 * Ο owner ορίζει ο ίδιος κινητό + PIN και τα δίνει στον εργαζόμενο.
 *
 * Τρέχει server-side γιατί η δημιουργία auth user απαιτεί service-role key,
 * που ΔΕΝ πρέπει ποτέ να φτάσει στον browser. Η ταυτότητα του caller
 * επαληθεύεται με το δικό του session πριν χρησιμοποιηθεί το admin client.
 */
export async function POST(request: Request) {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) {
    return NextResponse.json(
      { error: "Η δημιουργία κωδικών δεν είναι ρυθμισμένη σε αυτό το περιβάλλον." },
      { status: 503 }
    );
  }

  let body: { tenantId?: string; employeeId?: string; phone?: string; pin?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Άκυρο αίτημα." }, { status: 400 });
  }

  const { tenantId, employeeId, phone, pin } = body;
  if (!tenantId || !employeeId || !phone || !pin) {
    return NextResponse.json({ error: "Λείπουν στοιχεία." }, { status: 400 });
  }

  const normalized = normalizePhone(phone);
  if (!normalized) {
    return NextResponse.json({ error: "Μη έγκυρο κινητό." }, { status: 400 });
  }
  if (!isValidPin(pin)) {
    return NextResponse.json({ error: "Το PIN πρέπει να είναι 6 ψηφία." }, { status: 400 });
  }

  // 1) Ποιος καλεί; Με το ΔΙΚΟ ΤΟΥ session, όχι με το admin key.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Δεν είσαι συνδεδεμένος." }, { status: 401 });
  }

  const { data: membership } = await supabase
    .from("memberships")
    .select("role")
    .eq("tenant_id", tenantId)
    .eq("user_id", user.id)
    .eq("status", "active")
    .maybeSingle();

  if (!membership || !["owner", "manager"].includes(membership.role)) {
    return NextResponse.json({ error: "Δεν έχεις δικαίωμα." }, { status: 403 });
  }

  // 2) Ανήκει ο εργαζόμενος στο ίδιο κατάστημα;
  const { data: employee } = await supabase
    .from("employees")
    .select("id, user_id")
    .eq("id", employeeId)
    .eq("tenant_id", tenantId)
    .maybeSingle();

  if (!employee) {
    return NextResponse.json({ error: "Δεν βρέθηκε ο εργαζόμενος." }, { status: 404 });
  }

  // 3) Τώρα (και μόνο τώρα) με δικαιώματα admin.
  const admin = createAdminClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const email = phoneToAuthEmail(normalized);

  if (employee.user_id) {
    // Υπάρχει λογαριασμός: αλλαγή PIN (και κινητού, αν άλλαξε).
    const { error } = await admin.auth.admin.updateUserById(employee.user_id, {
      email,
      password: pin,
      email_confirm: true,
    });
    if (error) {
      return NextResponse.json({ error: "Δεν άλλαξε το PIN: " + error.message }, { status: 400 });
    }
    await admin
      .from("employees")
      .update({ login_phone: normalized })
      .eq("id", employeeId);
    return NextResponse.json({ ok: true, mode: "updated" });
  }

  // Νέος λογαριασμός. Αν το κινητό χρησιμοποιείται ήδη, δεν το «κλέβουμε».
  const { data: created, error: createError } = await admin.auth.admin.createUser({
    email,
    password: pin,
    email_confirm: true,
  });

  if (createError || !created.user) {
    const alreadyExists = /already|registered|exists/i.test(createError?.message ?? "");
    return NextResponse.json(
      {
        error: alreadyExists
          ? "Αυτό το κινητό χρησιμοποιείται ήδη από άλλον λογαριασμό."
          : "Δεν δημιουργήθηκε ο λογαριασμός: " + (createError?.message ?? ""),
      },
      { status: 400 }
    );
  }

  const { error: linkError } = await admin.rpc("link_employee_account", {
    p_employee_id: employeeId,
    p_user_id: created.user.id,
    p_phone: normalized,
  });

  if (linkError) {
    // Μην αφήσεις ορφανό auth user πίσω.
    await admin.auth.admin.deleteUser(created.user.id);
    return NextResponse.json(
      { error: "Δεν συνδέθηκε ο λογαριασμός: " + linkError.message },
      { status: 400 }
    );
  }

  return NextResponse.json({ ok: true, mode: "created" });
}
