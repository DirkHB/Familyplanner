import { auth } from "@/auth";
import { getMainListGroups, getFrequentSuggestions } from "@/lib/shopping/repository";
import {
  parseAllowlist,
  displayNameForEmail,
  personForEmail,
} from "@/lib/auth/allowlist";
import { EinkaufClient } from "./EinkaufClient";

export const dynamic = "force-dynamic";

export default async function EinkaufPage() {
  const session = await auth();
  const myEmail = (session?.user?.email ?? "").toLowerCase();
  const partnerEmail =
    parseAllowlist(process.env.ALLOWED_EMAILS).find((e) => e !== myEmail) ??
    "constanzehiller@hotmail.com";

  const [{ groups }, suggestions] = await Promise.all([
    getMainListGroups(),
    getFrequentSuggestions(),
  ]);

  return (
    <EinkaufClient
      groups={groups}
      suggestions={suggestions}
      partnerName={displayNameForEmail(partnerEmail)}
      partnerPerson={personForEmail(partnerEmail)}
    />
  );
}
