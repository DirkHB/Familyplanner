import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { EventDetail } from "@/components/event/EventDetail";
import { getEventView } from "@/lib/calendar/repository";
import { haushaltProfil } from "@/lib/haushalt/profil";
import { buildDetailVM } from "@/lib/calendar/view-model";
import { getEventItems, getLinkableItems } from "@/lib/shopping/repository";
import { isCareBlockUid } from "@/lib/care/block";
import { anlassFuerBlock } from "@/lib/care/block-sync";

export const dynamic = "force-dynamic";

export default async function TerminPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const session = await auth();
  const { uid } = await params;
  const decoded = decodeURIComponent(uid);
  const view = await getEventView(decoded, new Date(), session?.user?.id ?? null);
  const kind = (await haushaltProfil()).kind;
  if (!view) notFound();

  // Bei einem Betreuungsblock zählt nur, wozu er gehört — Einkauf und
  // Vorbereitung zeigt die Ansicht dort ohnehin nicht.
  if (isCareBlockUid(decoded)) {
    const anlass = await anlassFuerBlock(decoded);
    return (
      <EventDetail
        kind={kind}
        vm={buildDetailVM({
          ...view,
          careBlockAnlass: anlass?.title ?? null,
          careBlockIch: !!session?.user?.id && anlass?.responsibleUserId === session.user.id,
        })}
        shopping={null}
      />
    );
  }

  const [linked, linkable] = await Promise.all([getEventItems(decoded), getLinkableItems()]);
  const shopping = {
    linked: linked.map((it) => ({ id: it.id, text: it.text, checked: it.checked })),
    linkable,
  };

  return <EventDetail vm={buildDetailVM(view)} shopping={shopping} kind={kind} />;
}
