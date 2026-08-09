// Es gibt keine Sitzung in den Datenbank-Prüfungen. Der Haushalt kommt hier
// immer aus mitHaushalt(); wer ihn vergisst, soll die echte Fehlermeldung
// sehen und nicht daran scheitern, dass next-auth kein Next findet.
export async function auth() {
  return null;
}
