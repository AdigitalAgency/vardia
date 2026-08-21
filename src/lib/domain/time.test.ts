import { describe, expect, it } from "vitest";
import {
  crossesMidnight,
  durationMinutes,
  formatHHMM,
  formatInterval,
  nightMinutes,
  parseHHMM,
  restMinutesBetween,
  splitByCalendarDay,
  violatesDailyRest,
} from "./time";

describe("parseHHMM / formatHHMM", () => {
  it("round-trips", () => {
    expect(parseHHMM("1500")).toBe(900);
    expect(parseHHMM("0000")).toBe(0);
    expect(parseHHMM("2140")).toBe(1300);
    expect(formatHHMM(900)).toBe("1500");
    expect(formatHHMM(5)).toBe("0005");
  });
  it("rejects invalid input", () => {
    expect(() => parseHHMM("2460")).toThrow();
    expect(() => parseHHMM("17:00")).toThrow();
    expect(() => formatHHMM(1440)).toThrow();
  });
});

describe("durationMinutes", () => {
  it("plain shift 15:00–21:40 = 6h40", () => {
    expect(durationMinutes({ start: 900, end: 1300 })).toBe(400);
  });
  it("midnight-crossing 17:00–01:00 = 8h", () => {
    expect(durationMinutes({ start: 1020, end: 60 })).toBe(480);
  });
  it("19:30–00:30 = 5h", () => {
    expect(durationMinutes({ start: 1170, end: 30 })).toBe(300);
  });
  it("rejects zero-length", () => {
    expect(() => durationMinutes({ start: 600, end: 600 })).toThrow();
  });
});

describe("crossesMidnight", () => {
  it("detects", () => {
    expect(crossesMidnight({ start: 1020, end: 60 })).toBe(true);
    expect(crossesMidnight({ start: 900, end: 1300 })).toBe(false);
  });
});

describe("nightMinutes (22:00–06:00)", () => {
  it("day shift has none", () => {
    expect(nightMinutes({ start: 480, end: 880 })).toBe(0); // 08:00–14:40
  });
  it("17:00–01:00 → 22:00–01:00 = 180", () => {
    expect(nightMinutes({ start: 1020, end: 60 })).toBe(180);
  });
  it("19:30–00:30 → 22:00–00:30 = 150", () => {
    expect(nightMinutes({ start: 1170, end: 30 })).toBe(150);
  });
  it("early morning 05:00–11:40 → 05:00–06:00 = 60", () => {
    expect(nightMinutes({ start: 300, end: 700 })).toBe(60);
  });
  it("full night 22:00–06:00 = 480", () => {
    expect(nightMinutes({ start: 1320, end: 360 })).toBe(480);
  });
});

describe("splitByCalendarDay", () => {
  it("plain shift = single segment", () => {
    expect(splitByCalendarDay({ start: 900, end: 1300 })).toEqual([
      { dayOffset: 0, start: 900, end: 1300 },
    ]);
  });
  it("19:30–00:30 splits at midnight", () => {
    expect(splitByCalendarDay({ start: 1170, end: 30 })).toEqual([
      { dayOffset: 0, start: 1170, end: 1440 },
      { dayOffset: 1, start: 0, end: 30 },
    ]);
  });
  it("shift ending exactly at midnight (18:00–00:00) has one segment", () => {
    expect(splitByCalendarDay({ start: 1080, end: 0 })).toEqual([
      { dayOffset: 0, start: 1080, end: 1440 },
    ]);
  });
});

describe("11h rest guardrail", () => {
  const evening = { start: 1020, end: 60 }; // 17:00–01:00
  const morning = { start: 540, end: 1020 }; // 09:00–17:00
  it("01:00 τέλος → 09:00 επόμενη = 8h rest → violation", () => {
    expect(restMinutesBetween(evening, morning, 1)).toBe(480);
    expect(violatesDailyRest(evening, morning, 1)).toBe(true);
  });
  it("01:00 τέλος → 17:00 επόμενη = 16h rest → ok", () => {
    expect(violatesDailyRest(evening, { start: 1020, end: 60 }, 1)).toBe(false);
  });
  it("back-to-back same-day shifts", () => {
    const a = { start: 480, end: 880 }; // 08:00–14:40
    const b = { start: 900, end: 1300 }; // 15:00–21:40 same day
    expect(violatesDailyRest(a, b, 0)).toBe(true);
  });
});

describe("formatInterval", () => {
  it("renders clock times", () => {
    expect(formatInterval({ start: 1020, end: 60 })).toBe("17:00–01:00");
  });
});
