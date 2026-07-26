import { auth } from "@/auth";
import { listRequests } from "@/lib/requests/repository";
import { buildRequestVM, relativeTime } from "@/lib/requests/view-model";
import { displayNameForEmail } from "@/lib/auth/allowlist";
import { RequestsClient, type HistoryItem } from "./RequestsClient";

export const dynamic = "force-dynamic";

export default async function AnfragenPage() {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return <RequestsClient incoming={[]} history={[]} />;

  const now = new Date();
  const all = await listRequests(userId);

  const incoming = all
    .filter((r) => r.toUserId === userId && r.status === "open")
    .map((r) => buildRequestVM(r, now));

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
        otherName: other.name ?? displayNameForEmail(other.email),
        ageLabel: relativeTime(r.createdAt, now),
      };
    });

  return <RequestsClient incoming={incoming} history={history} />;
}
