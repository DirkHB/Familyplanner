import { describe, it, expect } from "vitest";
import {
  careBlockTitle,
  careBlockUid,
  isCareBlockUid,
  careBlockDescription,
  dayKeyFromCareBlockUid,
  CARE_UID_PREFIX,
} from "./block";

describe("careBlockTitle", () => {
  it("trägt das Baby-Zeichen, den Namen des Kindes und den der Person", () => {
    expect(careBlockTitle("Nicolas", "Dirk")).toBe("👶 Nicolas · Dirk");
    expect(careBlockTitle("Nicolas", "Constanze")).toBe("👶 Nicolas · Constanze");
  });

  it("nimmt jeden Namen — auch Oma oder einen anderen Haushalt", () => {
    expect(careBlockTitle("Nicolas", "Oma")).toBe("👶 Nicolas · Oma");
    expect(careBlockTitle("Mia", "Thomas")).toBe("👶 Mia · Thomas");
  });
});

describe("careBlockUid", () => {
  it("ist für denselben Anlass am selben Tag immer gleich", () => {
    const a = careBlockUid("abc-123@icloud.com", "2026-08-03");
    const b = careBlockUid("abc-123@icloud.com", "2026-08-03");
    expect(a).toBe(b);
  });

  it("unterscheidet Vorkommen derselben Serie", () => {
    const mo = careBlockUid("serie-1@icloud.com", "2026-08-03");
    const di = careBlockUid("serie-1@icloud.com", "2026-08-04");
    expect(mo).not.toBe(di);
  });

  it("unterscheidet verschiedene Anlässe am selben Tag", () => {
    expect(careBlockUid("a@icloud.com", "2026-08-03")).not.toBe(
      careBlockUid("b@icloud.com", "2026-08-03"),
    );
  });

  it("verträgt ungewöhnliche Zeichen in fremden UIDs", () => {
    const uid = careBlockUid("wild uid/mit:zeichen?&=", "2026-08-03");
    expect(uid.startsWith(CARE_UID_PREFIX)).toBe(true);
    // Nichts, was in einer CalDAV-Adresse Ärger macht.
    expect(uid).toMatch(/^[A-Za-z0-9._@-]+$/);
  });
});

describe("isCareBlockUid", () => {
  it("erkennt eigene Blöcke", () => {
    expect(isCareBlockUid(careBlockUid("x@y.z", "2026-08-03"))).toBe(true);
  });

  it("hält fremde Termine auseinander", () => {
    expect(isCareBlockUid("irgendwas@icloud.com")).toBe(false);
    // Auch selbst angelegte, normale Termine sind keine Betreuungsblöcke.
    expect(isCareBlockUid("fp-1234@planyourweek.app")).toBe(false);
  });
});

describe("dayKeyFromCareBlockUid", () => {
  it("liest den Tag zurück", () => {
    expect(dayKeyFromCareBlockUid(careBlockUid("abc@icloud.com", "2026-08-03"))).toBe("2026-08-03");
  });

  it("verträgt UIDs, in denen der Anlass selbst wie ein Datum aussieht", () => {
    const uid = careBlockUid("2026-01-01-serie@icloud.com", "2026-08-03");
    expect(dayKeyFromCareBlockUid(uid)).toBe("2026-08-03");
  });

  it("gibt bei fremden Terminen nichts zurück", () => {
    expect(dayKeyFromCareBlockUid("irgendwas@icloud.com")).toBe(null);
  });
});

describe("Anlass zu einem Block wiederfinden", () => {
  it("findet unter den Betreuungen des Tages genau die richtige", () => {
    // So sucht anlassFuerBlock: Tag aus der UID lesen, dann für jede Betreuung
    // dieses Tages die UID nachbauen und vergleichen. Ohne diese Runde könnte
    // man eine Zusage nicht zurücknehmen — der Anlass wäre nicht auffindbar.
    const tag = "2026-08-03";
    const kandidaten = ["zahnarzt@icloud.com", "sport/kurs@icloud.com", "abc-123@icloud.com"];
    const gesucht = careBlockUid("sport/kurs@icloud.com", tag);

    expect(dayKeyFromCareBlockUid(gesucht)).toBe(tag);
    const treffer = kandidaten.filter((uid) => careBlockUid(uid, tag) === gesucht);
    expect(treffer).toEqual(["sport/kurs@icloud.com"]);
  });
});

describe("Blöcke eines gelöschten Termins finden", () => {
  it("erwischt alle Tage der Serie und lässt fremde Blöcke stehen", () => {
    // So sucht removeCareBlocksForEvent: über alle Blöcke gehen, aus jedem den
    // Tag lesen und prüfen, ob er zu diesem Anlass gehört. Ohne das blieb beim
    // Löschen des Termins die Betreuung im Kalender stehen.
    const anlass = "kurs@icloud.com";
    const imKalender = [
      careBlockUid(anlass, "2026-08-03"),
      careBlockUid(anlass, "2026-08-10"),
      careBlockUid("anderer@icloud.com", "2026-08-03"),
    ];

    const zuLoeschen = imKalender.filter((blockUid) => {
      const tag = dayKeyFromCareBlockUid(blockUid);
      return tag !== null && careBlockUid(anlass, tag) === blockUid;
    });

    expect(zuLoeschen).toEqual([
      careBlockUid(anlass, "2026-08-03"),
      careBlockUid(anlass, "2026-08-10"),
    ]);
  });
});

describe("careBlockDescription", () => {
  it("nennt den Anlass", () => {
    expect(careBlockDescription("Kinderarzt · U3")).toContain("Kinderarzt · U3");
  });
});
