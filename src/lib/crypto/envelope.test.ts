import { describe, it, expect } from "vitest";
import { randomBytes } from "node:crypto";
import { encryptSecret, decryptSecret } from "./envelope";

const KEK = randomBytes(32);

describe("envelope encryption", () => {
  it("round-trips ein iCloud-App-Passwort", () => {
    const secret = "abcd-efgh-ijkl-mnop";
    const bundle = encryptSecret(secret, KEK);
    expect(decryptSecret(bundle, KEK)).toBe(secret);
  });

  it("erzeugt bei gleichem Klartext unterschiedliche Ciphertexte (zufälliger DEK/IV)", () => {
    const a = encryptSecret("gleich", KEK);
    const b = encryptSecret("gleich", KEK);
    expect(a).not.toBe(b);
    expect(decryptSecret(a, KEK)).toBe("gleich");
    expect(decryptSecret(b, KEK)).toBe("gleich");
  });

  it("round-trips Unicode und lange Werte", () => {
    const secret = "Grüße-🌙-" + "x".repeat(5000);
    expect(decryptSecret(encryptSecret(secret, KEK), KEK)).toBe(secret);
  });

  it("scheitert bei falschem KEK", () => {
    const bundle = encryptSecret("geheim", KEK);
    expect(() => decryptSecret(bundle, randomBytes(32))).toThrow();
  });

  it("scheitert bei manipuliertem Ciphertext (GCM-Auth)", () => {
    const bundle = encryptSecret("geheim", KEK);
    const parts = bundle.split(".");
    // Ciphertext-Feld kippen
    const tampered = Buffer.from(parts[5], "base64");
    tampered[0] ^= 0xff;
    parts[5] = tampered.toString("base64");
    expect(() => decryptSecret(parts.join("."), KEK)).toThrow();
  });

  it("weist ungültiges Format ab", () => {
    expect(() => decryptSecret("nonsense", KEK)).toThrow();
  });
});
