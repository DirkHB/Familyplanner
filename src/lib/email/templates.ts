import { displayNameForEmail } from "@/lib/auth/allowlist";

/** Warmer, knapper Ton. Farben aus dem Design-System, inline (E-Mail-Clients). */
export function magicLinkEmail(email: string, url: string) {
  const name = displayNameForEmail(email);
  const subject = "Dein Login für Plan";
  const text = `Hallo ${name},\n\ntipp auf diesen Link, um dich bei Plan anzumelden:\n${url}\n\nDer Link gilt 24 Stunden. Falls du das nicht warst, ignorier die Mail einfach.`;

  const html = `<!doctype html>
<html lang="de"><body style="margin:0;background:#F5EFE6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111E33;">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4B5A73;">Plan · planyourweek.app</div>
    <h1 style="font-size:26px;margin:12px 0 8px;font-weight:600;">Hallo ${name},</h1>
    <p style="font-size:16px;line-height:1.5;color:#4B5A73;margin:0 0 24px;">
      tipp auf den Button, um dich anzumelden. Der Link gilt 24&nbsp;Stunden.
    </p>
    <a href="${url}" style="display:inline-block;background:#12A594;color:#FBF7F1;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:16px;">
      Bei Plan anmelden
    </a>
    <p style="font-size:13px;color:#4B5A73;margin:28px 0 0;">
      Falls du das nicht warst, ignorier diese Mail einfach.
    </p>
  </div>
</body></html>`;

  return { subject, text, html };
}

/** Eskalations-Mail nach 3 Tagen. Ton: neutral, freundlich, nie vorwurfsvoll. */
export function nudgeEmail(email: string, count: number, url: string) {
  const name = displayNameForEmail(email);
  const subject = count === 1 ? "Eine Frage wartet noch auf dich" : `${count} Fragen warten noch`;
  const text = `Hallo ${name},\n\nkleine Erinnerung: ${
    count === 1 ? "eine Frage wartet" : `${count} Fragen warten`
  } noch auf deine Antwort. Ein Tap genügt:\n${url}\n\nKein Stress – wann es dir passt.`;

  const html = `<!doctype html><html lang="de"><body style="margin:0;background:#F5EFE6;font-family:-apple-system,Segoe UI,Roboto,sans-serif;color:#111E33;">
  <div style="max-width:440px;margin:0 auto;padding:40px 24px;">
    <div style="font-size:13px;letter-spacing:.14em;text-transform:uppercase;color:#4B5A73;">Plan</div>
    <h1 style="font-size:24px;margin:12px 0 8px;font-weight:600;">Kleine Erinnerung, ${name}</h1>
    <p style="font-size:16px;line-height:1.5;color:#4B5A73;margin:0 0 24px;">
      ${count === 1 ? "Eine Frage wartet" : `${count} Fragen warten`} noch auf dich. Kein Stress – wann es dir passt.
    </p>
    <a href="${url}" style="display:inline-block;background:#12A594;color:#FBF7F1;text-decoration:none;padding:14px 24px;border-radius:999px;font-weight:600;font-size:16px;">Jetzt antworten</a>
  </div></body></html>`;

  return { subject, text, html };
}
