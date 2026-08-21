import { describe, expect, it } from "vitest";
import type { ShiftPreset } from "@/lib/types";
import { orderedPresets, personalSuggestions, shortLabel } from "./suggestions";

const presets: ShiftPreset[] = [
  { id: "p1", label: "17–01", kind: "work", start: 1020, end: 60, sortOrder: 0 },
  { id: "p2", label: "18–02", kind: "work", start: 1080, end: 120, sortOrder: 1 },
  { id: "p3", label: "09–17", kind: "work", start: 540, end: 1020, sortOrder: 2 },
  { id: "p8", label: "ΡΕΠΟ", kind: "repo", start: null, end: null, sortOrder: 3 },
];

describe("shortLabel", () => {
  it("κόβει τα :00 αλλά κρατά τα μισάωρα", () => {
    expect(shortLabel(1020, 60)).toBe("17–01");
    expect(shortLabel(1170, 30)).toBe("19:30–00:30");
    expect(shortLabel(300, 120)).toBe("05–02");
  });
});

describe("personalSuggestions", () => {
  it("φέρνει μπροστά το συχνότερο ωράριο του εργαζόμενου", () => {
    const s = personalSuggestions(
      [
        { start: 1020, end: 60, count: 2 },
        { start: 300, end: 120, count: 9 }, // custom 05–02
      ],
      presets
    );
    expect(s[0].label).toBe("05–02");
    expect(s[0].presetId).toBeNull(); // custom, δεν είναι preset του μαγαζιού
    expect(s[1].label).toBe("17–01");
    expect(s[1].presetId).toBe("p1"); // ταιριάζει σε preset
  });

  it("αγνοεί ωράρια που χρησιμοποιήθηκαν μία φορά (τυχαία εξαίρεση)", () => {
    const s = personalSuggestions([{ start: 300, end: 120, count: 1 }], presets);
    expect(s).toEqual([]);
  });

  it("επιστρέφει το πολύ `limit` προτάσεις", () => {
    const usage = [
      { start: 300, end: 120, count: 9 },
      { start: 1020, end: 60, count: 8 },
      { start: 1080, end: 120, count: 7 },
      { start: 540, end: 1020, count: 6 },
    ];
    expect(personalSuggestions(usage, presets, 3)).toHaveLength(3);
  });

  it("κενό ιστορικό δεν σκάει", () => {
    expect(personalSuggestions(undefined, presets)).toEqual([]);
    expect(personalSuggestions([], presets)).toEqual([]);
  });
});

describe("orderedPresets", () => {
  it("ταξινομεί με τη συχνότητα του εργαζόμενου", () => {
    const out = orderedPresets(presets, [{ start: 540, end: 1020, count: 5 }]);
    expect(out[0].id).toBe("p3"); // 09–17 πρώτο επειδή το χρησιμοποιεί
  });

  it("αφαιρεί όσα ήδη δείχνονται ως προσωπικές προτάσεις", () => {
    const suggestions = personalSuggestions([{ start: 1020, end: 60, count: 4 }], presets);
    const out = orderedPresets(presets, undefined, suggestions);
    expect(out.some((p) => p.id === "p1")).toBe(false);
  });

  it("τα μη-work presets κρατούν σταθερή θέση (μυϊκή μνήμη)", () => {
    const out = orderedPresets(presets, [{ start: 540, end: 1020, count: 99 }]);
    expect(out.at(-1)?.kind).toBe("repo");
  });
});
