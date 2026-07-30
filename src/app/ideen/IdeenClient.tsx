"use client";

import { useActionState, useState, useTransition } from "react";
import { motion } from "motion/react";
import { TabBar } from "@/components/app/TabBar";
import type { IdeaVM } from "@/lib/ideas/repository";
import { createIdeaAction, voteAction, deleteIdeaAction, convertIdeaAction, updateIdeaAction } from "./actions";

const TYPE_LABEL: Record<string, string> = {
  urlaub: "Urlaub",
  ausflug: "Ausflug",
  restaurant: "Restaurant",
  geschenk: "Geschenk",
};

export function IdeenClient({ ideas }: { ideas: IdeaVM[] }) {
  const [showForm, setShowForm] = useState(false);
  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-28 pt-8">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="font-display text-4xl">Ideen &amp; Urlaub</h1>
            <p className="mt-2 text-ink-muted">Was ihr euch gemeinsam wünscht</p>
          </div>
          <button
            onClick={() => setShowForm((s) => !s)}
            className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent text-surface shadow-card"
            aria-label="Idee hinzufügen"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        {showForm && <CreateForm onDone={() => setShowForm(false)} />}

        {ideas.length === 0 && !showForm ? (
          <div className="mt-10 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Noch keine Ideen</p>
            <p className="mt-2 text-ink-muted">Sammelt Urlaube, Ausflüge, Restaurants, Geschenke.</p>
          </div>
        ) : (
          <div className="mt-6 flex flex-col gap-5">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} />
            ))}
          </div>
        )}
      </div>
      <TabBar />
    </div>
  );
}

function IdeaCard({ idea }: { idea: IdeaVM }) {
  const [pending, start] = useTransition();
  const [gone, setGone] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [date, setDate] = useState("");
  const [showDate, setShowDate] = useState(false);
  const [editing, setEditing] = useState(false);
  const [eTitle, setETitle] = useState(idea.title);
  const [eDesc, setEDesc] = useState(idea.description ?? "");
  const [ePeriod, setEPeriod] = useState(idea.targetPeriod ?? "");
  const [eImage, setEImage] = useState(idea.imageUrl ?? "");
  if (gone) return null;

  if (editing) {
    return (
      <div className="rounded-card bg-surface p-5 shadow-card">
        <p className="eyebrow mb-3 text-ink-muted">Idee bearbeiten</p>
        <div className="flex flex-col gap-3">
          <input value={eTitle} onChange={(e) => setETitle(e.target.value)}
            className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
          <input value={eDesc} onChange={(e) => setEDesc(e.target.value)} placeholder="Beschreibung"
            className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
          <input value={ePeriod} onChange={(e) => setEPeriod(e.target.value)} placeholder="Passt gut: (z. B. Ende Oktober)"
            className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
          <input value={eImage} onChange={(e) => setEImage(e.target.value)} placeholder="Bild-URL (optional)"
            className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
          <div className="grid grid-cols-2 gap-3">
            <button
              disabled={pending || !eTitle.trim()}
              onClick={() =>
                start(async () => {
                  await updateIdeaAction(idea.id, { title: eTitle, description: eDesc, targetPeriod: ePeriod, imageUrl: eImage });
                  setEditing(false);
                })
              }
              className="rounded-pill bg-accent px-4 py-3 font-medium text-surface disabled:opacity-60"
            >
              Speichern
            </button>
            <button onClick={() => setEditing(false)} className="rounded-pill bg-surface-muted px-4 py-3 font-medium text-ink">
              Abbrechen
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-card bg-surface shadow-card">
      {idea.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={idea.imageUrl} alt="" className="h-44 w-full object-cover" />
      ) : (
        <div
          className="h-28 w-full"
          style={{ background: "linear-gradient(120deg, var(--color-counter-light), var(--color-accent-light))" }}
        />
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="font-display text-xl">{idea.title}</p>
            <p className="text-sm text-ink-muted">
              {TYPE_LABEL[idea.type]}
              {idea.description ? ` · ${idea.description}` : ""}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-1">
            <button onClick={() => setEditing(true)} aria-label="Bearbeiten" className="p-1 text-ink-muted/60">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                <path d="M4 20h4L18.5 9.5a2 2 0 0 0-2.8-2.8L5 17.2 4 20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
              </svg>
            </button>
            <VoteHeart person="constanze" active={idea.votes.constanze} pending={pending} onClick={() => start(() => voteAction(idea.id))} />
            <VoteHeart person="dirk" active={idea.votes.dirk} pending={pending} onClick={() => start(() => voteAction(idea.id))} />
          </div>
        </div>

        {idea.targetPeriod && (
          <div className="mt-3 inline-flex items-center gap-1.5 rounded-pill bg-counter-light px-3 py-1 text-sm font-medium text-signal">
            <Sparkle /> Passt gut: {idea.targetPeriod}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2">
          {idea.status === "geplant" ? (
            <span className="text-sm text-accent">Als Termin geplant ✓</span>
          ) : showDate ? (
            <>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="rounded-pill border border-surface-muted bg-bg px-3 py-2 text-sm outline-none focus:border-accent"
              />
              <button
                disabled={pending || !date}
                onClick={() =>
                  start(async () => {
                    const r = await convertIdeaAction(idea.id, date, idea.title, idea.type);
                    setNote(r.created ? "Als Termin angelegt ✓" : r.reason ?? "Kalender nicht verbunden");
                  })
                }
                className="rounded-pill bg-accent px-4 py-2 text-sm font-medium text-surface disabled:opacity-60"
              >
                Anlegen
              </button>
            </>
          ) : (
            <button onClick={() => setShowDate(true)} className="rounded-pill bg-surface-muted px-4 py-2 text-sm font-medium text-ink">
              In Termin verwandeln
            </button>
          )}
          <button
            onClick={() => start(async () => { await deleteIdeaAction(idea.id); setGone(true); })}
            className="ml-auto text-sm text-ink-muted/60"
          >
            Entfernen
          </button>
        </div>
        {note && <p className="mt-2 text-sm text-ink-muted">{note}</p>}
      </div>
    </div>
  );
}

function VoteHeart({
  person,
  active,
  pending,
  onClick,
}: {
  person: "dirk" | "constanze";
  active: boolean;
  pending: boolean;
  onClick: () => void;
}) {
  const color = person === "constanze" ? "var(--color-counter)" : "var(--color-ink)";
  return (
    <motion.button
      whileTap={{ scale: 0.85 }}
      disabled={pending}
      onClick={onClick}
      aria-label={`${person} Stimme`}
      className="p-1"
    >
      <svg width="22" height="22" viewBox="0 0 24 24" fill={active ? color : "none"}>
        <path d="M12 20s-7-4.4-7-9.3A3.7 3.7 0 0 1 12 8a3.7 3.7 0 0 1 7 2.7C19 15.6 12 20 12 20Z" stroke={color} strokeWidth="1.7" strokeLinejoin="round" />
      </svg>
    </motion.button>
  );
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const [state, formAction, pending] = useActionState(createIdeaAction, { error: null });
  return (
    <form
      action={async (fd) => {
        await formAction(fd);
        onDone();
      }}
      className="mt-4 flex flex-col gap-3 rounded-card bg-surface p-5 shadow-card"
    >
      <input name="title" required placeholder="Titel (z. B. Wochenende Tegernsee)" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
      <select name="type" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent">
        <option value="ausflug">Ausflug</option>
        <option value="urlaub">Urlaub</option>
        <option value="restaurant">Restaurant</option>
        <option value="geschenk">Geschenk</option>
      </select>
      <input name="description" placeholder="Kurz beschreiben (optional)" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
      <input name="targetPeriod" placeholder="Passt gut: (z. B. Ende Oktober)" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
      <input name="imageUrl" placeholder="Bild-URL (optional)" className="rounded-card border border-surface-muted bg-bg px-4 py-3 outline-none focus:border-accent" />
      <button type="submit" disabled={pending} className="rounded-pill bg-accent px-5 py-3.5 font-medium text-surface disabled:opacity-60">
        {pending ? "Speichern …" : "Idee sichern"}
      </button>
      {state?.error && <p className="text-sm text-signal">{state.error}</p>}
    </form>
  );
}

function Sparkle() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M12 2l1.8 5.2L19 9l-5.2 1.8L12 16l-1.8-5.2L5 9l5.2-1.8L12 2Z" />
    </svg>
  );
}
