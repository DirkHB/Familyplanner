"use client";

import { createContext, useContext } from "react";
import { PLATZ_A, PLATZ_B, type Platz } from "@/lib/haushalt/platz";

/**
 * Wer wohnt hier — für die Oberfläche.
 *
 * Die Namen stehen in der Datenbank, gebraucht werden sie aber in Bausteinen,
 * die tief in Client-Komponenten sitzen: der Avatar in der Wochenliste, der
 * Kreis in der Leiste, die Zeile „für Constanze" im Erfassen. Sie durch elf
 * Ebenen durchzureichen hieße, elf Signaturen für eine Anzeige zu ändern.
 *
 * Deshalb einmal ganz oben hineingelegt und überall dort gelesen, wo ein Name
 * hingehört. Fehlt er (Anmeldeseite, Datenbank gerade nicht erreichbar),
 * bleibt die Oberfläche trotzdem benutzbar — nur ohne Namen.
 */

export type HaushaltNamen = Record<Platz, string>;

const LEER: HaushaltNamen = { [PLATZ_A]: "", [PLATZ_B]: "" };

const Ctx = createContext<HaushaltNamen>(LEER);

export function HaushaltProvider({
  namen,
  children,
}: {
  namen: HaushaltNamen;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={namen}>{children}</Ctx.Provider>;
}

/** Der Name zu einem Platz — leer, wenn noch keiner gesetzt ist. */
export function useName(platz: Platz | null | undefined): string {
  const namen = useContext(Ctx);
  if (!platz) return "";
  return namen[platz] ?? "";
}

export function useHaushaltNamen(): HaushaltNamen {
  return useContext(Ctx);
}
