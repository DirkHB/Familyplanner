"use client";

import { useEffect, useState } from "react";

/** Web Push aktivieren (nur installierte PWA auf iOS). Speichert die Subscription serverseitig. */

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

type State = "unsupported" | "default" | "granted" | "denied" | "nokey";

export function EnableNotifications() {
  const [state, setState] = useState<State>("default");
  const [busy, setBusy] = useState(false);
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) {
      setState("unsupported");
      return;
    }
    if (!publicKey) {
      setState("nokey");
      return;
    }
    setState(Notification.permission as State);
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setBusy(true);
    try {
      const perm = await Notification.requestPermission();
      setState(perm as State);
      if (perm !== "granted") return;
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as unknown as BufferSource,
      });
      await fetch("/api/push/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(sub),
      });
    } finally {
      setBusy(false);
    }
  }

  if (state === "unsupported") {
    return (
      <p className="text-sm text-ink-muted">
        Benachrichtigungen brauchen die installierte App (Home-Bildschirm).
      </p>
    );
  }
  if (state === "nokey") {
    return <p className="text-sm text-ink-muted">Push ist noch nicht konfiguriert (VAPID-Key fehlt).</p>;
  }
  if (state === "granted") {
    return <p className="text-sm text-accent">Benachrichtigungen sind an ✓</p>;
  }
  if (state === "denied") {
    return (
      <p className="text-sm text-ink-muted">
        Benachrichtigungen sind blockiert. In den iOS-Einstellungen für „Plan" erlauben.
      </p>
    );
  }
  return (
    <button
      onClick={enable}
      disabled={busy}
      className="rounded-pill bg-accent px-4 py-2.5 text-sm font-medium text-surface disabled:opacity-60"
    >
      {busy ? "Aktiviere …" : "Benachrichtigungen aktivieren"}
    </button>
  );
}
