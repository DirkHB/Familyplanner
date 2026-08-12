import "server-only";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto/envelope";
import { createICloudClient } from "./tsdav-client";
import { gehoertZumHaushalt } from "@/lib/haushalt/singletons";
import { kannSchreiben } from "./provider";
import { raeumeBetreuungWeg } from "@/lib/care/block-sync";

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

  /*
   * Ein abonnierter Kalender ist eine Einbahnstraße. Ohne diese Frage würde
   * hier ein iCloud-Zugang aus einer Feed-Adresse gebaut — das schlüge fehl,
   * aber mit einer Meldung, aus der niemand schlau wird.
   */
  if (!kannSchreiben(account.provider)) {
    return {
      deleted: false,
      reason: "Dieser Kalender ist abonniert — löschen geht nur dort, wo er geführt wird.",
    };
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

  // Lokal spiegeln: Event(-Serie) und Zusatzdaten. Aufgaben bleiben bewusst.
  await prisma.event.deleteMany({ where: { uid } });
  await prisma.eventDetail.deleteMany({ where: { eventUid: uid } });

  /*
   * Und dann die Betreuung — samt Block, der als eigener Eintrag in iCloud
   * steht und nicht mit dem Anlass verschwindet.
   *
   * Das lief bis eben andersherum: erst den Tag neu rechnen, dann die
   * Absprachen löschen. Beim Rechnen stand die Absprache also noch da, der
   * Block blieb — und war eine Zeile später verwaist. Genau so blieb „👶 …"
   * für einen gelöschten Tennistermin im Kalender stehen.
   */
  await raeumeBetreuungWeg([uid]);
  await prisma.activityLog.create({
    data: { entityType: "event", entityId: uid, action: "deleted", actor: userId, detail: { title: master.title } },
  });

  return { deleted: true };
}
