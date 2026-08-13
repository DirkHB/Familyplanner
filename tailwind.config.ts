import type { Config } from "tailwindcss";

/**
 * Farben referenzieren CSS-Variablen (in globals.css als OKLCH definiert),
 * damit Light/Dark über einen Token-Wechsel laufen und nie doppelt gepflegt werden.
 */

/**
 * Eine Farbe, die auch mit Deckkraft funktioniert.
 *
 * Vorher stand hier schlicht `"var(--color-ink-muted)"`. Das genügt für
 * `text-ink-muted`, aber Tailwind kann in eine fertige `var(...)` keine
 * Deckkraft hineinrechnen — und `text-ink-muted/70` fiel damit still aus.
 * Still ist hier das Problem: Es sah nicht kaputt aus, sondern nur anders,
 * und zwar auf drei Arten. Durchsichtig (`bg-…/60`), volle Deckkraft
 * (`text-…/70`), oder Tailwinds Standardgrau (`border-…/40`). Ein Ton, den
 * niemand gewählt hat, an rund hundert Stellen.
 *
 * `color-mix` löst das, ohne die Variablen anzufassen: Sie bleiben
 * vollständige Farben, und die 36 Stellen, die sie direkt in `style` oder
 * `bg-[var(...)]` benutzen, merken nichts davon.
 */
type Deckkraft = { opacityValue?: string };

const token =
  (name: string) =>
  ({ opacityValue }: Deckkraft = {}) => {
    const farbe = `var(--color-${name})`;
    if (opacityValue === undefined || opacityValue === "") return farbe;
    const anteil = Number(opacityValue);
    // Kein auswertbarer Wert (etwa eine eigene Variable): lieber die volle
    // Farbe als eine Regel, die der Browser wegwirft.
    if (!Number.isFinite(anteil)) return farbe;
    const prozent = Math.round(anteil * 10000) / 100;
    return `color-mix(in oklab, ${farbe} ${prozent}%, transparent)`;
  };

/*
 * Die Umtypung ist nötig, nicht bequem: Tailwind wertet Farbfunktionen zur
 * Laufzeit aus, seine mitgelieferten Typen kennen an dieser Stelle aber nur
 * Zeichenketten. Ohne den Cast lässt sich die Deckkraft gar nicht erst
 * einbauen.
 */
const farben = {
  bg: token("bg"),
  surface: token("surface"),
  "surface-muted": token("surface-muted"),
  ink: token("ink"),
  "ink-muted": token("ink-muted"),
  accent: token("accent"),
  "accent-light": token("accent-light"),
  counter: token("counter"),
  "counter-light": token("counter-light"),
  signal: token("signal"),
} as unknown as Record<string, string>;

const config: Config = {
  darkMode: ["class", '[data-theme="dark"]'],
  content: [
    "./src/app/**/*.{ts,tsx}",
    "./src/components/**/*.{ts,tsx}",
    "./src/lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ...farben,
      },
      fontFamily: {
        display: "var(--font-display)",
        body: "var(--font-body)",
      },
      borderRadius: {
        card: "1.25rem",
        pill: "999px",
      },
      boxShadow: {
        // Weicher, richtungsgebundener Schatten (kein richtungsloser Slop-Schatten).
        card: "0 1px 2px oklch(23.49% 0.0447 259.61 / 0.04), 0 8px 24px oklch(23.49% 0.0447 259.61 / 0.06)",
        hero: "0 2px 4px oklch(23.49% 0.0447 259.61 / 0.10), 0 18px 40px oklch(23.49% 0.0447 259.61 / 0.18)",
      },
      transitionTimingFunction: {
        // ease-out fürs Eintretende, custom statt CSS-Default.
        out: "cubic-bezier(0.16, 1, 0.3, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
