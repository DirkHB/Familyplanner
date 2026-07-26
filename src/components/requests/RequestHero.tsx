"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "motion/react";
import { Avatar } from "@/components/ui/Avatar";
import { answerRequestAction, declineRequestAction } from "@/app/anfragen/actions";
import type { RequestVM } from "@/lib/requests/view-model";

export function RequestHero({ requests }: { requests: RequestVM[] }) {
  const [index, setIndex] = useState(0);
  const [done, setDone] = useState(false);
  const [pending, start] = useTransition();

  if (requests.length === 0) return null;
  const req = requests[index];
  if (!req) return null;

  function next() {
    if (index + 1 < requests.length) {
      setDone(false);
      setIndex((i) => i + 1);
    } else {
      setDone(true);
    }
  }

  function answer(value: string) {
    start(async () => {
      await answerRequestAction(req.id, value);
      next();
    });
  }
  function decline() {
    start(async () => {
      await declineRequestAction(req.id);
      next();
    });
  }

  return (
    <div className="mt-6">
      <AnimatePresence mode="wait">
        {done ? (
          <motion.div
            key="done"
            initial={{ opacity: 0, scale: 0.97 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-card bg-accent-light px-5 py-4 text-center font-medium text-ink"
          >
            Alles beantwortet — danke! ✓
          </motion.div>
        ) : (
          <motion.div
            key={req.id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-card bg-ink p-5 text-surface shadow-hero"
          >
            <div className="flex items-center justify-between">
              <p className="eyebrow text-accent-light">Braucht deine Antwort</p>
              <span
                className="h-2 w-2 rounded-full"
                style={{ background: req.overdue ? "var(--color-signal)" : "var(--color-counter)" }}
              />
            </div>
            <p className="mt-3 font-display text-2xl leading-snug">{req.question}</p>
            <p className="mt-3 flex items-center gap-2 text-sm text-surface/70">
              <Avatar person={req.fromPerson} size={22} /> {req.fromName} fragt · {req.ageLabel}
              {requests.length > 1 && <span className="ml-auto">{index + 1} / {requests.length}</span>}
            </p>

            <div className="mt-5">
              {req.type === "yes_no" && (
                <div className="grid grid-cols-2 gap-3">
                  <HeroButton className="bg-accent text-surface" disabled={pending} onClick={() => answer("Ja")}>
                    Ja, mache ich
                  </HeroButton>
                  <HeroButton className="bg-white/10 text-surface" disabled={pending} onClick={() => answer("Geht nicht")}>
                    Geht nicht
                  </HeroButton>
                </div>
              )}
              {req.type === "choice" && (
                <div className="flex flex-col gap-2">
                  {req.options.map((opt) => (
                    <HeroButton key={opt} className="bg-white/10 text-surface" disabled={pending} onClick={() => answer(opt)}>
                      {opt}
                    </HeroButton>
                  ))}
                </div>
              )}
              {(req.type === "free_text" || req.type === "date") && (
                <div className="flex items-center gap-3">
                  <Link
                    href="/anfragen"
                    className="flex-1 rounded-pill bg-accent px-5 py-3.5 text-center font-medium text-surface"
                  >
                    Antworten
                  </Link>
                  <button onClick={decline} disabled={pending} className="text-sm text-surface/60">
                    später
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function HeroButton({
  children,
  className = "",
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <motion.button
      whileTap={{ scale: 0.97 }}
      transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
      onClick={onClick}
      disabled={disabled}
      className={`rounded-pill px-5 py-3.5 text-center font-medium disabled:opacity-60 ${className}`}
    >
      {children}
    </motion.button>
  );
}
