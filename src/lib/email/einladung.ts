/**
 * Die Einladung an die zweite Person.
 *
 * Sie erklärt in drei Zeilen, was die App ist und warum sie eine Mail von
 * jemandem bekommt, den sie kennt. Kein Werbeton: Der Absender ist der
 * Partner, nicht ein Produkt.
 */
export function einladungEmail(input: {
  an: string;
  vonName: string;
  kind: string;
  url: string;
}) {
  const { vonName, kind, url } = input;
  const subject = `${vonName} hat dich zum Familienplaner eingeladen`;
  const text = `Hallo,

${vonName} nutzt jetzt einen gemeinsamen Familienplaner — für den Kalender, die Betreuung für ${kind}, Aufgaben und den Einkauf.

Hier kommst du rein — der Link funktioniert einmal und nur mit dieser Adresse:
${url}

Ein Passwort brauchst du nicht. Der Link gilt zwei Wochen.`;

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#F5EFE6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111E33;">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4B5A73;">Plan · planyourweek.app</div>
    <h1 style="font-size:26px;margin:12px 0 8px;font-weight:600;">${vonName} hat dich eingeladen</h1>
    <p style="font-size:16px;line-height:1.5;color:#4B5A73;margin:0 0 24px;">
      Ein gemeinsamer Planer für euren Kalender, die Betreuung für ${kind}, Aufgaben und den Einkauf.
      Nimm die Einladung an, dann seht ihr beide dasselbe.
    </p>
    <a href="${url}" style="display:inline-block;background:#12A594;color:#FBF7F1;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:16px;">
      Einladung annehmen
    </a>
    <p style="font-size:13px;color:#4B5A73;margin:28px 0 0;">
      Der Link funktioniert einmal und nur mit dieser Adresse. Er gilt zwei Wochen. Ein Passwort brauchst du nicht.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}

/**
 * Die Einladung an einen eigenen Haushalt.
 *
 * Anderer Anlass als die Einladung an die zweite Person: Hier bekommt jemand
 * nicht Zugang zu einer bestehenden Wohnung, sondern eine eigene. Das muss in
 * der Mail stehen — sonst rechnet die Person damit, unsere Termine zu sehen.
 */
export function neuerHaushaltEmail(input: { vonName: string; url: string }) {
  const { vonName, url } = input;
  const subject = `${vonName} hat dich zum Familienplaner eingeladen`;
  const text = `Hallo,

${vonName} nutzt einen gemeinsamen Familienplaner — Kalender, Betreuung, Aufgaben und Einkauf an einem Ort — und lädt dich dazu ein.

Du bekommst dabei euren eigenen Bereich: euer Kalender, eure Namen, eure Listen. Niemand sonst sieht davon etwas.

Hier geht es los — der Link funktioniert einmal und nur mit dieser Adresse:
${url}

Ein Passwort brauchst du nicht. Der Link gilt zwei Wochen.`;

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#F5EFE6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111E33;">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4B5A73;">Plan · planyourweek.app</div>
    <h1 style="font-size:26px;margin:12px 0 8px;font-weight:600;">${vonName} hat dich eingeladen</h1>
    <p style="font-size:16px;line-height:1.5;color:#4B5A73;margin:0 0 16px;">
      Ein gemeinsamer Planer für Kalender, Betreuung, Aufgaben und Einkauf.
    </p>
    <p style="font-size:16px;line-height:1.5;color:#4B5A73;margin:0 0 24px;">
      Ihr bekommt euren eigenen Bereich — euer Kalender, eure Namen, eure Listen. Niemand sonst sieht davon etwas.
    </p>
    <a href="${url}" style="display:inline-block;background:#12A594;color:#FBF7F1;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:16px;">
      Loslegen
    </a>
    <p style="font-size:13px;color:#4B5A73;margin:28px 0 0;">
      Der Link funktioniert einmal und nur mit dieser Adresse. Er gilt zwei Wochen. Ein Passwort brauchst du nicht.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}
