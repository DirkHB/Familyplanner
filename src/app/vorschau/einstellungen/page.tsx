import { SettingsClient } from "@/app/einstellungen/SettingsClient";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Einstellungen mit Beispieldaten — ohne Login/DB. */
export default function VorschauEinstellungen() {
  return (
    <SettingsClient
      account={{
        id: "s-acc",
        username: "dirk@icloud.com",
        calendars: [
          { id: "c1", name: "C&D", isSynced: true, lastSyncedLabel: "2. Aug., 16:40", lastSyncOk: true, lastError: null },
          { id: "c2", name: "Privat", isSynced: true, lastSyncedLabel: "2. Aug., 16:40", lastSyncOk: true, lastError: null },
          { id: "c3", name: "Reminders", isSynced: false, lastSyncedLabel: null, lastSyncOk: true, lastError: null },
        ],
      }}
      careBlocks={true}
      abgewinkt={["müllabfuhr", "schwimmkurs", "krabbelgruppe"]}
      diagnose={[
        {
          name: "C&D",
          isSynced: true,
          termine: 1901,
          mitOrganizer: 16,
          mitAttendee: 12,
          ersteller: [{ mail: "dirkbrederecke@gmail.com", anzahl: 16 }],
          titelMitName: 403,
        },
      ]}
      todoLists={[
        { id: "l1", name: "Diese Woche", anzahl: 17 },
        { id: "l2", name: "Constanze", anzahl: 7 },
        { id: "l3", name: "Pakete", anzahl: 10 },
      ]}
      stores={[
        { id: "s1", name: "Lidl", anzahl: 6 },
        { id: "s2", name: "Edeka", anzahl: 1 },
        { id: "s3", name: "Käfer", anzahl: 0 },
      ]}
    />
  );
}
