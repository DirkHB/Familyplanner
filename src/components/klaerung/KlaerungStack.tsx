"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence, useMotionValue, useTransform } from "motion/react";
import type { KlaerungCard } from "@/lib/klaerung/build";
import { shiftLabel } from "@/lib/klaerung/build";
import {
  stapelErledigtAction,
  stapelMorgenAction,
  stapelBetreuungIchAction,
  stapelBetreuungUnnoetigAction,
  stapelKannNichtAction,
  stapelAntwortAction,
  stapelEskalationGeklaertAction,
  stapelParkenDieseWocheAction,
  stapelParkenBleibtAction,
  stapelRueckgaengigAction,
} from "@/app/klaerung/actions";
import type { StapelUndo } from "@/lib/klaerung/undo";

/**
 * Der Kartenstapel: eine Entscheidung pro Karte, einhändig wischbar.
 * Rechts heißt immer „ich / erledigt", links immer „nicht ich / nicht jetzt".
 *
 * Jede Antwort wird SOFORT geschrieben; „Rückgängig" ist eine Gegenbuchung
 * über die von der Aktion zurückgegebene Undo-Beschreibung. Der erste Bau
 * hielt die Aktion 3 Sekunden zurück — wer nach dem letzten Wisch die App
 * wechselte, verlor die Antwort und bekam dieselbe Frage später wieder.
 * Sonst niemand: Antworten dürfen nie am Weiterleben des Tabs hängen.
 */

/**
 * Wischen entscheidet zwei Richtungen; die dritte steht als Knopf auf der
 * Karte. Was sie bedeutet, hängt von der Karte ab: bei Aufgaben „morgen",
 * bei Betreuung „nicht nötig".
 */
type Decision = {
  card: KlaerungCard;
  richtung: "rechts" | "links" | "morgen" | "keine";
  label: string;
};

type Ergebnis = { ok: boolean; undo?: StapelUndo };

function actionFor(d: Decision): (() => Promise<Ergebnis>) | null {
  const c = d.card;
  switch (c.kind) {
    case "aufgabe":
      if (d.richtung === "rechts") return () => stapelErledigtAction(c.id);
      if (d.richtung === "morgen") return () => stapelMorgenAction(c.id);
      return null; // links = später — bewusst keine Datenänderung
    case "betreuung":
      if (d.richtung === "rechts") return () => stapelBetreuungIchAction(c.uid, c.occurrenceISO);
      if (d.richtung === "keine")
        return () => stapelBetreuungUnnoetigAction(c.uid, c.occurrenceISO, c.title);
      return () => stapelKannNichtAction(c.uid, c.occurrenceISO, c.title);
    case "anfrage":
      return () => stapelAntwortAction(c.id, d.richtung === "rechts" ? "Ja" : "Nein");
    case "eskalation":
      return d.richtung === "rechts" ? () => stapelEskalationGeklaertAction(c.uid, c.occurrenceISO) : null;
    case "parken":
      return d.richtung === "rechts"
        ? () => stapelParkenDieseWocheAction(c.id)
        : () => stapelParkenBleibtAction(c.id);
  }
}

const LABELS: Record<KlaerungCard["kind"], { links: string; rechts: string }> = {
  aufgabe: { links: "Später", rechts: "Erledigt ✓" },
  betreuung: { links: "Ich kann nicht", rechts: "Ich mach das ✓" },
  anfrage: { links: "Nein", rechts: "Ja ✓" },
  eskalation: { links: "Später", rechts: "Anders gelöst ✓" },
  parken: { links: "Bleibt liegen", rechts: "Diese Woche ✓" },
};

/** Was in der Rückgängig-Leiste steht — im Rückblick formuliert. */
function entscheidungsLabel(card: KlaerungCard, richtung: Decision["richtung"]): string {
  if (richtung === "morgen") return "Auf morgen geschoben";
  if (richtung === "keine") return "Als nicht nötig gemerkt";
  return LABELS[card.kind][richtung === "rechts" ? "rechts" : "links"];
}

export function KlaerungStack({ cards, onClose }: { cards: KlaerungCard[]; onClose: () => void }) {
  const [index, setIndex] = useState(0);
  const [undo, setUndo] = useState<Decision | null>(null);
  /**
   * Die Gegenbuchung zur letzten Antwort — als Promise, weil „Rückgängig"
   * schneller getippt sein kann, als die Antwort des Servers zurück ist.
   */
  const undoRef = useRef<Promise<StapelUndo | null> | null>(null);

  const card = cards[index] ?? null;
  const fertig = index >= cards.length;

  useEffect(() => {
    if (fertig) {
      const t = setTimeout(onClose, 1200);
      return () => clearTimeout(t);
    }
  }, [fertig, onClose]);

  function decide(richtung: Decision["richtung"]) {
    if (!card) return;
    const d: Decision = { card, richtung, label: entscheidungsLabel(card, richtung) };
    const run = actionFor(d);
    if (run) {
      // Sofort schreiben. Die Rückgängig-Leiste bleibt trotzdem 3 Sekunden —
      // sie nimmt jetzt zurück, statt den Versand aufzuhalten.
      undoRef.current = run()
        .then((r) => r.undo ?? null)
        .catch(() => null);
      setUndo(d);
      setTimeout(() => setUndo((u) => (u === d ? null : u)), 3000);
    }
    setIndex((i) => i + 1);
  }

  function undoLast() {
    const p = undoRef.current;
    undoRef.current = null;
    setUndo(null);
    setIndex((i) => Math.max(0, i - 1));
    if (p) {
      void p.then((u) => (u ? stapelRueckgaengigAction(u) : null)).catch(() => null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex flex-col bg-bg text-ink">
      {/* Kopf: Fortschritt + gut sichtbares „Später" — nie verstecken. */}
      <div className="flex items-center justify-between px-5 pb-2 pt-6">
        <p className="eyebrow text-ink-muted">
          {fertig ? "Geschafft" : `Kurz klären · ${index + 1} von ${cards.length}`}
        </p>
        <button onClick={onClose} className="rounded-pill bg-surface px-4 py-2 text-sm font-medium shadow-card">
          Später
        </button>
      </div>

      <div className="relative min-h-0 flex-1 px-5 pb-5">
        <AnimatePresence mode="popLayout">
          {card && !fertig && (
            <SwipeCard key={`${card.kind}-${index}`} card={card} onDecide={decide} />
          )}
          {fertig && (
            <motion.div
              key="fertig"
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex h-full flex-col items-center justify-center text-center"
            >
              <p className="font-display text-4xl">Alles geklärt ✓</p>
              <p className="mt-3 text-ink-muted">Für heute liegt nichts mehr an.</p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Rückgängig — drei Sekunden sichtbar; die Entscheidung ist längst
          geschrieben, der Knopf bucht sie zurück. Zentriert über einen
          Flex-Container: Motion setzt selbst transform, ein -translate-x-1/2
          in der Klasse würde dabei verloren gehen. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-8 flex justify-center">
        <AnimatePresence>
          {undo && (
            <motion.button
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              onClick={undoLast}
              className="pointer-events-auto flex items-center gap-2 whitespace-nowrap rounded-pill bg-surface px-5 py-3 text-sm font-medium text-ink shadow-hero"
            >
              {undo.label} · <span className="underline">Rückgängig</span>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

function SwipeCard({ card, onDecide }: { card: KlaerungCard; onDecide: (r: Decision["richtung"]) => void }) {
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 200], [-7, 7]);
  const rechtsOpacity = useTransform(x, [30, 110], [0, 1]);
  const linksOpacity = useTransform(x, [-110, -30], [1, 0]);
  const labels = LABELS[card.kind];

  return (
    <motion.div
      style={{ x, rotate, touchAction: "pan-y" }}
      drag="x"
      dragElastic={0.6}
      dragConstraints={{ left: 0, right: 0 }}
      onDragEnd={(_, info) => {
        if (info.offset.x > 90 || info.velocity.x > 600) onDecide("rechts");
        else if (info.offset.x < -90 || info.velocity.x < -600) onDecide("links");
      }}
      initial={{ opacity: 0, y: 24, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, transition: { duration: 0.15 } }}
      className="flex h-full flex-col"
    >
      <div className="relative flex min-h-0 flex-1 flex-col justify-between overflow-hidden rounded-card bg-ink p-6 text-surface shadow-hero">
        {/* Wisch-Hinweise */}
        <motion.span style={{ opacity: rechtsOpacity }} className="absolute left-5 top-5 rounded-pill bg-accent px-3 py-1.5 text-sm font-semibold text-surface">
          {labels.rechts}
        </motion.span>
        <motion.span style={{ opacity: linksOpacity }} className="absolute right-5 top-5 rounded-pill bg-counter px-3 py-1.5 text-sm font-semibold text-ink">
          {labels.links}
        </motion.span>

        <CardBody card={card} />
        <CardActions card={card} onDecide={onDecide} />
      </div>
    </motion.div>
  );
}

function CardBody({ card }: { card: KlaerungCard }) {
  switch (card.kind) {
    case "aufgabe": {
      const shifts = shiftLabel(card.shiftCount);
      return (
        <div className="mt-10">
          <p className="eyebrow text-accent-light">Aufgabe {card.overdue ? "· überfällig" : "· heute"}</p>
          <p className="mt-3 font-display text-3xl leading-tight">{card.title}</p>
          {card.dueLabel && <p className="mt-3 text-surface/70">bis {card.dueLabel}</p>}
          {shifts && <p className="mt-2 text-sm text-counter-light">{shifts}</p>}
        </div>
      );
    }
    case "betreuung":
      return (
        <div className="mt-10">
          <p className="eyebrow text-accent-light">Wer ist bei Nicolas?</p>
          <p className="mt-3 font-display text-3xl leading-tight">{card.title}</p>
          <p className="mt-3 text-surface/70">{card.when}</p>
        </div>
      );
    case "anfrage":
      return (
        <div className="mt-10">
          <p className="eyebrow text-accent-light">{card.fromName} fragt</p>
          <p className="mt-3 font-display text-3xl leading-tight">{card.question}</p>
        </div>
      );
    case "parken":
      return (
        <div className="mt-10">
          <p className="eyebrow text-accent-light">
            Liegt ohne Termin{card.important ? " · wichtig" : ""}
          </p>
          <p className="mt-3 font-display text-3xl leading-tight">{card.title}</p>
          <p className="mt-3 text-surface/70">Nimmst du dir das diese Woche vor?</p>
        </div>
      );
    case "eskalation":
      return (
        <div className="mt-10">
          <p className="eyebrow text-counter-light">Ihr könnt beide nicht</p>
          <p className="mt-3 font-display text-3xl leading-tight">{card.title}</p>
          <p className="mt-3 text-surface/70">{card.when} — Oma fragen? Termin verschieben?</p>
        </div>
      );
  }
}

/**
 * Der dritte Weg, mittig über den beiden Wisch-Knöpfen.
 *
 * Mit Rand statt nur mit Flächenfarbe: `bg-surface/10` allein ist auf dem
 * dunklen Grund so blass, dass der Knopf wie eine Bildunterschrift aussieht.
 * Bei „Auf morgen schieben" war das zu verschmerzen, bei „Nicht nötig" nicht —
 * das ist beim Kinderarzt die einzig richtige Antwort.
 */
const DRITTER_WEG =
  "self-center rounded-pill border border-surface/25 bg-surface/10 px-5 py-2.5 text-sm font-medium text-surface";

function CardActions({ card, onDecide }: { card: KlaerungCard; onDecide: (r: Decision["richtung"]) => void }) {
  const labels = LABELS[card.kind];
  return (
    <div className="flex flex-col gap-3">
      {card.kind === "aufgabe" && (
        <button onClick={() => onDecide("morgen")} className={DRITTER_WEG}>
          Auf morgen schieben
        </button>
      )}
      {/*
        Der dritte Weg bei Betreuung: Nicolas ist dabei (Kinderarzt), oder die
        Frage stellt sich hier gar nicht. Ohne ihn blieben nur „ich mach das"
        — was einen Betreuungsblock über den Termin legt — und „ich kann
        nicht", was Constanze grundlos fragt. Beides falsch, also musste ein
        dritter Knopf her.
      */}
      {card.kind === "betreuung" && (
        <button onClick={() => onDecide("keine")} className={DRITTER_WEG}>
          Nicht nötig — Nicolas ist dabei
        </button>
      )}
      {card.kind === "eskalation" && (
        <Link href={`/termin/${encodeURIComponent(card.uid)}`} className={DRITTER_WEG}>
          Termin ansehen
        </Link>
      )}
      {/* Knöpfe als Alternative zum Wischen — gleiche Bedeutung, gleiche Seite. */}
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onDecide("links")} className="whitespace-nowrap rounded-pill border border-surface/25 bg-surface/10 px-3 py-3.5 text-[15px] font-medium text-surface">
          {labels.links}
        </button>
        <button onClick={() => onDecide("rechts")} className="whitespace-nowrap rounded-pill bg-accent px-3 py-3.5 text-[15px] font-medium text-surface">
          {labels.rechts}
        </button>
      </div>
      <p className="text-center text-xs text-surface/50">oder Karte wischen — rechts ja, links nein</p>
    </div>
  );
}
