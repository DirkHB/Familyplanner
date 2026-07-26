"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { TabBar } from "@/components/app/TabBar";
import { createRequestAction, answerRequestAction } from "./actions";
import type { RequestVM } from "@/lib/requests/view-model";

export type HistoryItem = {
  id: string;
  question: string;
  status: string;
  answer: string | null;
  direction: "in" | "out";
  otherName: string;
  ageLabel: string;
};

export function RequestsClient({
  incoming,
  history,
}: {
  incoming: RequestVM[];
  history: HistoryItem[];
}) {
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Link href="/woche" className="flex h-10 w-10 items-center justify-center rounded-full bg-surface shadow-card" aria-label="Zurück">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
              <path d="M15 5l-7 7 7 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </Link>
          <h1 className="font-display text-3xl">Anfragen</h1>
        </header>

        {incoming.length > 0 && (
          <section className="mb-6">
            <p className="eyebrow mb-2 text-ink-muted">Für dich</p>
            <div className="flex flex-col gap-3">
              {incoming.map((r) => (
                <IncomingCard key={r.id} req={r} />
              ))}
            </div>
          </section>
        )}

        <CreateForm />

        {history.length > 0 && (
          <section className="mt-8">
            <p className="eyebrow mb-2 text-ink-muted">Verlauf</p>
            <ul className="flex flex-col gap-2">
              {history.map((h) => (
                <li key={h.id} className="rounded-card bg-surface p-4 shadow-card">
                  <p className="font-medium">{h.question}</p>
                  <p className="mt-1 text-sm text-ink-muted">
                    {h.direction === "out" ? `an ${h.otherName}` : `von ${h.otherName}`} · {statusLabel(h)}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
      <TabBar />
    </div>
  );
}

function statusLabel(h: HistoryItem): string {
  if (h.status === "answered") return `beantwortet: ${h.answer ?? ""}`;
  if (h.status === "declined") return "abgelehnt";
  return "offen";
}

function IncomingCard({ req }: { req: RequestVM }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  if (gone) return null;

  function answer(v: string) {
    start(async () => {
      await answerRequestAction(req.id, v);
      setGone(true);
    });
  }

  return (
    <div className="rounded-card bg-ink p-5 text-surface shadow-card">
      <p className="font-display text-xl">{req.question}</p>
      <p className="mt-1 text-sm text-surface/70">{req.fromName} fragt · {req.ageLabel}</p>
      <div className="mt-4 grid grid-cols-2 gap-3">
        {req.type === "yes_no" ? (
          <>
            <button disabled={pending} onClick={() => answer("Ja")} className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60">Ja, mache ich</button>
            <button disabled={pending} onClick={() => answer("Geht nicht")} className="rounded-pill bg-white/10 px-4 py-3 font-medium disabled:opacity-60">Geht nicht</button>
          </>
        ) : req.type === "choice" ? (
          req.options.map((o) => (
            <button key={o} disabled={pending} onClick={() => answer(o)} className="rounded-pill bg-white/10 px-4 py-3 font-medium disabled:opacity-60">{o}</button>
          ))
        ) : (
          <FreeAnswer pending={pending} onSend={answer} />
        )}
      </div>
    </div>
  );
}

function FreeAnswer({ pending, onSend }: { pending: boolean; onSend: (v: string) => void }) {
  const [v, setV] = useState("");
  return (
    <div className="col-span-2 flex gap-2">
      <input value={v} onChange={(e) => setV(e.target.value)} placeholder="Deine Antwort …" className="min-w-0 flex-1 rounded-pill bg-white/10 px-4 py-3 text-surface outline-none placeholder:text-surface/50" />
      <button disabled={pending || !v.trim()} onClick={() => onSend(v.trim())} className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60">Senden</button>
    </div>
  );
}

function CreateForm() {
  const [state, formAction, pending] = useActionState(createRequestAction, { error: null });
  const [type, setType] = useState("yes_no");
  return (
    <section className="rounded-card bg-surface p-5 shadow-card">
      <h2 className="font-display text-lg">Neue Anfrage</h2>
      <form action={formAction} className="mt-3 flex flex-col gap-3">
        <input name="question" required placeholder="Was möchtest du fragen?" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
        <select name="type" value={type} onChange={(e) => setType(e.target.value)} className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent">
          <option value="yes_no">Ja / Nein</option>
          <option value="choice">Auswahl</option>
          <option value="free_text">Freitext</option>
          <option value="date">Terminvorschlag</option>
        </select>
        {type === "choice" && (
          <input name="options" placeholder="Optionen, mit Komma getrennt" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
        )}
        <button type="submit" disabled={pending} className="rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60">
          {pending ? "Senden …" : "An Constanze/Dirk senden"}
        </button>
        {state?.error && <p className="text-sm text-signal">{state.error}</p>}
      </form>
    </section>
  );
}
