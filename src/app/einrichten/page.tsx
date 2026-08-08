import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { einrichtungStatus } from "@/lib/haushalt/einrichtung";
import { EinrichtenClient } from "./EinrichtenClient";

export const dynamic = "force-dynamic";

/**
 * Der Einrichtungs-Assistent. Er läuft einmal — danach führt jeder Weg über
 * die Einstellungen, wo dieselben Dinge dauerhaft wohnen.
 */
export default async function EinrichtenPage() {
  const session = await auth();
  if (!session?.user?.email) redirect("/anmelden");

  const status = await einrichtungStatus(session.user.email);
  return <EinrichtenClient status={status} meineEmail={session.user.email} />;
}
