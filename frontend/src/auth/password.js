// Vérification d'un mot de passe contre une empreinte PBKDF2-SHA256 (Web Crypto, sans dépendance).
// Utilisée par l'API simulée ; avec le back Symfony, la vérification se fait côté serveur.
import { PBKDF2_ITERATIONS } from '../api/accounts.js';

const fromBase64 = (b64) => Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));

export async function verifyPassword(password, saltB64, hashB64, iterations = PBKDF2_ITERATIONS) {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error('Web Crypto indisponible (le site doit être servi en HTTPS ou sur localhost).');
  const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  const bits = await subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: fromBase64(saltB64), iterations }, key, 256);
  const actual = new Uint8Array(bits);
  const expected = fromBase64(hashB64);
  // Comparaison en temps constant.
  let diff = actual.length ^ expected.length;
  for (let i = 0; i < Math.min(actual.length, expected.length); i++) diff |= actual[i] ^ expected[i];
  return diff === 0;
}
