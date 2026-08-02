import { SettingsClient } from "@/app/einstellungen/SettingsClient";

export const dynamic = "force-dynamic";

/** Öffentliche Vorschau der Einstellungen — ohne Login und ohne Datenbank. */
export default function VorschauEinstellungen() {
  return <SettingsClient account={null} careBlocks={true} />;
}
