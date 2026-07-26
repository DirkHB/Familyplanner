"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { TabBar } from "@/components/app/TabBar";
import type { Person } from "@/lib/auth/allowlist";
import { addItemAction, toggleItemAction, deleteItemAction } from "./actions";

type Item = { id: string; text: string; checked: boolean; addedByPerson: Person | null };
type Group = { category: string; label: string; items: Item[] };

export function EinkaufClient({
  groups,
  partnerName,
  partnerPerson,
}: {
  groups: Group[];
  partnerName: string;
  partnerPerson: Person;
}) {
  const router = useRouter();
  const [, start] = useTransition();
  const [override, setOverride] = useState<Record<string, boolean>>({});
  const [text, setText] = useState("");

  const isChecked = (it: Item) => override[it.id] ?? it.checked;
  const all = groups.flatMap((g) => g.items);
  const open = all.filter((it) => !isChecked(it)).length;
  const allDone = all.length > 0 && open === 0;

  function toggle(it: Item) {
    setOverride((o) => ({ ...o, [it.id]: !isChecked(it) }));
    start(() => {
      toggleItemAction(it.id);
    });
  }
  function add(e: React.FormEvent) {
    e.preventDefault();
    const t = text.trim();
    if (!t) return;
    setText("");
    start(async () => {
      await addItemAction(t);
      router.refresh();
    });
  }
  function remove(it: Item) {
    start(async () => {
      await deleteItemAction(it.id);
      router.refresh();
    });
  }

  return (
    <div className="min-h-dvh bg-bg text-ink">
      <div className="mx-auto max-w-md px-5 pb-40 pt-8">
        <h1 className="font-display text-4xl">Einkaufsliste</h1>
        <p className="mt-2 flex items-center gap-2 text-ink-muted">
          <span className="flex -space-x-1.5">
            <Avatar person="dirk" size={22} />
            <Avatar person="constanze" size={22} />
          </span>
          Gemeinsam mit {partnerName} · {open} offen
        </p>

        {all.length === 0 ? (
          <div className="mt-8 rounded-card bg-surface p-6 text-center shadow-card">
            <p className="font-display text-xl">Noch nichts drauf</p>
            <p className="mt-2 text-ink-muted">Was fehlt zu Hause? Trag es unten ein.</p>
          </div>
        ) : (
          <div className="mt-6 rounded-card bg-surface p-4 shadow-card">
            {groups.map((g) => (
              <div key={g.category} className="mb-4 last:mb-0">
                <p className="eyebrow mb-1 text-accent">{g.label}</p>
                {g.items.map((it) => (
                  <ItemRow
                    key={it.id}
                    it={it}
                    checked={isChecked(it)}
                    onToggle={() => toggle(it)}
                    onRemove={() => remove(it)}
                    partnerPerson={partnerPerson}
                  />
                ))}
              </div>
            ))}
            <AnimatePresence>
              {allDone && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  className="mt-2 rounded-pill bg-accent-light px-4 py-2 text-center text-sm font-medium text-ink"
                >
                  Alles erledigt ✓
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>

      <form
        onSubmit={add}
        className="fixed inset-x-0 z-30 mx-auto max-w-md px-5"
        style={{ bottom: "calc(4.75rem + env(safe-area-inset-bottom))" }}
      >
        <div className="flex items-center gap-2 rounded-pill bg-surface p-1.5 pl-5 shadow-hero">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Was fehlt noch?"
            className="min-w-0 flex-1 bg-transparent py-2 outline-none placeholder:text-ink-muted/70"
          />
          <button
            type="submit"
            aria-label="Hinzufügen"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-accent text-surface"
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
      </form>

      <TabBar />
    </div>
  );
}

function ItemRow({
  it,
  checked,
  onToggle,
  onRemove,
  partnerPerson,
}: {
  it: Item;
  checked: boolean;
  onToggle: () => void;
  onRemove: () => void;
  partnerPerson: Person;
}) {
  return (
    <div className="flex items-center gap-3 border-b border-surface-muted/60 py-3 last:border-0">
      <button
        onClick={onToggle}
        aria-label={checked ? "Wieder öffnen" : "Abhaken"}
        className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-150 ${
          checked ? "border-accent bg-accent text-surface" : "border-ink-muted/40"
        }`}
      >
        {checked && (
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
            <path d="M5 13l4 4L19 7" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </button>
      <button onClick={onToggle} className={`flex-1 text-left ${checked ? "text-ink-muted line-through" : "font-medium"}`}>
        {it.text}
      </button>
      {it.addedByPerson && <Avatar person={it.addedByPerson} size={18} />}
      <button onClick={onRemove} aria-label="Entfernen" className="pl-1 text-ink-muted/50">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </button>
    </div>
  );
}
