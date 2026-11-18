import { describe, it, expect } from "vitest";
import { langName, LANGUAGE_LIST, LANGUAGES } from "./translate";

describe("langName", () => {
  it("returns the English name for a known code", () => {
    expect(langName("en")).toBe("English");
    expect(langName("es")).toBe("Spanish");
  });

  it("falls back to the code itself for unknown languages", () => {
    expect(langName("xx")).toBe("xx");
    expect(langName("")).toBe("");
  });
});

describe("LANGUAGE_LIST", () => {
  it("contains no duplicate codes", () => {
    const codes = new Set(LANGUAGE_LIST.map((l) => l.code));
    expect(codes.size).toBe(LANGUAGE_LIST.length);
  });

  it("is derived from LANGUAGES without losing entries", () => {
    expect(LANGUAGE_LIST.length).toBe(LANGUAGES.length);
  });
});
