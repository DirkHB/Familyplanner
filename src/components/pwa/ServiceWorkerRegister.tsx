"use client";

import { useEffect } from "react";

/** Registriert den Service Worker (nur im Browser, nur in Produktion sinnvoll). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* Registrierung fehlgeschlagen — App funktioniert trotzdem, nur ohne Offline-Shell. */
      });
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);

  return null;
}
