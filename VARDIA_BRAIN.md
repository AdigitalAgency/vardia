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
- ⚠ ΑΝΟΙΧΤΟ: κωδικοποίηση βάρδιας που περνά μεσάνυχτα στο export (π.χ. 17:00–01:00 → `17000100`;) — εκκρεμεί επιβεβαίωση από λογιστή. Μέχρι τότε: encoding με ώρα ρολογιού λήξης.

## v1 Scope (δεσμευτικό — τίποτα άλλο)

Grid + preset pad + auto-advance · copy week · draft→publish + diff ειδοποιήσεις · employee λίστα · leave requests · accountant export + ιστορικό · onboarding wizard 5 βημάτων · PWA + Web Push best-effort · invites SMS/Viber · guardrail 11ωρης ανάπαυσης (warning στο publish) · audit_log + shift_revisions.
ΕΚΤΟΣ v1: swaps, availability counters, labor %, offline edit queue, SMS σε publish, accountant multi-tenant dashboard, dark mode.

## Status / Επόμενα

- 2026-08-21: Kickoff — scaffold, schema, domain core + tests. ⏳ Εκκρεμούν (Φώτης): Supabase project (EU), GitHub repo `AdigitalAgency/vardia` + push, Vercel project, call με λογιστή για midnight encoding.
