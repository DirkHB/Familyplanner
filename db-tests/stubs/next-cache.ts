// Ersatz für next/cache außerhalb einer Next-Anfrage: kein Zwischenspeicher,
// keine Tags — die Prüfung will die echte Datenbank sehen, nicht einen Cache.
export const unstable_cache = <T extends (...args: never[]) => unknown>(fn: T) => fn;
export const revalidateTag = () => {};
export const revalidatePath = () => {};
