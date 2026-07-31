import { describe, it, expect } from "vitest";
import { participantsOf, nameHintFromTitle } from "./attribution";
import { ICS_SHARED_WITH_ORGANIZER, ICS_SINGLE, ICS_SERIES_OVERRIDE } from "./fixtures";

describe("participantsOf", () => {
  it("liest Ersteller und Teilnehmer, ohne mailto und in Kleinschreibung", () => {
    expect(participantsOf(ICS_SHARED_WITH_ORGANIZER)).toEqual({
      organizer: "constanzehiller@hotmail.com",
      attendees: ["dirkbrederecke@gmail.com"],
    });
  });

  it("kommt ohne diese Angaben klar", () => {
    expect(participantsOf(ICS_SINGLE)).toEqual({ organizer: null, attendees: [] });
  });

  it("nimmt den Haupttermin, nicht die einzelne Ausnahme", () => {
    expect(participantsOf(ICS_SERIES_OVERRIDE)).toEqual({ organizer: null, attendees: [] });
  });

  it("kippt bei kaputten Daten nicht um", () => {
    expect(participantsOf("kein ical")).toEqual({ organizer: null, attendees: [] });
  });
});

describe("nameHintFromTitle", () => {
  it("erkennt einen Namen am Wortende", () => {
    expect(nameHintFromTitle("Zahnarzt Dirk")).toBe("dirk");
  });

  it("erkennt einen Namen am Wortanfang", () => {
    expect(nameHintFromTitle("Constanze Yoga")).toBe("constanze");
  });

  it("ignoriert Groß-/Kleinschreibung und Satzzeichen", () => {
    expect(nameHintFromTitle("Kinderarzt Nicolas | Impfung, CONSTANZE")).toBe("constanze");
  });

  it("hilft nicht, wenn beide drinstehen", () => {
    expect(nameHintFromTitle("Constanze und Dirk: Essen")).toBeNull();
  });

  it("hilft nicht ohne Namen", () => {
    expect(nameHintFromTitle("Müllabfuhr")).toBeNull();
  });

  it("erfindet nichts aus Wortstücken", () => {
    expect(nameHintFromTitle("Dirklauf-Training")).toBeNull();
  });
});
