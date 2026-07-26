import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto";

/**
 * Envelope-Verschlüsselung für die iCloud-Zugangsdaten (Abschnitt 8 des Briefings).
 *
 * - Master-Key (KEK) kommt aus `ENCRYPTION_KEY` (base64, 32 Byte) — nie im Code.
 * - Pro Datensatz wird ein zufälliger Data-Key (DEK) erzeugt, der die Daten mit
 *   AES-256-GCM verschlüsselt. Der DEK selbst wird mit dem KEK verschlüsselt.
 * - So lässt sich der KEK rotieren, ohne alle Daten neu zu verschlüsseln, und ein
 *   geleakter Ciphertext ohne KEK ist wertlos.
 *
 * Format (ein String, Felder base64, mit "." getrennt):
 *   v1.<iv_dek>.<enc_dek>.<tag_dek>.<iv_data>.<ciphertext>.<tag_data>
 */

const VERSION = "v1";
const IV_LEN = 12; // GCM-Standard
const KEY_LEN = 32; // AES-256

function getKek(): Buffer {
  const raw = process.env.ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "ENCRYPTION_KEY fehlt. 32-Byte-Key base64 setzen: `openssl rand -base64 32`.",
    );
  }
  const kek = Buffer.from(raw, "base64");
  if (kek.length !== KEY_LEN) {
    throw new Error(
      `ENCRYPTION_KEY muss 32 Byte (base64) sein, ist ${kek.length} Byte.`,
    );
  }
  return kek;
}

function b64(buf: Buffer): string {
  return buf.toString("base64");
}

function unb64(s: string): Buffer {
  return Buffer.from(s, "base64");
}

export function encryptSecret(plaintext: string, kek: Buffer = getKek()): string {
  // 1) Zufälliger DEK, verschlüsselt die Nutzdaten.
  const dek = randomBytes(KEY_LEN);
  const ivData = randomBytes(IV_LEN);
  const dataCipher = createCipheriv("aes-256-gcm", dek, ivData);
  const ciphertext = Buffer.concat([
    dataCipher.update(plaintext, "utf8"),
    dataCipher.final(),
  ]);
  const tagData = dataCipher.getAuthTag();

  // 2) DEK selbst mit dem KEK verschlüsseln.
  const ivDek = randomBytes(IV_LEN);
  const dekCipher = createCipheriv("aes-256-gcm", kek, ivDek);
  const encDek = Buffer.concat([dekCipher.update(dek), dekCipher.final()]);
  const tagDek = dekCipher.getAuthTag();

  return [
    VERSION,
    b64(ivDek),
    b64(encDek),
    b64(tagDek),
    b64(ivData),
    b64(ciphertext),
    b64(tagData),
  ].join(".");
}

export function decryptSecret(bundle: string, kek: Buffer = getKek()): string {
  const parts = bundle.split(".");
  if (parts.length !== 7 || parts[0] !== VERSION) {
    throw new Error("Ungültiges Verschlüsselungs-Format.");
  }
  const [, ivDek, encDek, tagDek, ivData, ciphertext, tagData] = parts;

  // 1) DEK mit dem KEK entschlüsseln.
  const dekDecipher = createDecipheriv("aes-256-gcm", kek, unb64(ivDek));
  dekDecipher.setAuthTag(unb64(tagDek));
  const dek = Buffer.concat([
    dekDecipher.update(unb64(encDek)),
    dekDecipher.final(),
  ]);

  // 2) Nutzdaten mit dem DEK entschlüsseln.
  const dataDecipher = createDecipheriv("aes-256-gcm", dek, unb64(ivData));
  dataDecipher.setAuthTag(unb64(tagData));
  const plaintext = Buffer.concat([
    dataDecipher.update(unb64(ciphertext)),
    dataDecipher.final(),
  ]);

  return plaintext.toString("utf8");
}
