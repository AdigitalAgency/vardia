import { describe, expect, it } from "vitest";
import { slugify } from "./slug";

describe("slugify", () => {
  it("μεταγράφει ελληνικά", () => {
    expect(slugify("Καφενείο Ψαρού")).toBe("kafeneio-psaroy");
    expect(slugify("Ούζερί Θάλασσα")).toBe("oyzeri-thalassa");
  });
  it("κρατά λατινικά και αριθμούς", () => {
    expect(slugify("The Little Mosque")).toBe("the-little-mosque");
    expect(slugify("Bar 42")).toBe("bar-42");
  });
  it("καθαρίζει σημεία στίξης και άκρα", () => {
    expect(slugify("  Café «Ώρα»!  ")).toBe("cafe-ora");
    expect(slugify("--- ---")).toBe("shop");
    expect(slugify("")).toBe("shop");
  });
  it("κόβει σε λογικό μήκος", () => {
    expect(slugify("a".repeat(60)).length).toBeLessThanOrEqual(40);
  });
});
