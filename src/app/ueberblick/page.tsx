import { redirect } from "next/navigation";

/**
 * Der Überblick ist in der Woche aufgegangen: Das Briefing steht dort im
 * Kopf, offene Fragen stehen an den Terminen und im Klärungs-Stapel, der
 * Monat hat einen eigenen Platz in der Leiste. Die Route bleibt als
 * Weiterleitung — alte Push-Mitteilungen und Lesezeichen führen hierher.
 */
export default function UeberblickRedirect() {
  redirect("/woche");
}
