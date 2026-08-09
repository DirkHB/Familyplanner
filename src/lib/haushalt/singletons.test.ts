import { describe, it, expect } from "vitest";
import { mitHaushalt, gesetzterHaushalt, ueberAlleHaushalte, istUeberAlleHaushalte } from "./kontext";

/**
 * Der Haushalt ist keine Konstante mehr, sondern etwas, das für die Dauer
 * einer Aufgabe gilt. Geprüft wird genau das: dass er innerhalb gilt,
 * außerhalb nicht mehr, und dass er ein `await` überlebt.
 *
 * Das letzte ist kein akademischer Fall. Eine Prisma-Abfrage startet erst,
 * wenn jemand auf sie wartet — gäbe man das Versprechen ungewartet zurück,
 * wäre der Kontext beim Start der Abfrage längst wieder zu. Genau so ist es
 * beim ersten Versuch passiert, und der Riegel fand keinen Haushalt.
 */
describe("Haushalts-Kontext", () => {
  it("gilt innerhalb und danach nicht mehr", async () => {
    expect(gesetzterHaushalt()).toBe(null);
    const drin = await mitHaushalt("haus-1", async () => gesetzterHaushalt());
    expect(drin).toBe("haus-1");
    expect(gesetzterHaushalt()).toBe(null);
  });

  it("überlebt ein await", async () => {
    const gesehen = await mitHaushalt("haus-1", async () => {
      await new Promise((r) => setTimeout(r, 5));
      return gesetzterHaushalt();
    });
    expect(gesehen).toBe("haus-1");
  });

  it("hält zwei nebenläufige Haushalte auseinander", async () => {
    const [a, b] = await Promise.all([
      mitHaushalt("haus-a", async () => {
        await new Promise((r) => setTimeout(r, 10));
        return gesetzterHaushalt();
      }),
      mitHaushalt("haus-b", async () => gesetzterHaushalt()),
    ]);
    expect(a).toBe("haus-a");
    expect(b).toBe("haus-b");
  });

  it("die Ausnahme über alle Haushalte muss hingeschrieben werden", async () => {
    expect(istUeberAlleHaushalte()).toBe(false);
    expect(await ueberAlleHaushalte(async () => istUeberAlleHaushalte())).toBe(true);
    expect(istUeberAlleHaushalte()).toBe(false);
  });
});
