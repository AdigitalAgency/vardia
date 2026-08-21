import { describe, expect, it } from "vitest";
import type { EmployeeInput, StaffMember } from "@/lib/types";
import { hasErrors, isValidEmail, validateEmployee } from "./validation";

function base(over: Partial<EmployeeInput> = {}): EmployeeInput {
  return {
    fullName: "Ρόκκας",
    departmentId: "d1",
    phone: "6971234567",
    email: null,
    hireDate: null,
    contractType: null,
    weeklyHours: null,
    payType: null,
    payAmount: null,
    healthCert: false,
    healthCertExpiry: null,
    notes: null,
    payroll: { payrollId: null, afm: null, firstName: "Γιώργος", lastName: "Ρόκκας" },
    ...over,
  };
}

const others = [
  {
    id: "e2",
    fullName: "Πάρης",
    payroll: { payrollId: "101", afm: null, firstName: null, lastName: null },
  },
] as Pick<StaffMember, "id" | "payroll" | "fullName">[];

describe("isValidEmail", () => {
  it("δέχεται κανονικά email", () => {
    expect(isValidEmail("nikos@example.gr")).toBe(true);
    expect(isValidEmail("a.b+c@sub.domain.co.uk")).toBe(true);
  });
  it("απορρίπτει σκουπίδια", () => {
    expect(isValidEmail("ηγφκυφ")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail("a@b.c")).toBe(false); // κατάληξη 1 γράμμα
    expect(isValidEmail("@example.gr")).toBe(false);
    expect(isValidEmail("a b@example.gr")).toBe(false);
    expect(isValidEmail("")).toBe(false);
  });
});

describe("υποχρεωτικά πεδία", () => {
  it("έγκυρη καρτέλα περνά", () => {
    expect(hasErrors(validateEmployee(base()))).toBe(false);
  });
  it("λείπει όνομα/τμήμα/επώνυμο/τηλέφωνο", () => {
    const r = validateEmployee(
      base({
        fullName: "  ",
        departmentId: null,
        phone: null,
        payroll: { payrollId: null, afm: null, firstName: null, lastName: null },
      })
    );
    expect(Object.keys(r.errors).sort()).toEqual(
      ["departmentId", "firstName", "fullName", "lastName", "phone"].sort()
    );
  });
});

describe("κινητό", () => {
  it("απορρίπτει το «69999999999999» της φόρμας", () => {
    const r = validateEmployee(base({ phone: "69999999999999" }));
    expect(r.errors.phone).toContain("Μη έγκυρο");
  });
  it("δέχεται 10ψήφιο και διεθνή μορφή", () => {
    expect(validateEmployee(base({ phone: "6971234567" })).errors.phone).toBeUndefined();
    expect(validateEmployee(base({ phone: "+30 6971234567" })).errors.phone).toBeUndefined();
  });
  it("απορρίπτει σταθερό", () => {
    expect(validateEmployee(base({ phone: "2101234567" })).errors.phone).toBeDefined();
  });
});

describe("αριθμός μητρώου", () => {
  it("μπλοκάρει διπλότυπο και λέει σε ποιον ανήκει", () => {
    const r = validateEmployee(
      base({ payroll: { payrollId: "101", afm: null, firstName: "Γ", lastName: "Ρ" } }),
      others
    );
    expect(r.errors.payrollId).toContain("Πάρης");
  });
  it("δεν συγκρούεται με τον εαυτό του κατά την επεξεργασία", () => {
    const r = validateEmployee(
      base({ payroll: { payrollId: "101", afm: null, firstName: "Γ", lastName: "Ρ" } }),
      others,
      "e2"
    );
    expect(r.errors.payrollId).toBeUndefined();
  });
});

describe("ώρες εβδομάδας", () => {
  it("41 ώρες → προειδοποίηση υπερωρίας, όχι σφάλμα", () => {
    const r = validateEmployee(base({ weeklyHours: 41 }));
    expect(r.errors.weeklyHours).toBeUndefined();
    expect(r.warnings.weeklyHours).toContain("υπερωρία");
  });
  it("40 ώρες → καθαρό", () => {
    const r = validateEmployee(base({ weeklyHours: 40 }));
    expect(r.warnings.weeklyHours).toBeUndefined();
  });
  it("πάνω από 48 → σφάλμα", () => {
    expect(validateEmployee(base({ weeklyHours: 60 })).errors.weeklyHours).toBeDefined();
  });
  it("μηδέν/αρνητικές → σφάλμα", () => {
    expect(validateEmployee(base({ weeklyHours: 0 })).errors.weeklyHours).toBeDefined();
  });
});

describe("αμοιβή", () => {
  it("τύπος χωρίς ποσό → σφάλμα", () => {
    expect(validateEmployee(base({ payType: "hourly" })).errors.payAmount).toBeDefined();
  });
  it("100€/ώρα → προειδοποίηση (πιθανό λάθος πεδίο)", () => {
    const r = validateEmployee(base({ payType: "hourly", payAmount: 100 }));
    expect(r.warnings.payAmount).toContain("ημερομίσθιο");
  });
  it("μερική με 40 ώρες → προειδοποίηση", () => {
    const r = validateEmployee(base({ contractType: "part", weeklyHours: 40 }));
    expect(r.warnings.contractType).toBeDefined();
  });
});

describe("ΑΦΜ", () => {
  it("9 ψηφία ΟΚ, αλλιώς σφάλμα", () => {
    const ok = base({ payroll: { payrollId: null, afm: "123456789", firstName: "Γ", lastName: "Ρ" } });
    expect(validateEmployee(ok).errors.afm).toBeUndefined();
    const bad = base({ payroll: { payrollId: null, afm: "123", firstName: "Γ", lastName: "Ρ" } });
    expect(validateEmployee(bad).errors.afm).toBeDefined();
  });
});
