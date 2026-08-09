import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Prüfungen gegen eine echte Postgres-Datenbank.
 *
 * Bewusst getrennt von der normalen Suite: Die läuft überall und in Sekunden,
 * diese braucht eine Datenbank. Zusammengelegt wäre entweder die schnelle
 * Suite nicht mehr schnell oder die Datenbank-Prüfungen würden stillschweigend
 * übersprungen — und dann prüfen sie irgendwann gar nichts mehr.
 *
 *   npm run test:db
 *
 * Voraussetzung: DATABASE_URL und ALLOWED_EMAILS zeigen auf eine Wegwerf-
 * Datenbank. Die Tests leeren Tabellen — niemals gegen Produktion laufen lassen.
 */
export default defineConfig({
  resolve: {
    alias: {
      // Beides gibt es nur im Next-Server; hier stünde sonst der Import im Weg.
      "server-only": path.resolve(__dirname, "db-tests/stubs/server-only.ts"),
      "next/cache": path.resolve(__dirname, "db-tests/stubs/next-cache.ts"),
      "@": path.resolve(__dirname, "src"),
    },
  },
  // Nacheinander: Die Prüfungen teilen sich eine Datenbank und leeren sie.
  test: { include: ["db-tests/**/*.test.ts"], fileParallelism: false },
});
