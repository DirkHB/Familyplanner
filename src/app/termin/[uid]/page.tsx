import { notFound } from "next/navigation";
import { EventDetail } from "@/components/event/EventDetail";
import { getEventView } from "@/lib/calendar/repository";
import { buildDetailVM } from "@/lib/calendar/view-model";

export const dynamic = "force-dynamic";

export default async function TerminPage({
  params,
}: {
  params: Promise<{ uid: string }>;
}) {
  const { uid } = await params;
  const view = await getEventView(decodeURIComponent(uid));
  if (!view) notFound();
  return <EventDetail vm={buildDetailVM(view)} />;
}
