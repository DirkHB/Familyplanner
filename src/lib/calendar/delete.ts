import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { gehoertZumHaushalt } from "@/lib/haushalt/singletons";
import { removeCareBlocksForEvent } from "@/lib/care/block-sync";

/** App→iCloud: Termin (bzw. ganze Serie) löschen und lokal aufräumen. */

export type DeleteEventResult = { deleted: boolean; reason?: string };

export async function deleteEvent(userId: string, uid: string): Promise<DeleteEventResult> {
  const master = await prisma.event.findFirst({
    where: { uid },
    include: { calendar: { include: { account: true } } },
  });
  if (!master) return { deleted: false, reason: "Termin nicht gefunden." };

  const account = master.calendar.account;
  /**
   * Gelöscht wird immer über das Konto, dem der Kalender gehört — die
   * Zugangsdaten müssen zum Kalender passen. Die Erlaubnis richtet sich
   * dagegen nach dem Haushalt: Ein gemeinsamer Kalender gehört beiden, auch
   * wenn nur einer von ihnen ein iCloud-Konto verbunden hat.
   */
  if (!(await gehoertZumHaushalt(account.id))) {
    return { deleted: false, reason: "Dieser Termin gehört nicht zu eurem Kalender." };
  }

  const password = decryptSecret(account.credentialsEncrypted);
  const client = await createICloudClient({ username: account.username ?? "", password });

  try {
    await client.deleteEvent(master.href, master.etag ?? "");
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    // 404 = in iCloud schon weg — dann lokal trotzdem aufräumen.
    if (!/404/.test(msg)) return { deleted: false, reason: "Löschen in iCloud fehlgeschlagen." };
  }

  // Erst die Betreuungsblöcke, die zu diesem Termin gehören — die stehen als
  // eigene Einträge in iCloud und verschwinden nicht mit dem Anlass. Muss vor
  // dem lokalen Aufräumen passieren, sonst fehlen die Daten, um sie zu finden.
  await removeCareBlocksForEvent(uid);

  // Lokal spiegeln: Event(-Serie), Zusatzdaten, Betreuung. Aufgaben bleiben bewusst.
  await prisma.event.deleteMany({ where: { uid } });
  await prisma.eventDetail.deleteMany({ where: { eventUid: uid } });
  await prisma.careAssignment.deleteMany({ where: { eventUid: uid } });
  await prisma.activityLog.create({
    data: { entityType: "event", entityId: uid, action: "deleted", actor: userId, detail: { title: master.title } },
  });

  return { deleted: true };
}
