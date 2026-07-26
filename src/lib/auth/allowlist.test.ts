import { describe, it, expect } from "vitest";
import { parseAllowlist, isAllowedEmail, displayNameForEmail } from "./allowlist";

const RAW = "dirkbrederecke@gmail.com, c.brederecke@gmail.com";

describe("allowlist", () => {
  it("parst und normalisiert Adressen", () => {
    expect(parseAllowlist(RAW)).toEqual([
      "dirkbrederecke@gmail.com",
      "c.brederecke@gmail.com",
    ]);
    expect(parseAllowlist(undefined)).toEqual([]);
    expect(parseAllowlist("")).toEqual([]);
  });

  it("lässt genau die zwei Adressen zu (case-insensitiv)", () => {
    expect(isAllowedEmail("Dirkbrederecke@Gmail.com", RAW)).toBe(true);
    expect(isAllowedEmail("  c.brederecke@gmail.com ", RAW)).toBe(true);
  });

  it("blockt alles andere", () => {
    expect(isAllowedEmail("fremd@example.com", RAW)).toBe(false);
    expect(isAllowedEmail(null, RAW)).toBe(false);
    expect(isAllowedEmail(undefined, RAW)).toBe(false);
    expect(isAllowedEmail("", RAW)).toBe(false);
  });

  it("liefert die richtigen Anzeigenamen", () => {
    expect(displayNameForEmail("c.brederecke@gmail.com")).toBe("Constanze");
    expect(displayNameForEmail("dirkbrederecke@gmail.com")).toBe("Dirk");
    expect(displayNameForEmail("jemand@x.de")).toBe("jemand");
  });
});
