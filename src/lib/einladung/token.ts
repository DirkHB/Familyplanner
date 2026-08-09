import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

/**
 * Der Einladungs-Token.
 *
 * In der Datenbank steht nur sein Abdruck, nie er selbst. Der Grund ist
 * derselbe wie bei Passwörtern: Wer die Tabelle einmal zu sehen bekommt —
 * ein Backup, ein Log, ein fehlgeleiteter Export — hätte sonst funktionierende
 * Einladungen in der Hand. Ein Abdruck ist nur ein Beleg dafür, dass jemand
 * den Token schon hatte.
 *
 * 32 Byte, weil das die Menge ist, bei der Raten aufhört, ein Angriff zu sein,
 * und Rechnen anfängt. Base64url, damit der Link ohne Prozentzeichen auskommt
 * und in einer Mail nicht umbricht.
 */

export function neuerToken(): string {
  return randomBytes(32).toString("base64url");
}

export function tokenAbdruck(token: string): string {
  return createHash("sha256").update(token.trim()).digest("hex");
}

/**
 * Zwei Abdrücke vergleichen, ohne beim ersten Unterschied aufzuhören.
 *
 * Ein gewöhnlicher Vergleich verrät über die Zeit, wie viele Zeichen gestimmt
 * haben. Hier gibt es dafür wenig zu holen — gesucht wird ohnehin über einen
 * Index —, aber die Regel ist billig genug, um sie einzuhalten, statt sich
 * jedes Mal neu zu überlegen, ob sie hier ausnahmsweise egal ist.
 */
export function abdruckGleich(a: string, b: string): boolean {
  const x = Buffer.from(a, "utf8");
  const y = Buffer.from(b, "utf8");
  if (x.length !== y.length) return false;
  return timingSafeEqual(x, y);
}

/** Wie lange eine Einladung gilt. Lang genug für einen Urlaub, kurz genug, um zu verfallen. */
export const EINLADUNG_TAGE = 14;

export function laeuftAb(von: Date = new Date()): Date {
  return new Date(von.getTime() + EINLADUNG_TAGE * 86_400_000);
}

/** Der Link, der in der Mail steht. */
export function einladungsLink(basis: string, token: string): string {
  return `${basis.replace(/\/+$/, "")}/einladung/${token}`;
}
