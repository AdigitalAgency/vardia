/**
 * Προ-συμπληρωμένα για εστίαση — ο wizard ξεκινά από κάτι που μοιάζει με το
 * χαρτί του πελάτη, όχι από κενή σελίδα. Αυτά είναι τα defaults κάθε νέου tenant.
 */

export const DEFAULT_DEPARTMENTS = [
  { name: "ΚΟΥΖΙΝΑ", suggested: true },
  { name: "SERVICE", suggested: true },
  { name: "BAR", suggested: true },
  { name: "ΒΟΗΘΟΙ / ΛΑΤΖΑ", suggested: true },
  { name: "ΥΠΟΔΟΧΗ", suggested: false },
  { name: "DELIVERY", suggested: false },
];

export interface PresetDraft {
  label: string;
  kind: "work" | "repo" | "adeia";
  start: number | null;
  end: number | null;
}

/** Τα πιο συνηθισμένα ωράρια εστίασης (λεπτά από μεσάνυχτα). */
export const DEFAULT_PRESETS: Array<PresetDraft & { suggested: boolean }> = [
  { label: "17–01", kind: "work", start: 1020, end: 60, suggested: true },
  { label: "18–02", kind: "work", start: 1080, end: 120, suggested: true },
  { label: "19–03", kind: "work", start: 1140, end: 180, suggested: false },
  { label: "21–01", kind: "work", start: 1260, end: 60, suggested: false },
  { label: "09–17", kind: "work", start: 540, end: 1020, suggested: true },
  { label: "10–18", kind: "work", start: 600, end: 1080, suggested: true },
  { label: "12–20", kind: "work", start: 720, end: 1200, suggested: false },
  { label: "08–16", kind: "work", start: 480, end: 960, suggested: false },
];

/** Πάντα διαθέσιμα, δεν επιλέγονται — κάθε πρόγραμμα τα χρειάζεται. */
export const MANDATORY_PRESETS: PresetDraft[] = [
  { label: "ΡΕΠΟ", kind: "repo", start: null, end: null },
  { label: "ΑΔΕΙΑ", kind: "adeia", start: null, end: null },
];
