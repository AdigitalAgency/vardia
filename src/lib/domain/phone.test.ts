import { describe, expect, it } from "vitest";
import { displayPhone, isValidPin, normalizePhone, phoneToAuthEmail } from "./phone";

describe("normalizePhone", () => {
  it("δέχεται ελληνικό κινητό σε διάφορες μορφές", () => {
    expect(normalizePhone("6971234567")).toBe("306971234567");
    expect(normalizePhone("697 123 4567")).toBe("306971234567");
    expect(normalizePhone("+30 6971234567")).toBe("306971234567");
    expect(normalizePhone("00306971234567")).toBe("306971234567");
  });
  it("απορρίπτει μη έγκυρα", () => {
    expect(normalizePhone("2101234567")).toBeNull(); // σταθερό
    expect(normalizePhone("69712345")).toBeNull(); // κοντό
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("κινητό")).toBeNull();
  });
});

describe("displayPhone / phoneToAuthEmail", () => {
  it("γυρίζει στη μορφή που ξέρει ο χρήστης", () => {
    expect(displayPhone("306971234567")).toBe("6971234567");
  });
  it("σταθερό identifier για το Auth", () => {
    expect(phoneToAuthEmail("306971234567")).toBe("306971234567@employee.vardia.app");
  });
});

describe("isValidPin", () => {
  it("ακριβώς 6 ψηφία", () => {
    expect(isValidPin("123456")).toBe(true);
    expect(isValidPin("12345")).toBe(false);
    expect(isValidPin("1234567")).toBe(false);
    expect(isValidPin("12a456")).toBe(false);
  });
});
