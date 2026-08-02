"use server";

import { signOut } from "@/auth";

/** Abmelden — bewusst als Server-Aktion, damit der Knopf ein simples Formular bleibt. */
export async function abmeldenAction() {
  await signOut({ redirectTo: "/" });
}
