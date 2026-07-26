"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "motion/react";

/**
 * Zeigt auf iPhone-Safari (nicht installiert) einen ruhigen Hinweis, wie man die App
 * auf den Home-Bildschirm legt. Auf iOS gibt es keinen automatischen Prompt.
 */
export function InstallHint() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const ua = window.navigator.userAgent;
    const isIOS = /iPad|iPhone|iPod/.test(ua);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      // @ts-expect-error — iOS-spezifisch
      window.navigator.standalone === true;
    const dismissed = localStorage.getItem("fp-install-hint") === "1";
    if (isIOS && !standalone && !dismissed) setShow(true);
  }, []);

  function dismiss() {
    localStorage.setItem("fp-install-hint", "1");
    setShow(false);
  }

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 20 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed inset-x-4 bottom-4 z-50 rounded-card bg-ink p-4 text-surface shadow-hero"
        >
          <div className="flex items-start gap-3">
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg">Als App aufs iPhone</p>
              <p className="mt-1 text-sm text-surface/75">
                Tippe unten auf <span className="font-medium">Teilen</span> und dann auf{" "}
                <span className="font-medium">„Zum Home-Bildschirm"</span>. Danach startet
                Plan wie eine echte App — mit Benachrichtigungen.
              </p>
            </div>
            <button
              onClick={dismiss}
              className="shrink-0 rounded-pill bg-white/10 px-3 py-1.5 text-sm"
              aria-label="Hinweis schließen"
            >
              Später
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
