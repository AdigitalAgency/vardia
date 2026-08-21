import { describe, expect, it } from "vitest";
import { buildMatrix, encodeCell, toCsv, type ExportEmployeeRow } from "./export";

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
