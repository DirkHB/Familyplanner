import { describe, it, expect } from "vitest";
import {
  careBlockTitle,
  careBlockUid,
  isCareBlockUid,
  careBlockDescription,
  CARE_UID_PREFIX,
} from "./block";

describe("careBlockTitle", () => {
  it("trägt das Baby-Zeichen und den Namen", () => {
    expect(careBlockTitle("dirk")).toBe("👶 Nicolas · Dirk");
    expect(careBlockTitle("constanze")).toBe("👶 Nicolas · Constanze");
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

describe("careBlockDescription", () => {
  it("nennt den Anlass", () => {
    expect(careBlockDescription("Kinderarzt · U3")).toContain("Kinderarzt · U3");
  });
});
