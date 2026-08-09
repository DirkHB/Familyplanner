import { auth } from "@/auth";
import { listRequests } from "@/lib/requests/repository";
import { buildRequestVM, relativeTime } from "@/lib/requests/view-model";
import { terminLabelsFuerAnfragen } from "@/lib/requests/termin";
import { notnameAusEmail } from "@/lib/auth/allowlist";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { RequestsClient, type HistoryItem } from "./RequestsClient";

export const dynamic = "force-dynamic";

export default async function AnfragenPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <RequestsClient incoming={[]} history={[]} />;

  const now = new Date();
  const all = await listRequests(userId);

  const offen = all.filter((r) => r.toUserId === userId && r.status === "open");
  const anfrageTermine = await terminLabelsFuerAnfragen(offen, now);
  const incoming = offen.map((r) => buildRequestVM(r, now, anfrageTermine.get(r.id) ?? null));

  const history: HistoryItem[] = all
    .filter((r) => !(r.toUserId === userId && r.status === "open"))
    .map((r) => {
      const outgoing = r.fromUserId === userId;
      const other = outgoing ? r.toUser : r.fromUser;
      return {
        id: r.id,
        question: r.question,
        status: r.status,
        answer: r.answer,
        direction: outgoing ? "out" : "in",
        otherName: other.name ?? notnameAusEmail(other.email),
        ageLabel: relativeTime(r.createdAt, now),
      };
    });

  // Der andere Erwachsene des Haushalts — auf dem Knopf stand bis eben
  // „An Constanze/Dirk senden", also beide Namen fest im Code.
  const profil = await haushaltProfil();
  const meine = (session.user?.email ?? "").toLowerCase();
  const partner = profil.erwachsene.find((e) => e.email !== meine);

  return (
    <RequestsClient incoming={incoming} history={history} partnerName={partner?.name ?? ""} />
  );
}
