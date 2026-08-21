import { describe, expect, it } from "vitest";
import type { CellValue } from "@/lib/types";
import { addSummaries, decimalHours, formatMinutes, summarizeWeek } from "./summary";

const work = (start: number, end: number): CellValue => ({ kind: "work", start, end });
const repo: CellValue = { kind: "repo" };
const adeia: CellValue = { kind: "adeia", leaveType: "kanoniki" };
const empty: CellValue = { kind: "empty" };

function week(...cells: CellValue[]): CellValue[] {
  const out = [...cells];
  while (out.length < 7) out.push({ ...empty });
  return out;
}

describe("summarizeWeek", () => {
  it("μετράει ώρες, ημέρες εργασίας, ρεπό και άδειες", () => {
    const s = summarizeWeek(week(work(900, 1300), repo, adeia, work(900, 1300)));
    expect(s.workDays).toBe(2);
    expect(s.restDays).toBe(1);
    expect(s.leaveDays).toBe(1);
    expect(s.totalMinutes).toBe(800); // 2 × 6ω40
  });

  it("βάρδιες που περνούν μεσάνυχτα μετρώνται ολόκληρες", () => {
    const s = summarizeWeek(week(work(1020, 60))); // 17:00–01:00
    expect(s.totalMinutes).toBe(480);
    expect(s.nightMinutes).toBe(180); // 22:00–01:00
  });

  it("η Κυριακή του Σαββάτου: 17:00–01:00 δίνει 60 λεπτά Κυριακής", () => {
    // index 5 = Σάββατο
    const s = summarizeWeek(week(empty, empty, empty, empty, empty, work(1020, 60)));
    expect(s.sundayMinutes).toBe(60);
  });

  it("βάρδια Κυριακής μετράει ολόκληρη μέχρι τα μεσάνυχτα, όχι μετά", () => {
    // index 6 = Κυριακή, 17:00–01:00 → 7 ώρες Κυριακή + 1 ώρα Δευτέρα
    const s = summarizeWeek(week(empty, empty, empty, empty, empty, empty, work(1020, 60)));
    expect(s.sundayMinutes).toBe(420);
    expect(s.totalMinutes).toBe(480);
  });

  it("ημερήσια βάρδια Κυριακής μετράει ολόκληρη", () => {
    const s = summarizeWeek(week(empty, empty, empty, empty, empty, empty, work(540, 1020)));
    expect(s.sundayMinutes).toBe(480);
  });

  it("κενή εβδομάδα δίνει μηδενικά", () => {
    const s = summarizeWeek(week());
    expect(s).toEqual({
      totalMinutes: 0,
      nightMinutes: 0,
      sundayMinutes: 0,
      workDays: 0,
      leaveDays: 0,
      restDays: 0,
    });
  });
});

describe("addSummaries", () => {
  it("αθροίζει δύο εβδομάδες", () => {
    const a = summarizeWeek(week(work(900, 1300)));
    const b = summarizeWeek(week(work(900, 1300), repo));
    const t = addSummaries(a, b);
    expect(t.totalMinutes).toBe(800);
    expect(t.workDays).toBe(2);
    expect(t.restDays).toBe(1);
  });
});

describe("formatMinutes / decimalHours", () => {
  it("ανθρώπινη και μηχανική μορφή", () => {
    expect(formatMinutes(480)).toBe("8ω");
    expect(formatMinutes(400)).toBe("6ω 40′");
    expect(decimalHours(480)).toBe("8,00");
    expect(decimalHours(400)).toBe("6,67");
  });
});
