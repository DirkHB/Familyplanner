import { describe, it, expect } from "vitest";
import { diffPull, detectPushConflict, type LocalState } from "./sync-diff";
import type { RemoteObject } from "./caldav";

const obj = (href: string, etag: string, ics = ""): RemoteObject => ({ href, etag, ics });

function local(entries: [string, string][]): LocalState {
  return { etagByHref: new Map(entries) };
}

describe("diffPull", () => {
  it("erkennt neue Objekte", () => {
    const d = diffPull([obj("/a", "1"), obj("/b", "1")], local([["/a", "1"]]), true);
    expect(d.toUpsert.map((o) => o.href)).toEqual(["/b"]);
    expect(d.hrefsToDelete).toEqual([]);
  });

  it("erkennt geänderte ETags", () => {
    const d = diffPull([obj("/a", "2")], local([["/a", "1"]]), true);
    expect(d.toUpsert.map((o) => o.href)).toEqual(["/a"]);
  });

  it("überspringt unveränderte Objekte", () => {
    const d = diffPull([obj("/a", "1")], local([["/a", "1"]]), true);
    expect(d.toUpsert).toEqual([]);
    expect(d.hrefsToDelete).toEqual([]);
  });

  it("leitet Löschungen nur beim vollständigen Abgleich ab", () => {
    const full = diffPull([obj("/a", "1")], local([["/a", "1"], ["/gone", "1"]]), true);
    expect(full.hrefsToDelete).toEqual(["/gone"]);

    const delta = diffPull([obj("/a", "1")], local([["/a", "1"], ["/gone", "1"]]), false);
    expect(delta.hrefsToDelete).toEqual([]);
  });
});

describe("detectPushConflict", () => {
  it("kein Konflikt bei gleichem ETag", () => {
    expect(detectPushConflict("abc", "abc")).toBe(false);
  });
  it("Konflikt bei abweichendem ETag", () => {
    expect(detectPushConflict("abc", "xyz")).toBe(true);
  });
  it("kein Konflikt, wenn ein ETag unbekannt ist (neu anlegen)", () => {
    expect(detectPushConflict(null, "xyz")).toBe(false);
    expect(detectPushConflict("abc", null)).toBe(false);
  });
});
