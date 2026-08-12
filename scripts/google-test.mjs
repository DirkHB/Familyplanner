/**
 * Trägt der Google-Weg?
 *
 * Bevor wir die halbe Kalenderschicht umbauen, beantwortet dieses Skript die
 * vier Fragen, an denen der Weg scheitern kann — in dieser Reihenfolge, weil
 * jede die nächste erst sinnvoll macht:
 *
 *   1. Kommt der Service Account überhaupt an den Kalender? (Lesen)
 *   2. Darf er hineinschreiben? (Anlegen, Ändern, Löschen)
 *   3. Wie schnell steht ein neuer Termin im .ics-Feed?
 *   4. Trägt der Feed dieselbe UID, die uns Google beim Anlegen genannt hat?
 *
 * Frage 3 und 4 entscheiden über den Zuschnitt: Wir lesen heute über das
 * Abonnement und wollten nur das Schreiben über die API laufen lassen. Das
 * geht nur auf, wenn der Feed zügig nachzieht und der Termin sich
 * wiedererkennen lässt. Hängt der Feed Stunden hinterher, muss auch das Lesen
 * über die API gehen (events.list mit syncToken) — dann wird es größer.
 *
 * Ohne Abhängigkeiten: Der Zugangs-Token wird hier selbst signiert. Drei
 * Aufrufe rechtfertigen kein weiteres Paket im Image — wir hatten schon
 * einmal „no space left on device“ beim Ausrollen.
 *
 * Aufrufen:
 *   GOOGLE_SA_JSON=~/Downloads/schluessel.json \
 *   GOOGLE_CALENDAR_ID=deine@gmail.com \
 *   GOOGLE_ICS_URL='https://calendar.google.com/…/basic.ics' \
 *     node scripts/google-test.mjs
 *
 * GOOGLE_ICS_URL ist freiwillig — ohne die Adresse entfallen Frage 3 und 4.
 * Statt GOOGLE_SA_JSON gehen auch GOOGLE_SA_CLIENT_EMAIL und
 * GOOGLE_SA_PRIVATE_KEY einzeln.
 *
 * Das Skript räumt hinter sich auf: Der Testtermin wird am Ende gelöscht,
 * auch wenn unterwegs etwas schiefgeht.
 */

import { createSign } from "node:crypto";
import { readFileSync } from "node:fs";
import { homedir } from "node:os";

/*
 * Die beiden Adressen lassen sich überschreiben — nicht für den Betrieb,
 * sondern damit dieses Skript selbst gegen eine Attrappe geprüft werden kann.
 * Ein Diagnosewerkzeug, das nie gegen einen Fehlerfall gelaufen ist, ist
 * selbst ein Fehlerfall.
 */
const API = process.env.GOOGLE_API_BASE ?? "https://www.googleapis.com/calendar/v3";
const TOKEN_URL = process.env.GOOGLE_TOKEN_URL ?? "https://oauth2.googleapis.com/token";
const SCOPE = "https://www.googleapis.com/auth/calendar";
const TITEL = "Familienplaner-Test (darf weg)";

/* ------------------------------- Ausgabe ------------------------------- */

const gruen = (s) => `\x1b[32m${s}\x1b[0m`;
const rot = (s) => `\x1b[31m${s}\x1b[0m`;
const grau = (s) => `\x1b[90m${s}\x1b[0m`;

let schritt = 0;
const beginn = (text) => process.stdout.write(`${++schritt}. ${text} … `);
const gut = (text = "geht") => console.log(gruen(`✓ ${text}`));
const schlecht = (text) => console.log(rot(`✗ ${text}`));
const dazu = (text) => console.log(grau(`   ${text}`));

/* ------------------------------ Zugangsdaten ---------------------------- */

function zugangsdaten() {
  const pfad = process.env.GOOGLE_SA_JSON;
  if (pfad) {
    const aufgeloest = pfad.startsWith("~") ? pfad.replace(/^~/, homedir()) : pfad;
    const json = JSON.parse(readFileSync(aufgeloest, "utf8"));
    return { email: json.client_email, key: json.private_key };
  }
  return {
    email: process.env.GOOGLE_SA_CLIENT_EMAIL,
    // In Umgebungsvariablen steht der Schlüssel meist mit literalen \n drin.
    key: (process.env.GOOGLE_SA_PRIVATE_KEY ?? "").replace(/\\n/g, "\n"),
  };
}

const b64url = (buf) =>
  Buffer.from(buf).toString("base64").replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

/**
 * Ein Service Account meldet sich mit einem selbst signierten JWT an: Wir
 * behaupten, wer wir sind, und beweisen es mit dem privaten Schlüssel. Google
 * gibt dafür einen Token, der eine Stunde gilt. Kein Mensch klickt dabei auf
 * irgendetwas — das ist der ganze Grund, warum dieser Weg für uns in Frage
 * kommt.
 */
async function holeToken({ email, key }) {
  const jetzt = Math.floor(Date.now() / 1000);
  const kopf = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const daten = b64url(
    JSON.stringify({
      iss: email,
      scope: SCOPE,
      aud: TOKEN_URL,
      iat: jetzt,
      exp: jetzt + 3600,
    }),
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
  const json = await res.json();
  if (!res.ok) {
    throw new Error(
      `Anmeldung abgelehnt (${res.status}): ${json.error_description ?? json.error ?? "kein Grund genannt"}`,
    );
  }
  return json.access_token;
}

/* -------------------------------- Kalender ------------------------------ */

async function api(token, pfad, optionen = {}) {
  const res = await fetch(`${API}${pfad}`, {
    ...optionen,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...(optionen.headers ?? {}),
    },
  });
  if (res.status === 204) return null;
  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const grund = json?.error?.message ?? `HTTP ${res.status}`;
    const fehler = new Error(grund);
    fehler.status = res.status;
    throw fehler;
  }
  return json;
}

const kalenderPfad = (id) => `/calendars/${encodeURIComponent(id)}`;

/* ---------------------------------- Feed -------------------------------- */

/** Alle UIDs aus einem .ics-Feed, Faltung aufgelöst. */
function uidsAusFeed(text) {
  const zeilen = [];
  for (const roh of text.split(/\r?\n/)) {
    if ((roh.startsWith(" ") || roh.startsWith("\t")) && zeilen.length) {
      zeilen[zeilen.length - 1] += roh.slice(1);
    } else {
      zeilen.push(roh);
    }
  }
  return zeilen
    .filter((z) => /^UID[;:]/i.test(z))
    .map((z) => z.slice(z.indexOf(":") + 1).trim());
}

async function feedUids(url) {
  const res = await fetch(url.replace(/^webcal:\/\//i, "https://"), { redirect: "follow" });
  if (!res.ok) throw new Error(`Der Feed antwortete mit ${res.status}.`);
  const text = await res.text();
  if (!/BEGIN:VCALENDAR/i.test(text)) throw new Error("Darunter liegt kein Kalender.");
  return uidsAusFeed(text);
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms));

/* ---------------------------------- Lauf -------------------------------- */

const kalenderId = process.env.GOOGLE_CALENDAR_ID;
const feedUrl = process.env.GOOGLE_ICS_URL;
const { email, key } = zugangsdaten();

if (!email || !key) {
  console.error(
    rot("Es fehlen die Zugangsdaten.") +
      "\nEntweder GOOGLE_SA_JSON auf die heruntergeladene Schlüsseldatei zeigen lassen," +
      "\noder GOOGLE_SA_CLIENT_EMAIL und GOOGLE_SA_PRIVATE_KEY einzeln setzen.",
  );
  process.exit(1);
}
if (!kalenderId) {
  console.error(
    rot("GOOGLE_CALENDAR_ID fehlt.") +
      "\nDie steht in Google Kalender unter „Einstellungen und Freigabe“ ganz unten." +
      "\nBeim Hauptkalender ist es die eigene Adresse.",
  );
  process.exit(1);
}

console.log(`\nKalender: ${kalenderId}`);
console.log(`Service Account: ${email}\n`);

const ergebnis = {
  angemeldet: false,
  lesen: false,
  anlegen: false,
  aendern: false,
  loeschen: false,
  feed: null,
};
let token;
let terminId = null;

try {
  beginn("Anmelden");
  token = await holeToken({ email, key });
  ergebnis.angemeldet = true;
  gut();

  /* 1. Lesen ------------------------------------------------------------- */
  beginn("Kalender lesen");
  try {
    const von = new Date().toISOString();
    const liste = await api(
      token,
      `${kalenderPfad(kalenderId)}/events?singleEvents=true&maxResults=5&timeMin=${encodeURIComponent(von)}`,
    );
    ergebnis.lesen = true;
    const n = liste.items?.length ?? 0;
    gut(n === 1 ? "1 kommender Termin gesehen" : `${n} kommende Termine gesehen`);
  } catch (err) {
    schlecht(err.message);
    if (err.status === 404) {
      dazu("404 heißt hier fast immer: Die Freigabe ist nicht angekommen.");
      dazu("In Google Kalender → Einstellungen und Freigabe → „Für bestimmte");
      dazu(`Personen freigeben“ muss ${email} stehen.`);
      dazu("Der geteilte Kalender taucht NICHT in der Kalenderliste des Service");
      dazu("Accounts auf — das ist normal, wir gehen direkt an die Kennung.");
    }
    throw err;
  }

  /* 2. Anlegen ----------------------------------------------------------- */
  beginn("Termin anlegen");
  // Drei Wochen voraus: weit genug weg, um in keiner Wochenansicht zu stören,
  // nah genug, um in jedem Feed-Fenster zu liegen.
  const start = new Date(Date.now() + 21 * 24 * 3600 * 1000);
  start.setUTCHours(9, 0, 0, 0);
  const ende = new Date(start.getTime() + 3600 * 1000);

  try {
    const angelegt = await api(token, `${kalenderPfad(kalenderId)}/events?sendUpdates=none`, {
      method: "POST",
      body: JSON.stringify({
        summary: TITEL,
        description: "Angelegt von scripts/google-test.mjs. Wird gleich wieder gelöscht.",
        start: { dateTime: start.toISOString(), timeZone: "Europe/Berlin" },
        end: { dateTime: ende.toISOString(), timeZone: "Europe/Berlin" },
        extendedProperties: { private: { familienplaner: "test" } },
      }),
    });
    terminId = angelegt.id;
    ergebnis.anlegen = true;
    ergebnis.uid = angelegt.iCalUID;
    gut(`am ${start.toLocaleDateString("de-DE")}`);
    dazu(`id:       ${angelegt.id}`);
    dazu(`iCalUID:  ${angelegt.iCalUID}`);
    dazu("Die iCalUID ist der Schlüssel: Unter ihr taucht der Termin später im");
    dazu("Feed auf, und nur daran erkennen wir unseren eigenen wieder.");
  } catch (err) {
    schlecht(err.message);
    if (err.status === 403) {
      dazu("403 heißt: lesen ja, schreiben nein. Die Freigabe steht auf „Alle");
      dazu("Termindetails sehen“ — sie muss auf „Änderungen an Terminen");
      dazu("vornehmen“ stehen.");
    }
    throw err;
  }

  /* 3. Ändern ------------------------------------------------------------ */
  beginn("Termin ändern");
  await api(token, `${kalenderPfad(kalenderId)}/events/${encodeURIComponent(terminId)}`, {
    method: "PATCH",
    body: JSON.stringify({ summary: `${TITEL} — geändert` }),
  });
  ergebnis.aendern = true;
  gut();

  /* 4. Feed -------------------------------------------------------------- */
  if (feedUrl) {
    beginn("Warten, bis der Feed nachzieht");
    // Drei Minuten sind geraten. Zieht Google später nach, sagt uns das ein
    // zweiter Lauf mit größerer Geduld — deshalb steht sie nicht fest.
    const GEDULD_MS = Number(process.env.GOOGLE_FEED_GEDULD_S ?? 180) * 1000;
    const TAKT_MS = Number(process.env.GOOGLE_FEED_TAKT_S ?? 15) * 1000;
    const angefangen = Date.now();
    let gefunden = false;

    while (Date.now() - angefangen < GEDULD_MS) {
      try {
        const uids = await feedUids(feedUrl);
        if (uids.includes(ergebnis.uid)) {
          gefunden = true;
          break;
        }
      } catch (err) {
        console.log();
        schlecht(`Feed nicht lesbar: ${err.message}`);
        break;
      }
      process.stdout.write(".");
      await warte(TAKT_MS);
    }

    const dauer = Math.round((Date.now() - angefangen) / 1000);
    if (gefunden) {
      ergebnis.feed = dauer;
      console.log();
      gut(`nach ${dauer} Sekunden im Feed, unter derselben iCalUID`);
    } else {
      ergebnis.feed = false;
      console.log();
      schlecht(`nach ${dauer} Sekunden noch nicht im Feed`);
      dazu("Das ist die wichtigste Erkenntnis des Tests — siehe unten.");
    }
  } else {
    console.log(grau("(Feed übersprungen — GOOGLE_ICS_URL war nicht gesetzt.)"));
  }
} catch (err) {
  console.log();
  console.error(rot(`Abgebrochen: ${err.message}`));
} finally {
  /* 5. Aufräumen --------------------------------------------------------- */
  if (terminId && token) {
    beginn("Testtermin löschen");
    try {
      await api(token, `${kalenderPfad(kalenderId)}/events/${encodeURIComponent(terminId)}`, {
        method: "DELETE",
      });
      ergebnis.loeschen = true;
      gut("weg");
    } catch (err) {
      schlecht(err.message);
      dazu(`Bitte „${TITEL}“ von Hand aus dem Kalender werfen.`);
    }
  }
}

/* ------------------------------- Was nun? -------------------------------- */

console.log("\n" + "─".repeat(64));

const schreibenGeht = ergebnis.anlegen && ergebnis.aendern && ergebnis.loeschen;

if (!ergebnis.angemeldet) {
  console.log(rot("Schon die Anmeldung ging schief — am Kalender lag es noch nicht."));
  console.log("Zu prüfen: Ist die Google Calendar API im Projekt eingeschaltet");
  console.log("(APIs & Services → Library), und stammen E-Mail und Schlüssel aus");
  console.log("derselben heruntergeladenen Datei?");
} else if (!ergebnis.lesen) {
  console.log(rot("Angemeldet, aber der Kalender bleibt zu."));
  console.log("Die Freigabe ist der Knackpunkt — ohne sie hilft der Rest nicht.");
} else if (!schreibenGeht) {
  console.log(rot("Lesen geht, Schreiben nicht."));
  console.log("Meist die Berechtigung: Sie muss auf „Änderungen an Terminen");
  console.log("vornehmen“ stehen, nicht auf „Alle Termindetails sehen“.");
} else if (ergebnis.feed === null) {
  console.log(gruen("Lesen und Schreiben gehen — der Weg trägt."));
  console.log("Offen bleibt, wie schnell der .ics-Feed nachzieht. Lauf das");
  console.log("Skript noch einmal mit GOOGLE_ICS_URL, dann wissen wir auch das.");
} else if (ergebnis.feed === false) {
  console.log(gruen("Schreiben geht.") + " Aber der Feed zieht zu langsam nach.");
  console.log("Damit fällt der günstige Zuschnitt weg (schreiben über die API,");
  console.log("lesen über das Abonnement): Ein selbst angelegter Termin wäre in");
  console.log("der App minutenlang unsichtbar. Dann muss auch das Lesen über die");
  console.log("API laufen — events.list mit syncToken. Mehr Arbeit, aber machbar.");
} else {
  console.log(gruen("Alle vier Schritte gehen.") + ` Der Feed zog nach ${ergebnis.feed} Sekunden nach.`);
  console.log("Damit trägt der geplante Zuschnitt: schreiben über die API, lesen");
  console.log("weiter über das Abonnement, wiedererkannt an der iCalUID.");
}

console.log("─".repeat(64) + "\n");

// Damit man das Ergebnis auch sieht, ohne den Text zu lesen — und damit ein
// Fehlschlag in einer Kette nicht als Erfolg durchgeht.
process.exit(ergebnis.lesen && schreibenGeht ? 0 : 1);
