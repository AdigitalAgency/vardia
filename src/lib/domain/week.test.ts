import { describe, expect, it } from "vitest";
import { addDaysISO, isMondayISO, mondayOf, monthLabel, shortDate, weekRangeLabel, weeksInMonth } from "./week";

describe("mondayOf", () => {
  it("βρίσκει τη Δευτέρα της εβδομάδας", () => {
    // 2026-08-21 = Παρασκευή → Δευτέρα 17/8
    expect(mondayOf(new Date(2026, 7, 21))).toBe("2026-08-17");
    // Κυριακή ανήκει στην εβδομάδα που ξεκίνησε τη Δευτέρα
    expect(mondayOf(new Date(2026, 7, 23))).toBe("2026-08-17");
    // Δευτέρα δίνει τον εαυτό της
    expect(mondayOf(new Date(2026, 7, 17))).toBe("2026-08-17");
  });
});

describe("addDaysISO / isMondayISO / shortDate", () => {
  it("μετακινεί ημερομηνίες σωστά και πάνω από όρια μήνα", () => {
    expect(addDaysISO("2026-08-17", 6)).toBe("2026-08-23");
    expect(addDaysISO("2026-08-31", 1)).toBe("2026-09-01");
    expect(addDaysISO("2026-08-17", -7)).toBe("2026-08-10");
  });
  it("αναγνωρίζει Δευτέρα", () => {
    expect(isMondayISO("2026-08-17")).toBe(true);
    expect(isMondayISO("2026-08-18")).toBe(false);
  });
  it("σύντομη μορφή", () => {
    expect(shortDate("2026-08-17")).toBe("17/8");
    expect(weekRangeLabel("2026-08-17")).toBe("17/8 – 23/8");
  });
});

describe("weeksInMonth", () => {
  it("επιστρέφει τις Δευτέρες που τέμνουν τον μήνα", () => {
    const w = weeksInMonth(2026, 8);
    expect(w[0]).toBe("2026-07-27"); // η εβδομάδα που περιέχει την 1/8
    expect(w.at(-1)).toBe("2026-08-31"); // η εβδομάδα που περιέχει την 31/8
    expect(w.every(isMondayISO)).toBe(true);
  });
  it("κάθε επόμενη είναι +7 ημέρες", () => {
    const w = weeksInMonth(2026, 2);
    for (let i = 1; i < w.length; i++) {
      expect(w[i]).toBe(addDaysISO(w[i - 1], 7));
    }
  });
  it("ελληνική ονομασία μήνα", () => {
    expect(monthLabel(2026, 8)).toBe("Αύγουστος 2026");
  });
});
