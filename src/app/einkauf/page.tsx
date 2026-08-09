import { auth } from "@/auth";
import { getMainListGroups, getFrequentSuggestions } from "@/lib/shopping/repository";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { PLATZ_B } from "@/lib/haushalt/platz";
import { EinkaufClient } from "./EinkaufClient";

export const dynamic = "force-dynamic";

export default async function EinkaufPage() {
  const session = await auth();
  const myEmail = (session?.user?.email ?? "").toLowerCase();
  // Der andere Erwachsene des Haushalts. Hier stand eine feste Adresse als
  // Notnagel — die war in einem zweiten Haushalt schlicht falsch.
  const profil = await haushaltProfil();
  const partner = profil.erwachsene.find((e) => e.email !== myEmail) ?? profil.erwachsene[0];

  const [{ groups }, suggestions] = await Promise.all([
    getMainListGroups(),
    getFrequentSuggestions(),
  ]);

  return (
    <EinkaufClient
      groups={groups}
      suggestions={suggestions}
      partnerName={partner?.name ?? "Der andere"}
      partnerPerson={partner?.slot ?? PLATZ_B}
    />
  );
}
