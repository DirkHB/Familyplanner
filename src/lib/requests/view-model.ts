import { notnameAusEmail } from "@/lib/auth/allowlist";
import { PLATZ_A, type Platz } from "@/lib/haushalt/platz";
import { isOverdue } from "./nudge";

export type RequestType = "yes_no" | "choice" | "free_text" | "date";

export type RequestVM = {
  id: string;
  question: string;
  type: RequestType;
  options: string[];
  fromName: string;
  fromPerson: Platz;
  ageLabel: string;
  overdue: boolean;
  /** Wann der Termin ist, um den es geht („morgen, 16:00") — sonst null. */
  whenLabel: string | null;
};

/** Freundliche relative Zeit auf Deutsch. */
export function relativeTime(from: Date, now: Date = new Date()): string {
  const s = Math.max(0, Math.floor((now.getTime() - from.getTime()) / 1000));
  if (s < 60) return "gerade eben";
  const m = Math.floor(s / 60);
  if (m < 60) return `vor ${m} Min.`;
  const h = Math.floor(m / 60);
  if (h < 24) return `vor ${h} Std.`;
  const d = Math.floor(h / 24);
  return d === 1 ? "vor 1 Tag" : `vor ${d} Tagen`;
}

type RequestRow = {
  id: string;
  question: string;
  type: string;
  options: unknown;
  status: string;
  createdAt: Date;
  fromUser: { email: string; name: string | null; slot: string | null };
};

export function buildRequestVM(
  req: RequestRow,
  now: Date = new Date(),
  whenLabel: string | null = null,
): RequestVM {
  const options = Array.isArray(req.options) ? (req.options as string[]) : [];
  return {
    whenLabel,
    id: req.id,
    question: req.question,
    type: (req.type as RequestType) ?? "yes_no",
    options,
    fromName: req.fromUser.name ?? notnameAusEmail(req.fromUser.email),
    // Der Platz steht in der Zeile, die ohnehin geladen wurde — die Adresse
    // sagt darüber nichts mehr.
    fromPerson: (req.fromUser.slot as Platz | null) ?? PLATZ_A,
    ageLabel: relativeTime(req.createdAt, now),
    overdue: isOverdue(req.createdAt, req.status, now),
  };
}
