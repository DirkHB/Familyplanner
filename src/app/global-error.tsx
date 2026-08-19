"use client";

/**
 * Der Notfall unter dem Notfall.
 *
 * Diese Datei greift, wenn schon das Grundgerüst scheitert — dann gibt es
 * keine Hülle, keine Schriften, kein Menü, und deshalb steht hier alles für
 * sich allein, samt eigenem html- und body-Element. Sie soll nie zu sehen
 * sein; wenn doch, soll wenigstens ein deutscher Satz dastehen statt eines
 * englischen Fehlerprotokolls.
 */
export default function GrundFehler({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100dvh",
          display: "grid",
          placeItems: "center",
          background: "#f2ede4",
          color: "#1b2431",
          font: "16px/1.5 -apple-system, system-ui, sans-serif",
          padding: "2rem",
          textAlign: "center",
        }}
      >
        <div style={{ maxWidth: "22rem" }}>
          <p style={{ fontWeight: 600 }}>Die App konnte nicht starten.</p>
          <p>Versuch es gleich noch einmal — an euren Daten liegt es nicht.</p>
          <button
            onClick={reset}
            style={{
              marginTop: "1rem",
              border: 0,
              borderRadius: "999px",
              padding: "0.75rem 1.25rem",
              background: "#1b2431",
              color: "#fbf9f5",
              font: "inherit",
              fontWeight: 500,
            }}
          >
            Nochmal versuchen
          </button>
          {error.digest && (
            <p style={{ marginTop: "1.5rem", fontSize: "0.75rem", opacity: 0.7 }}>
              Kennung: {error.digest}
            </p>
          )}
        </div>
      </body>
    </html>
  );
}
