import { describe, it, expect } from "vitest";
import {
  neuerToken,
  tokenAbdruck,
  abdruckGleich,
  laeuftAb,
  einladungsLink,
  EINLADUNG_TAGE,
} from "./token";

describe("Einladungs-Token", () => {
  it("ist jedes Mal ein anderer", () => {
    const viele = new Set(Array.from({ length: 200 }, () => neuerToken()));
    expect(viele.size).toBe(200);
  });

  it("passt ohne Umschreiben in eine URL", () => {
    // Base64url: keine Prozentzeichen, kein Plus, kein Schrägstrich — sonst
    // bricht der Link in einer Mail um oder wird beim Kopieren beschädigt.
    for (let i = 0; i < 50; i++) {
      expect(neuerToken()).toMatch(/^[A-Za-z0-9_-]+$/);
    }
  });

  it("gibt aus dem Abdruck den Token nicht zurück", () => {
    const t = neuerToken();
    const abdruck = tokenAbdruck(t);
    expect(abdruck).not.toContain(t);
    expect(abdruck).toHaveLength(64);
  });

  it("erkennt denselben Token wieder", () => {
    const t = neuerToken();
    expect(tokenAbdruck(t)).toBe(tokenAbdruck(t));
    // Führende und folgende Leerzeichen entstehen beim Kopieren aus einer Mail.
    expect(tokenAbdruck(` ${t} `)).toBe(tokenAbdruck(t));
  });

  it("hält zwei Token auseinander", () => {
    expect(tokenAbdruck(neuerToken())).not.toBe(tokenAbdruck(neuerToken()));
  });

  it("vergleicht Abdrücke ohne früh abzubrechen", () => {
    const a = tokenAbdruck("eins");
    expect(abdruckGleich(a, tokenAbdruck("eins"))).toBe(true);
    expect(abdruckGleich(a, tokenAbdruck("zwei"))).toBe(false);
    expect(abdruckGleich(a, "kurz")).toBe(false);
  });

  it("läuft nach zwei Wochen ab", () => {
    const jetzt = new Date("2026-08-09T12:00:00.000Z");
    const ende = laeuftAb(jetzt);
    expect(ende.getTime() - jetzt.getTime()).toBe(EINLADUNG_TAGE * 86_400_000);
  });

  it("baut den Link ohne doppelten Schrägstrich", () => {
    expect(einladungsLink("https://planyourweek.app", "abc")).toBe(
      "https://planyourweek.app/einladung/abc",
    );
    expect(einladungsLink("https://planyourweek.app/", "abc")).toBe(
      "https://planyourweek.app/einladung/abc",
    );
  });
});
