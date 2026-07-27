import { notFound } from "next/navigation";
import { EventDetail } from "@/components/event/EventDetail";
import { getEventView } from "@/lib/calendar/repository";
import { buildDetailVM } from "@/lib/calendar/view-model";
import { getEventItems, getLinkableItems } from "@/lib/shopping/repository";

export const dynamic = "force-dynamic";

export default async function TerminPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const decoded = decodeURIComponent(uid);
  const view = await getEventView(decoded);
  if (!view) notFound();

  const [linked, linkable] = await Promise.all([getEventItems(decoded), getLinkableItems()]);
  const shopping = {
    linked: linked.map((it) => ({ id: it.id, text: it.text, checked: it.checked })),
    linkable,
  };

  return <EventDetail vm={buildDetailVM(view)} shopping={shopping} />;
}
