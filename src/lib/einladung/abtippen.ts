/**
 * Was beim Löschen eines Haushalts abgetippt werden muss.
 *
 * Die Adresse des Ersten: Sie steht auf der Seite, ist eindeutig und lässt
 * sich nicht mit einem anderen Haushalt verwechseln. Ein
 * „Wirklich löschen?"-Fenster klickt man weg, ohne es gelesen zu haben; eine
 * Adresse tippt niemand versehentlich ab.
 *
 * Wohnt noch niemand dort, tut es die Kennung — dann ist ohnehin nichts zu
 * verlieren, aber die Handlung soll sich trotzdem gleich anfühlen.
 */
export function abtippen(haushalt: { id: string; users: { email: string }[] }): string {
  return haushalt.users[0]?.email ?? haushalt.id;
}
