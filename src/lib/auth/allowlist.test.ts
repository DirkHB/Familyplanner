import { describe, it, expect } from "vitest";
import { parseAllowlist, isAllowedEmail, notnameAusEmail } from "./allowlist";

describe("parseAllowlist", () => {
  it("trennt, trimmt und macht klein", () => {
    expect(parseAllowlist(" A@x.de , b@Y.de ")).toEqual(["a@x.de", "b@y.de"]);
  });

  it("wirft Leeres weg", () => {
    expect(parseAllowlist("a@x.de,,")).toEqual(["a@x.de"]);
    expect(parseAllowlist(undefined)).toEqual([]);
  });
});

describe("isAllowedEmail", () => {
  const liste = "a@x.de,b@y.de";

  it("lässt Eingetragene rein, unabhängig von Groß- und Kleinschreibung", () => {
    expect(isAllowedEmail("A@X.de", liste)).toBe(true);
    expect(isAllowedEmail(" b@y.de ", liste)).toBe(true);
  });

  it("lässt alle anderen draußen", () => {
    expect(isAllowedEmail("c@z.de", liste)).toBe(false);
    expect(isAllowedEmail(null, liste)).toBe(false);
    expect(isAllowedEmail("a@x.de", undefined)).toBe(false);
  });
});

describe("notnameAusEmail", () => {
  it("macht aus der Adresse einen brauchbaren Notnamen", () => {
    expect(notnameAusEmail("thomas@example.com")).toBe("Thomas");
    expect(notnameAusEmail("yvonne.mueller@example.com")).toBe("Yvonne");
    expect(notnameAusEmail("c.brederecke@gmail.com")).toBe("C");
  });

  it("fällt nie auf einen fremden Namen zurück", () => {
    // Früher stand hier eine feste Zuordnung: Jede unbekannte Adresse wurde
    // „Constanze". In einem zweiten Haushalt hieß damit jeder so.
    expect(notnameAusEmail("irgendwer@example.com")).toBe("Irgendwer");
    expect(notnameAusEmail("")).toBe("Du");
    expect(notnameAusEmail(null)).toBe("Du");
  });
});
