import { createSign } from "node:crypto";

/**
 * Woher das Zugangstoken für Google kommt.
 *
 * Das ist mit Absicht eine eigene, kleine Stelle: Sie ist der einzige
 * Unterschied zwischen den beiden Wegen, auf denen die App an einen
 * Google-Kalender kommt.
 *
 * **Heute: ein Service Account.** Ein technischer Google-Account, dessen
 * Adresse man seinem Kalender freigibt wie einem Menschen. Niemand klickt auf
 * einem Zustimmungsbildschirm, dafür trägt jede Person acht Schritte in
 * Googles Oberfläche nach. Umständlich für sie, sofort verfügbar für uns.
 *
 * **Später: OAuth.** Drei Klicks statt acht Schritte, und jede Person erteilt
 * nur ihren eigenen Zugang statt einer geteilten Roboter-Adresse Schreibrecht
 * auf ihren ganzen Kalender. Simpler und sicherer zugleich — es fehlt bloß
 * Googles Prüfung der App, und die ist Papierkram, kein Programmieren.
 *
 * Damit dieser Wechsel später kein Umbau wird, fragt der Rest der App nie
 * „welcher Weg?", sondern nur `zugangFuer(konto)`. Wenn OAuth kommt, tritt es
 * hier daneben — und nirgends sonst.
 */

/** Was ein Kalenderkonto hergeben muss, damit wir einen Zugang bauen können. */
export type KontoZugang = {
  provider: string;
  /** Für OAuth später: das verschlüsselte Geheimnis des Kontos. Heute ungenutzt. */
  credentialsEncrypted?: string;
};

const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";

/**
 * Ein Token gilt eine Stunde. Es für jeden Aufruf neu zu holen wäre eine
 * Anfrage mehr pro Termin — und bei einem Abgleich über mehrere Haushalte
 * summiert sich das. Wir behalten es, bis es fast abgelaufen ist.
 */
let gemerkt: { token: string; bis: number } | null = null;

/** Nur für Tests: den gemerkten Zugang vergessen. */
export function vergissZugang(): void {
  gemerkt = null;
}

const b64url = (buf: Parameters<typeof Buffer.from>[0]) =>
  Buffer.from(buf as never)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");

export class GoogleZugangError extends Error {
  constructor(grund: string) {
    super(`Google verweigert den Zugang: ${grund}`);
    this.name = "GoogleZugangError";
  }
}

/**
 * Die Zugangsdaten des Service Accounts.
 *
 * Sie stehen in der Umgebung, nie im Code — lokal in `.env`, in Produktion in
 * den Sliplane-Variablen. In Umgebungsvariablen überlebt ein privater
 * Schlüssel seine Zeilenumbrüche selten; deshalb werden literale `\n` wieder
 * zu echten gemacht.
 */
function dienstkonto(): { email: string; key: string } {
  const email = process.env.GOOGLE_SA_CLIENT_EMAIL ?? "";
  const key = (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
  if (!email || !key) {
    throw new GoogleZugangError(
      "Es fehlen GOOGLE_SA_CLIENT_EMAIL und GOOGLE_SA_PRIVATE_KEY in der Umgebung.",
    );
  }
  return { email, key };
}

/**
 * Ein Service Account meldet sich mit einem selbst signierten JWT an: Wir
 * behaupten, wer wir sind, und beweisen es mit dem privaten Schlüssel. Ein
 * Mensch klickt dabei nichts — das ist der ganze Grund, warum dieser Weg ohne
 * Googles App-Prüfung auskommt.
 */
async function tokenVomDienstkonto(): Promise<{ token: string; giltSekunden: number }> {
  const { email, key } = dienstkonto();
  const jetzt = Math.floor(Date.now() / 1000);

  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const daten = b64url(
    JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: jetzt, exp: jetzt + 3600 }),
  );
  const signatur = b64url(createSign("RSA-SHA256").update(`${kopf}.${daten}`).sign(key));

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${kopf}.${daten}.${signatur}`,
    }),
  });

  const json = (await res.json().catch(() => ({}))) as {
    access_token?: string;
    expires_in?: number;
    error?: string;
    error_description?: string;
  };

  if (!res.ok || !json.access_token) {
    throw new GoogleZugangError(
      json.error_description ?? json.error ?? `Antwort ${res.status} ohne Token`,
    );
  }
  return { token: json.access_token, giltSekunden: json.expires_in ?? 3600 };
}

/**
 * Der Zugang für ein Kalenderkonto.
 *
 * Der Parameter wird heute nicht gelesen — ein Service Account ist für alle
 * derselbe. Er steht trotzdem da, weil er es bei OAuth nicht mehr ist: Dann
 * hängt das Token an genau einer Person, und diese Signatur muss sich dafür
 * nicht ändern.
 */
export async function zugangFuer(_konto: KontoZugang): Promise<string> {
  // Eine Minute Sicherheitsabstand: Ein Token, das zwischen Prüfung und
  // Aufruf abläuft, erzeugt einen Fehler, den niemand nachvollziehen kann.
  if (gemerkt && gemerkt.bis > Date.now() + 60_000) return gemerkt.token;

  const { token, giltSekunden } = await tokenVomDienstkonto();
  gemerkt = { token, bis: Date.now() + giltSekunden * 1000 };
  return token;
}

/** Ist der Google-Weg überhaupt eingerichtet? Für die Oberfläche. */
export function googleEingerichtet(): boolean {
  return Boolean(process.env.GOOGLE_SA_CLIENT_EMAIL && process.env.GOOGLE_SA_PRIVATE_KEY);
}

/** Die Adresse, die eine Person ihrem Kalender freigeben muss. */
export function dienstkontoAdresse(): string | null {
  return process.env.GOOGLE_SA_CLIENT_EMAIL || null;
}
