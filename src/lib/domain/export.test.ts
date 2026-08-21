import { describe, expect, it } from "vitest";
import type { CellValue, PeriodData } from "@/lib/types";
import {
  buildMatrix,
  buildPeriodMatrix,
  encodeCell,
  splitName,
  toCsv,
  toExportCell,
  type ExportEmployeeRow,
} from "./export";

describe("encodeCell", () => {
  it("work 15:00–21:40 → 15002140 (όπως το δείγμα του λογιστή)", () => {
    expect(encodeCell({ kind: "work", interval: { start: 900, end: 1300 } })).toBe("15002140");
  });
  it("work 08:00–14:40 → 08001440", () => {
    expect(encodeCell({ kind: "work", interval: { start: 480, end: 880 } })).toBe("08001440");
  });
  it("midnight-crossing 17:00–01:00 → 17000100", () => {
    expect(encodeCell({ kind: "work", interval: { start: 1020, end: 60 } })).toBe("17000100");
  });
  it("repo → ΑΝ", () => {
    expect(encodeCell({ kind: "repo" })).toBe("ΑΝ");
  });
  it("leave types map to accountant vocabulary", () => {
    expect(encodeCell({ kind: "adeia", leaveType: "patrotita" })).toBe("ΠΑΤΡΟΤΗΤΑ");
    expect(encodeCell({ kind: "adeia", leaveType: "kanoniki" })).toBe("ΑΔΕΙΑ");
    expect(encodeCell({ kind: "adeia" })).toBe("ΑΔΕΙΑ");
    expect(encodeCell({ kind: "adeia", leaveType: "unknown-type" })).toBe("ΑΔΕΙΑ");
  });
  it("empty → κενό", () => {
    expect(encodeCell({ kind: "empty" })).toBe("");
  });
});

const row: ExportEmployeeRow = {
  payrollId: "101",
  afm: "123456789",
  lastName: "ΠΑΠΑΔΟΠΟΥΛΟΣ",
  firstName: "ΓΙΩΡΓΟΣ",
  cells: [
    { kind: "work", interval: { start: 900, end: 1300 } },
    { kind: "repo" },
    { kind: "work", interval: { start: 900, end: 1300 } },
    { kind: "work", interval: { start: 900, end: 1300 } },
    { kind: "adeia", leaveType: "kanoniki" },
    { kind: "work", interval: { start: 1020, end: 60 } },
    { kind: "empty" },
  ],
};

describe("buildMatrix", () => {
  it("produces header + data row in the accountant's column order", () => {
    const m = buildMatrix([row]);
    expect(m[0]).toEqual([
      "ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ",
      "Α.Φ.Μ",
      "ΕΠΩΝΥΜΟ",
      "ΟΝΟΜΑ",
      "ΔΕΥΤΕΡΑ",
      "ΤΡΙΤΗ",
      "ΤΕΤΑΡΤΗ",
      "ΠΕΜΠΤΗ",
      "ΠΑΡΑΣΚΕΥΗ",
      "ΣΑΒΒΑΤΟ",
      "ΚΥΡΙΑΚΗ",
    ]);
    expect(m[1]).toEqual([
      "101",
      "123456789",
      "ΠΑΠΑΔΟΠΟΥΛΟΣ",
      "ΓΙΩΡΓΟΣ",
      "15002140",
      "ΑΝ",
      "15002140",
      "15002140",
      "ΑΔΕΙΑ",
      "17000100",
      "",
    ]);
  });
  it("rejects rows without exactly 7 cells", () => {
    expect(() => buildMatrix([{ ...row, cells: row.cells.slice(0, 6) }])).toThrow();
  });
});

describe("splitName", () => {
  it("προτιμά τα ρητά πεδία μισθοδοσίας", () => {
    expect(splitName("Μακρής", "Μακρής", "Κώστας")).toEqual({
      lastName: "Μακρής",
      firstName: "Κώστας",
    });
  });
  it("αλλιώς σπάει το full_name (πρώτη λέξη = επώνυμο)", () => {
    expect(splitName("Παπαδόπουλος Γιώργος", null, null)).toEqual({
      lastName: "Παπαδόπουλος",
      firstName: "Γιώργος",
    });
    expect(splitName("Ρόκκας", null, null)).toEqual({ lastName: "Ρόκκας", firstName: "" });
  });
});

describe("toExportCell", () => {
  it("μεταφράζει κελιά προγράμματος", () => {
    expect(toExportCell({ kind: "work", start: 1020, end: 60 })).toEqual({
      kind: "work",
      interval: { start: 1020, end: 60 },
    });
    expect(toExportCell({ kind: "repo" })).toEqual({ kind: "repo" });
    expect(toExportCell({ kind: "adeia", leaveType: "patrotita" })).toEqual({
      kind: "adeia",
      leaveType: "patrotita",
    });
    expect(toExportCell({ kind: "empty" })).toEqual({ kind: "empty" });
    // work χωρίς ώρες δεν είναι έγκυρη βάρδια
    expect(toExportCell({ kind: "work" })).toEqual({ kind: "empty" });
  });
});

describe("buildPeriodMatrix", () => {
  const cells = (...c: CellValue[]): CellValue[] => {
    const out = [...c];
    while (out.length < 7) out.push({ kind: "empty" });
    return out;
  };
  const base: PeriodData = {
    employees: [
      {
        id: "e1",
        fullName: "Τσιμπάνου",
        departmentName: "SERVICE",
        payrollId: "101",
        afm: "123456789",
        firstName: "Μαρία",
        lastName: "Τσιμπάνου",
      },
    ],
    weeks: [
      {
        weekStart: "2026-08-17",
        published: true,
        cells: { e1: cells({ kind: "work", start: 1020, end: 60 }, { kind: "repo" }) },
      },
    ],
  };

  it("μία εβδομάδα = ακριβώς το format του δείγματος", () => {
    const m = buildPeriodMatrix(base);
    expect(m).toHaveLength(2);
    expect(m[1]).toEqual([
      "101",
      "123456789",
      "Τσιμπάνου",
      "Μαρία",
      "17000100",
      "ΑΝ",
      "",
      "",
      "",
      "",
      "",
    ]);
  });

  it("πολλές εβδομάδες: block ανά εβδομάδα με τίτλο", () => {
    const m = buildPeriodMatrix({
      ...base,
      weeks: [
        base.weeks[0],
        { weekStart: "2026-08-24", published: false, cells: { e1: cells({ kind: "repo" }) } },
      ],
    });
    expect(m[0]).toEqual(["ΕΒΔΟΜΑΔΑ 17/8 – 23/8"]);
    expect(m[1][0]).toBe("ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ");
    expect(m[3]).toEqual([]); // κενή γραμμή διαχωρισμού
    expect(m[4]).toEqual(["ΕΒΔΟΜΑΔΑ 24/8 – 30/8"]);
  });

  it("εργαζόμενος χωρίς κελιά στην εβδομάδα βγαίνει με κενά", () => {
    const m = buildPeriodMatrix({
      ...base,
      weeks: [{ weekStart: "2026-08-17", published: true, cells: {} }],
    });
    expect(m[1].slice(4)).toEqual(["", "", "", "", "", "", ""]);
  });
});

describe("toCsv", () => {
  it("starts with BOM and uses ';' + CRLF", () => {
    const csv = toCsv(buildMatrix([row]));
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain("ΑΡΙΘΜΟΣ ΜΗΤΡΩΟΥ;Α.Φ.Μ;ΕΠΩΝΥΜΟ;ΟΝΟΜΑ");
    expect(csv).toContain("\r\n101;123456789");
  });
  it("escapes delimiter inside values", () => {
    const csv = toCsv([["a;b", 'say "hi"']]);
    expect(csv).toContain('"a;b";"say ""hi"""');
  });
});
