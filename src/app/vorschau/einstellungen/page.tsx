import { SettingsClient } from "@/app/einstellungen/SettingsClient";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Einstellungen — ohne Login und ohne Datenbank. */
export default function VorschauEinstellungen() {
  return (
    <SettingsClient
      account={null}
      careBlocks={true}
      todoLists={[
        { id: "l1", name: "Haushalt", anzahl: 4 },
        { id: "l2", name: "Nicolas", anzahl: 2 },
        { id: "l3", name: "Papierkram", anzahl: 0 },
      ]}
      stores={[
        { id: "s1", name: "Lidl", anzahl: 6 },
        { id: "s2", name: "Edeka", anzahl: 1 },
        { id: "s3", name: "Käfer", anzahl: 0 },
      ]}
    />
  );
}
