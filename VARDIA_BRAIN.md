# VARDIA — Repo Brain

> **Πρωτόκολλο (δεσμευτικό):** Κάθε AI session που αγγίζει αυτό το repo διαβάζει ΠΡΩΤΑ:
> 1. `C:\AIdigital_Workspace\projects\littlemosque\LITTLEMOSQUE_BRAIN.md` — αποφάσεις, roadmap, export spec λογιστή (§5α)
> 2. `C:\AIdigital_Workspace\docs\THE_BRAIN.md` — στρατηγική ομίλου
> 3. `C:\AIdigital_Workspace\projects\littlemosque\research\03-pm-decision.md` — πλήρης αρχιτεκτονική
> Update-always: κάθε ουσιαστική αλλαγή ενημερώνει το LITTLEMOSQUE_BRAIN.md changelog στο ίδιο session.

## Τι είναι

Multi-tenant SaaS shift scheduling για ελληνική εστίαση. 3 ρόλοι: Owner (φτιάχνει το εβδομαδιαίο πρόγραμμα), Employee (βλέπει ΜΟΝΟ το δικό του, αιτείται άδεια), Λογιστής (export weekly matrix για μισθοδοσία). Pilot tenant: The Little Mosque.

## Κόκκινες γραμμές (αποφάσεις Φώτη — ΜΗΝ τις ξανανοίξεις)

- ΟΧΙ ψηφιακή κάρτα εργασίας. ΟΧΙ απευθείας Εργάνη API. ΟΧΙ PDA/POS/QR ordering/κρατήσεις ως build.
- Στρατηγική: **συνεργάτες** των Epsilon/SoftOne/POS vendors — το Vardia είναι το labor layer πάνω από τα συστήματά τους. Η υποβολή Εργάνη γίνεται πάντα από το εργαλείο του λογιστή, εμείς παράγουμε το αρχείο.

## Αρχιτεκτονική (σύνοψη — πλήρης στο 03-pm-decision.md)

- Next.js App Router + PWA, TypeScript, Tailwind. Hosting: Vercel (νέο project).
- Supabase: **ΝΕΟ δικό του project, EU region** (όχι το core του ομίλου). ⏳ Δημιουργία από Φώτη.
- Multi-tenancy: single DB, shared schema, `tenant_id` παντού + Postgres RLS. Ρόλοι σε `memberships` (owner|manager|accountant|employee). Feature gating: `tenant_products`.
- Auth: Owner/Accountant email+password ή magic link· Employee invite link (SMS/Viber) → PIN, identifier το κινητό.
- Schema: `supabase/migrations/0001_init.sql`.

## Ο πυρήνας εμπιστοσύνης (src/lib/domain/)

Pure functions + unit tests (vitest). ΚΑΘΕ αλλαγή εδώ περνά από tests πριν από commit.
- `time.ts`: παρσάρισμα ωραρίων, διάρκεια, βάρδιες που περνούν μεσάνυχτα, νυχτερινές ώρες (22:00–06:00), split ανά ημερολογιακή ημέρα.
- `export.ts`: weekly matrix λογιστή — 1 γραμμή/εργαζόμενο, στήλες ΑΜ|ΑΦΜ|ΕΠΩΝΥΜΟ|ΟΝΟΜΑ|ΔΕΥ…ΚΥΡ, κελιά `HHMMHHMM` / `ΑΝ` / label άδειας. Spec: LITTLEMOSQUE_BRAIN §5α.
- ✅ Midnight-crossing (επιβεβαιωμένο 2026-08-21): στο UI εμφανίζεται 17:00–01:00, στο export `17000100` **στην ημέρα έναρξης**.

## 🚀 LIVE

**Production: https://vardia-lac.vercel.app** (Vercel project `kious-projects-69a8135d/vardia`, deploy 2026-08-21)
· `/demo` = παρουσίαση χωρίς login (4 ρόλοι στη μπάρα) · `/app` = πραγματικό (login)
· Env σε production/preview/development: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
· PWA ενεργό (service worker registered, installable)

## ⚠ Εκκρεμότητες Φώτη (πριν τον πιλότο)

0. ~~migration 0007 + SUPABASE_SERVICE_ROLE_KEY στο Vercel~~ ✅ ΕΓΙΝΕ 2026-08-21 (επαληθεύτηκε live: το `/api/staff/account` επιστρέφει 400/401 αντί για 503, και απορρίπτει μη συνδεδεμένα αιτήματα). ⚠ Το key ΔΕΝ είναι στο τοπικό `.env.local` — η δημιουργία κωδικών δουλεύει μόνο στο production. ⚠ Μετά από κάθε αλλαγή env var στο Vercel χρειάζεται **redeploy** για να την δει το API route.
1. **Supabase → Authentication → Providers → Email: «Confirm email» OFF** — ΧΩΡΙΣ ΑΥΤΟ δεν ολοκληρώνονται οι προσκλήσεις εργαζομένων (ψευδο-email `<κινητό>@employee.vardia.app`, δεν υπάρχει inbox). **Το #1 blocker.**
2. **Supabase → Authentication → URL Configuration**: Site URL = `https://vardia-lac.vercel.app`, Redirect URLs += `https://vardia-lac.vercel.app/**`. Χωρίς αυτό τα magic links («σύνδεση με link στο email») οδηγούν στο localhost.
3. **Custom domain** (προαιρετικό αλλά συνιστάται πριν σταλεί σε πελάτη): π.χ. `vardia.gr` ή `vardia.aidigitalagency.gr` — το `vardia-lac.vercel.app` δεν εμπνέει σε SMS πρόσκληση.
4. **Web Push αποστολή** (προαιρετικό): το UI/SW/subscriptions είναι έτοιμα· λείπει το server-side send (VAPID keys + API route με service-role). Το in-app banner καλύπτει το v1 — το push είναι enhancement (PM §1.2-U2).

## Owner UX — αποφάσεις που δεν ξανανοίγουν

- **Προτεινόμενα ωράρια ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ** (αίτημα Φώτη 2026-08-21): το `usage` μετράει **ωράρια (start/end)**, όχι preset ids — έτσι μαθαίνει και τα custom (π.χ. «05–02» του Ρόκκα) ισότιμα με τα presets του μαγαζιού. Το pad δείχνει «Συχνά του/της <όνομα>» (top-3, ≥2 χρήσεις ώστε μια τυχαία εξαίρεση να μην ανεβαίνει), μετά τα υπόλοιπα ωράρια ταξινομημένα κατά συχνότητα. ΡΕΠΟ/άδειες μένουν σε σταθερή θέση (μυϊκή μνήμη). Λογική: `src/lib/domain/suggestions.ts`.
- **Αντιγραφή σε όλη την εβδομάδα** — ΟΧΙ drag & drop (απορρίφθηκε για mobile, UI spec §5.1). **Δύο τρόποι, και οι δύο ενεργοί** (τελική απόφαση Φώτη 2026-08-21, μετά από μια σύντομη αφαίρεση του toggle που αναιρέθηκε): (α) **toggle «Όλη η εβδομάδα»** στο pad — η επόμενη επιλογή γεμίζει 7/7 και το toggle σβήνει (one-shot)· (β) **long-press 450ms** (ή δεξί κλικ) σε γεμάτο κελί → confirm → αντιγραφή σε όλη τη γραμμή.
- **Οι εγκεκριμένες άδειες ΔΕΝ πατιούνται ποτέ** από μαζική συμπλήρωση — είναι απόφαση, όχι πρόχειρο. Ο owner ενημερώνεται πόσες παραλείφθηκαν.

## Μητρώο προσωπικού (Owner) — αρχιτεκτονική

**ΟΧΙ invite links για εργαζόμενους** (απόφαση Φώτη 2026-08-21, αντικατέστησε το invite flow): ο owner **δημιουργεί ο ίδιος τους κωδικούς** (κινητό + PIN, με γεννήτρια τυχαίου PIN) και τους δίνει στον εργαζόμενο. Το invite link παραμένει **μόνο** για λογιστή/υπεύθυνο.
- Η δημιουργία auth user απαιτεί service-role → γίνεται server-side στο **`/api/staff/account`**. Το route επαληθεύει τον caller με το ΔΙΚΟ ΤΟΥ session (owner/manager του tenant) ΠΡΙΝ αγγίξει το admin client· σε αποτυχία σύνδεσης διαγράφει τον ορφανό user. Το PIN δεν αποθηκεύεται ποτέ σε δικό μας πίνακα — εμφανίζεται μία φορά για αποστολή.
- **Πεδία καρτέλας** (migration 0007): τηλέφωνο, email, ημ. πρόσληψης, τύπος σύμβασης (πλήρης/μερική/εκ περιτροπής), **συμφωνημένες ώρες/εβδομάδα**, **αμοιβή (ωρομίσθιο/ημερομίσθιο/μηνιαίος + ποσό)**, σημειώσεις + ΑΜ/επώνυμο/όνομα.
- **Data minimization (GDPR, απόφαση Φώτη 2026-08-21)** — δεν είμαστε σύστημα μισθοδοσίας: **ΔΕΝ αποθηκεύουμε ΑΜΚΑ, ημερομηνία γέννησης, πόστο/ειδικότητα** (το τμήμα αρκεί, ένα drop-down). Μην τα ξαναπροτείνεις.
- **ΑΦΜ — περιορισμός ανά ρόλο, όχι διαγραφή**: παραμένει στη βάση γιατί είναι στήλη του export του λογιστή (§5α)· ορατό/επεξεργάσιμο **μόνο στην οθόνη του λογιστή** (`showAfm`), αόρατο στην καρτέλα του owner. Τα warnings διαφέρουν αντίστοιχα ανά ρόλο.
- ⚠ Η **αμοιβή** ανατρέπει το PM decision §1.1-R5 («όχι ωρομίσθια πριν το v3») — ρητό αίτημα Φώτη. Ορατή μόνο σε owner/manager/accountant (RLS `employees_admin_all`), ποτέ στον εργαζόμενο.
- **Αρχειοθέτηση αντί διαγραφής**: τα shifts έχουν ON DELETE CASCADE, οπότε hard delete θα έσβηνε το ιστορικό της μισθοδοσίας. Η οριστική διαγραφή επιτρέπεται μόνο όταν ο εργαζόμενος δεν έχει καμία βάρδια (GDPR erasure για λάθος καταχώρηση).
- Οι **συμφωνημένες ώρες** είναι η βάση για το επόμενο βήμα: ειδοποίηση υπέρβασης όταν το πρόγραμμα ξεπερνά το συμβατικό ωράριο.

## v1 Scope (δεσμευτικό — τίποτα άλλο)

Grid + preset pad + auto-advance · copy week · draft→publish + diff ειδοποιήσεις · employee λίστα · leave requests · accountant export + ιστορικό · onboarding wizard 5 βημάτων · PWA + Web Push best-effort · invites SMS/Viber · guardrail 11ωρης ανάπαυσης (warning στο publish) · audit_log + shift_revisions.
ΕΚΤΟΣ v1: swaps, availability counters, labor %, offline edit queue, SMS σε publish, accountant multi-tenant dashboard, dark mode.

## Status / Επόμενα

- 2026-08-21: Kickoff — scaffold, schema, domain core + tests (29/29).
- 2026-08-21 (β): Supabase project ΕΤΟΙΜΟ (`qgugygrtdwcvsmbfytli`, EU, `.env.local` gitignored)· **migration 0001 ΕΤΡΕΞΕ** (Φώτης, SQL Editor)· midnight encoding επιβεβαιωμένο.
- 2026-08-21 (γ): **Owner UX core ΥΛΟΠΟΙΗΘΗΚΕ + verified στο browser**: auth (login password/magic link, `src/proxy.ts` guard — Next 16 rename του middleware!), ScheduleRepo interface + SupabaseRepo + DemoRepo, WeekGrid + PresetPad με auto-advance, draft→publish + guardrail 11ωρης + published_dirty, copy-forward (μόνο work/ρεπό), seed SQL pilot (`supabase/seed/0002_pilot_seed.sql`). **Pushed: github.com/AdigitalAgency/vardia (main)**. Dev: launch config `vardia` :4930, δοκιμή χωρίς login στο `/demo`.
  ~~⏳ (α) owner user + seed~~ ✅ ΕΓΙΝΕ (Φώτης 2026-08-21) — tenant live στη βάση.
- 2026-08-21 (δ): **Owner dashboard ΠΛΗΡΕΣ + verified**: LeaveRequestsView (έγκριση/απόρριψη + auto-fill ΑΔΕΙΑ/ΡΕΠΟ στο grid, δημιουργεί draft weeks όπου χρειάζεται), OwnerShell bottom tabs (Πρόγραμμα/Αιτήματα + badge εκκρεμών), **δυναμική σειρά presets ανά εργαζόμενο** (συχνότητα χρήσης all-time + optimistic bump), login placeholder contrast fix. Pushed στο main.
- 2026-08-21 (ε): **Employee shell + invite flow ΥΛΟΠΟΙΗΘΗΚΑΝ + verified**: migration 0003 (employee_invites + `accept_employee_invite`/`invite_preview` SECURITY DEFINER — σύνδεση user↔employee χωρίς service-role key), EmployeeShell (ωράριο-λίστα με σύνολο ωρών/σήμερα/«δεν βγήκε ακόμα» + υποβολή αδειών), StaffView για owner (invite links με share/clipboard), RoleRouter, login mode «εργαζόμενος» (κινητό+PIN), `/demo/employee` + DemoSwitcher.
  ~~(α) migration 0003~~ ✅ ΕΓΙΝΕ (Φώτης).
- 2026-08-21 (στ): **Οθόνη λογιστή ΥΛΟΠΟΙΗΘΗΚΕ + verified**: migration 0004 (first_name/last_name), `summary.ts` (ώρες/νυχτερινά/Κυριακές με επιμερισμό ανά ημερολογιακή ημέρα — tested), ExportView (μήνας/εβδομάδα, πίνακας σύνοψης + σύνολα, warnings ελλιπών ΑΦΜ & μη δημοσιευμένων εβδομάδων, προεπισκόπηση, κατέβασμα CSV με BOM), `buildPeriodMatrix` (1 εβδομάδα = ακριβώς το δείγμα πελάτη· πολλές = block ανά εβδομάδα· μόνο όσοι έχουν πρόγραμμα), PayrollSheet, AccountantShell + `/demo/accountant`, tab «Εξαγωγή» και στον owner. 55 tests.
  ~~(α) migration 0004~~ ✅ ΕΓΙΝΕ (Φώτης).
- 2026-08-21 (ζ): **Onboarding wizard ΥΛΟΠΟΙΗΘΗΚΕ + verified** — ο wizard ΕΙΝΑΙ το provisioning (§2.4): migration 0005 `provision_tenant` RPC (tenant+owner membership+τμήματα+προσωπικό+presets σε μία συναλλαγή, μοναδικό slug, όριο 10/user, audit entry), SetupWizard 5 βημάτων με defaults εστίασης και μαζική εισαγωγή ονομάτων, `slug.ts` με ελληνικό transliteration, `/app/setup` (2ο κατάστημα) + `/demo/setup`. Χωρίς tenant → ο wizard είναι η πρώτη οθόνη. 59 tests.
  ~~(α) migration 0005~~ ✅ ΕΓΙΝΕ (Φώτης).
- 2026-08-21 (η): **🎉 v1 SCOPE COMPLETE.** migration 0006: trigger `log_shift_revision` (καταγράφει αλλαγές σε δημοσιευμένες εβδομάδες — θεμέλιο του diff), `publish_week` RPC (δημοσίευση + ειδοποιήσεις ΜΟΝΟ στους επηρεαζόμενους), `employee_invites.role` (πρόσκληση λογιστή/υπεύθυνου χωρίς καρτέλα). PWA: manifest, service worker (cache + push handlers), icons, registration μόνο σε production. Owner: feedback «ειδοποιήθηκαν Χ» + «Πρόσκληση λογιστή». Employee: in-app NotificationBanner. Invite page: 2 μορφές (κινητό+PIN / email+κωδικός). **Verified: 1η δημοσίευση 5 άτομα → αλλαγή ενός → «μόνο 1 άτομο που επηρεάστηκε».**
  ~~migration 0006~~ ✅ ΕΓΙΝΕ (Φώτης).
- 2026-08-21 (ι): **Owner UX v1.1** (αίτημα Φώτη): προσωπικές προτάσεις ωραρίων ανά εργαζόμενο (μαθαίνει και τα custom) + αντιγραφή σε όλη την εβδομάδα (toggle στο pad + long-press στο κελί) + προστασία αδειών. 67 tests. Deployed. Βλ. «Owner UX — αποφάσεις».
- 2026-08-21 (θ): **🚀 DEPLOYED** στο https://vardia-lac.vercel.app. Vercel project + env vars (3 περιβάλλοντα) + `turbopack.root` fix. Verified live: grid 19 γραμμές, 4 tabs owner, service worker registered, manifest standalone, RPC `invite_preview` απαντά από production (άρα env + migrations OK), `/app` → redirect σε login. Εκκρεμότητες: βλ. ενότητα «Εκκρεμότητες Φώτη».
