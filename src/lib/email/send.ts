/**
 * E-Mail-Versand über Resend (REST). Kein SDK nötig — ein fetch reicht.
 * Wird für Magic-Link und (später) Eskalations-Mails genutzt.
 */

type SendArgs = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail({ to, subject, html, text }: SendArgs): Promise<void> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM ?? "Familienplaner <plan@planyourweek.app>";
  if (!apiKey) {
    throw new Error("RESEND_API_KEY fehlt — E-Mail kann nicht gesendet werden.");
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ from, to, subject, html, text }),
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`Resend-Fehler ${res.status}: ${detail}`);
  }
}
