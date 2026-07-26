"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { Mark } from "@/components/ui/Mark";
import { requestMagicLink } from "./actions";

export default function AnmeldenPage() {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function onSubmit(formData: FormData) {
    setState("sending");
    const res = await requestMagicLink(formData);
    if (res?.error) {
      setState("error");
      setMessage(res.error);
    } else {
      setState("sent");
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center px-6">
      <div className="mb-8 flex flex-col items-start">
        <Mark size={52} />
        <p className="eyebrow mt-6 text-ink-muted">Willkommen zurück</p>
        <h1 className="mt-1 font-display text-4xl leading-tight">
          Euer Plan.
        </h1>
        <p className="mt-2 text-ink-muted">
          Gib deine E-Mail ein — wir schicken dir einen Login-Link. Kein Passwort.
        </p>
      </div>

      {state === "sent" ? (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="rounded-card bg-surface p-5 shadow-card"
        >
          <p className="font-display text-xl">Schau in dein Postfach 📬</p>
          <p className="mt-2 text-ink-muted">
            Wir haben dir einen Link geschickt. Tipp drauf, dann bist du drin — der Link gilt
            24&nbsp;Stunden.
          </p>
        </motion.div>
      ) : (
        <form action={onSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            inputMode="email"
            placeholder="deine@email.de"
            className="rounded-card border border-surface-muted bg-surface px-4 py-4 text-lg outline-none focus:border-accent"
          />
          <motion.button
            type="submit"
            disabled={state === "sending"}
            whileTap={{ scale: 0.97 }}
            transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
            className="rounded-pill bg-accent px-5 py-4 text-center text-lg font-medium text-surface disabled:opacity-60"
          >
            {state === "sending" ? "Wird gesendet …" : "Login-Link schicken"}
          </motion.button>
          {state === "error" && (
            <p className="text-sm text-signal">{message}</p>
          )}
        </form>
      )}
    </main>
  );
}
