import { describe, it, expect } from "vitest";
import { normalizeTaskTitle, MAX_WOERTER } from "./title-template";

describe("normalizeTaskTitle", () => {
  it("räumt Leerraum auf und macht den Anfang groß", () => {
    expect(normalizeTaskTitle("  kinderwagen   reparieren  ")).toBe("Kinderwagen reparieren");
  });

  it("wirft einleitende Füllwörter weg", () => {
    expect(normalizeTaskTitle("ich muss noch Windeln bestellen")).toBe("Windeln bestellen");
    expect(normalizeTaskTitle("Nicht vergessen: Passfoto machen")).toBe("Passfoto machen");
    expect(normalizeTaskTitle("wir müssen den Kinderarzt anrufen")).toBe("Den Kinderarzt anrufen");
  });

  it("entfernt auch mehrere Einleitungen hintereinander", () => {
    expect(normalizeTaskTitle("bitte nicht vergessen Müll rausbringen")).toBe("Müll rausbringen");
  });

  it("streicht Nachklapp am Ende", () => {
    expect(normalizeTaskTitle("Kinderwagen putzen, bitte")).toBe("Kinderwagen putzen");
    expect(normalizeTaskTitle("Steuer machen irgendwann")).toBe("Steuer machen");
  });

  it("kürzt auf sechs Wörter", () => {
    const lang = "Termin beim Kinderarzt für die U4 Untersuchung vereinbaren und bestätigen";
    const kurz = normalizeTaskTitle(lang);
    expect(kurz.split(" ")).toHaveLength(MAX_WOERTER);
    expect(kurz).toBe("Termin beim Kinderarzt für die U4");
  });

  it("lässt kurze, saubere Titel unangetastet", () => {
    expect(normalizeTaskTitle("Windeln bestellen")).toBe("Windeln bestellen");
  });

  it("kommt mit leerer Eingabe klar", () => {
    expect(normalizeTaskTitle("")).toBe("");
    expect(normalizeTaskTitle("   ")).toBe("");
    expect(normalizeTaskTitle("bitte")).toBe("");
  });

  it("frisst kein Wort, das nur zufällig so anfängt", () => {
    // „Bitternis" beginnt mit „bitte", ist aber ein eigenes Wort.
    expect(normalizeTaskTitle("Bitternis notieren")).toBe("Bitternis notieren");
  });
});
