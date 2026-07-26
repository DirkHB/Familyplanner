import type { Config } from "tailwindcss";

/**
 * Farben referenzieren CSS-Variablen (in globals.css als OKLCH definiert),
 * damit Light/Dark über einen Token-Wechsel laufen und nie doppelt gepflegt werden.
 */
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
        bg: "var(--color-bg)",
        surface: "var(--color-surface)",
        "surface-muted": "var(--color-surface-muted)",
        ink: "var(--color-ink)",
        "ink-muted": "var(--color-ink-muted)",
        accent: "var(--color-accent)",
        "accent-light": "var(--color-accent-light)",
        counter: "var(--color-counter)",
        "counter-light": "var(--color-counter-light)",
        signal: "var(--color-signal)",
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
