import { auth } from "@/auth";
import { getMainListGroups } from "@/lib/shopping/repository";
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
    "c.brederecke@gmail.com";

  const { groups } = await getMainListGroups();

  return (
    <EinkaufClient
      groups={groups}
      partnerName={displayNameForEmail(partnerEmail)}
      partnerPerson={personForEmail(partnerEmail)}
    />
  );
}
