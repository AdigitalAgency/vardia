/**
 * Προτεινόμενα ωράρια ΑΝΑ ΕΡΓΑΖΟΜΕΝΟ.
 * Το μαγαζί έχει τα δικά του presets, αλλά ο κάθε άνθρωπος έχει το δικό του μοτίβο:
 * ο Ρόκκας δουλεύει 05–02, η κουζίνα 09–17. Μαθαίνουμε από το ιστορικό του καθενός —
 * και τα custom ωράρια μετράνε το ίδιο με τα presets του μαγαζιού.
 */

import type { ShiftPreset, ShiftUsage } from "@/lib/types";
import { formatInterval } from "./time";

export interface Suggestion {
  /** id του preset αν το ωράριο αντιστοιχεί σε preset του μαγαζιού, αλλιώς null */
  presetId: string | null;
  label: string;
  start: number;
  end: number;
  count: number;
}

function matchPreset(
  presets: ShiftPreset[],
  start: number,
  end: number
): ShiftPreset | undefined {
  return presets.find((p) => p.kind === "work" && p.start === start && p.end === end);
}

/** Σύντομη ετικέτα custom ωραρίου: 17:00–01:00 → «17–01», 19:30–00:30 → «19:30–00:30». */
export function shortLabel(start: number, end: number): string {
  const full = formatInterval({ start, end });
  return full.replace(/:00\b/g, "");
}

/**
 * Τα ωράρια που χρησιμοποιεί συχνότερα ο συγκεκριμένος εργαζόμενος.
 * Επιστρέφει μόνο όσα έχουν χρησιμοποιηθεί ≥ minCount φορές, ώστε μια τυχαία
 * εξαίρεση να μην ανεβαίνει στην κορυφή.
 */
export function personalSuggestions(
  usage: ShiftUsage[] | undefined,
  presets: ShiftPreset[],
  limit = 3,
  minCount = 2
): Suggestion[] {
  if (!usage?.length) return [];
  return [...usage]
    .filter((u) => u.count >= minCount)
    .sort((a, b) => b.count - a.count || a.start - b.start)
    .slice(0, limit)
    .map((u) => {
      const preset = matchPreset(presets, u.start, u.end);
      return {
        presetId: preset?.id ?? null,
        label: preset?.label ?? shortLabel(u.start, u.end),
        start: u.start,
        end: u.end,
        count: u.count,
      };
    });
}

/**
 * Τα presets του μαγαζιού ταξινομημένα με τη συχνότητα του εργαζόμενου,
 * χωρίς όσα εμφανίζονται ήδη στις προσωπικές προτάσεις.
 */
export function orderedPresets(
  presets: ShiftPreset[],
  usage: ShiftUsage[] | undefined,
  exclude: Suggestion[] = []
): ShiftPreset[] {
  const excluded = new Set(exclude.map((s) => s.presetId).filter(Boolean));
  const countOf = (p: ShiftPreset) =>
    usage?.find((u) => u.start === p.start && u.end === p.end)?.count ?? 0;

  return presets
    .filter((p) => !excluded.has(p.id))
    .sort((a, b) => {
      if (a.kind !== "work" || b.kind !== "work") return a.sortOrder - b.sortOrder;
      return countOf(b) - countOf(a) || a.sortOrder - b.sortOrder;
    });
}
