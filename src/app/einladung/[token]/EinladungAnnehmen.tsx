"use client";

import { useState } from "react";
import { motion } from "motion/react";
import { einladungAnnehmenAction } from "./actions";

export function EinladungAnnehmen({ token }: { token: string }) {
  const [state, setState] = useState<"idle" | "sending" | "sent" | "error">("idle");
  const [message, setMessage] = useState("");

  async function annehmen() {
    setState("sending");
    const res = await einladungAnnehmenAction(token);
    if (res.ok) {
      setState("sent");
    } else {
      setState("error");
      setMessage(res.grund ?? "Das hat gerade nicht geklappt.");
    }
  }

  if (state === "sent") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-card bg-surface p-5 shadow-card"
      >
        <p className="font-display text-xl">Schau in dein Postfach 📬</p>
        <p className="mt-2 text-ink-muted">
          Wir haben dir einen Link geschickt. Tipp drauf, dann bist du drin.
        </p>
      </motion.div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <motion.button
        type="button"
        onClick={annehmen}
        disabled={state === "sending"}
        whileTap={{ scale: 0.97 }}
        transition={{ duration: 0.12, ease: [0.16, 1, 0.3, 1] }}
        className="rounded-pill bg-accent px-5 py-4 text-center text-lg font-medium text-surface disabled:opacity-60"
      >
        {state === "sending" ? "Wird gesendet …" : "Einladung annehmen"}
      </motion.button>
      {state === "error" && <p className="text-sm text-signal">{message}</p>}
    </div>
  );
}
