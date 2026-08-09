import { describe, it, expect } from "vitest";
import { notnameAusEmail } from "./allowlist";

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
