"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { MAX_NAME_LAENGE } from "@/lib/names";

/**
 * „+ Liste" / „+ Laden" — anlegen an Ort und Stelle.
 *
 * Ablagestrukturen entstehen im Moment des Bedarfs, nicht auf Vorrat
 * (Malone 1983, Whittaker & Sidner 1996). Wer beim Eintragen merkt, dass ein
 * Fach fehlt, muss es hier anlegen können — der Weg über die Einstellungen
 * wäre genau der Bruch, an dem die Struktur dann doch nicht entsteht.
 * Umbenennen und Löschen bleiben bewusst in den Einstellungen: selten,
 * destruktiv, gehören nicht in die Alltagsansicht.
 */
export function NeuesFachChip({
  label,
  placeholder,
  onCreate,
  onCreated,
}: {
  label: string;
  placeholder: string;
  onCreate: (name: string) => Promise<{ ok: boolean; grund?: string; id?: string }>;
  /** Nach dem Anlegen — z. B. gleich auf das neue Fach umschalten. */
  onCreated?: (id?: string) => void;
}) {
  const [offen, setOffen] = useState(false);
  const [name, setName] = useState("");
  const [fehler, setFehler] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  if (!offen) {
    return (
      <button
        onClick={() => setOffen(true)}
        className="shrink-0 rounded-pill border border-dashed border-ink-muted/40 px-4 py-2 text-sm font-medium text-ink-muted"
      >
        {label}
      </button>
    );
  }

  function anlegen() {
    const n = name.trim();
    if (!n) {
      setOffen(false);
      return;
    }
    start(async () => {
      const r = await onCreate(n);
      if (!r.ok) {
        setFehler(r.grund ?? "Hat nicht geklappt.");
        return;
      }
      setName("");
      setOffen(false);
      setFehler(null);
      router.refresh();
      onCreated?.(r.id);
    });
  }

  return (
    <span className="flex shrink-0 items-center gap-2">
      <input
        autoFocus
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setFehler(null);
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter") anlegen();
          if (e.key === "Escape") {
            setName("");
            setFehler(null);
            setOffen(false);
          }
        }}
        maxLength={MAX_NAME_LAENGE}
        placeholder={placeholder}
        className="w-44 rounded-pill border border-surface-muted bg-surface px-4 py-2 text-sm outline-none focus:border-accent"
      />
      <button
        onClick={anlegen}
        disabled={pending}
        className="shrink-0 rounded-pill bg-accent px-3.5 py-2 text-sm font-medium text-surface disabled:opacity-50"
      >
        OK
      </button>
      {fehler && <span className="text-sm text-signal">{fehler}</span>}
    </span>
  );
}
