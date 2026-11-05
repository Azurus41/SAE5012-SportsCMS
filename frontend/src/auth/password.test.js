import { describe, it, expect, beforeAll } from 'vitest';
import { pbkdf2Sync, webcrypto } from 'node:crypto';
import { verifyPassword } from './password.js';
import { ACCOUNTS } from '../api/accounts.js';

beforeAll(() => {
  // Node 18 n'expose pas toujours crypto en global (le navigateur, si).
  if (!globalThis.crypto?.subtle) globalThis.crypto = webcrypto;
});

describe('vérification des mots de passe (PBKDF2)', () => {
  const salt = Buffer.from('sel-de-test-1234');
  const hash = pbkdf2Sync('bon-mot-de-passe', salt, 1000, 32, 'sha256').toString('base64');

  it('accepte le bon mot de passe et refuse les autres', async () => {
    expect(await verifyPassword('bon-mot-de-passe', salt.toString('base64'), hash, 1000)).toBe(true);
    expect(await verifyPassword('mauvais', salt.toString('base64'), hash, 1000)).toBe(false);
    expect(await verifyPassword('', salt.toString('base64'), hash, 1000)).toBe(false);
  });

  it('un compte par rôle, sans mot de passe en clair dans le site', () => {
    const emails = Object.values(ACCOUNTS).map((a) => a.email);
    expect(emails).toContain('admin@touchline.test');
    expect(emails).toContain('abonne@touchline.test');
    expect(emails).toContain('fournisseur@touchline.test');
    for (const a of Object.values(ACCOUNTS)) expect(Object.keys(a).sort()).toEqual(['email', 'hash', 'salt']);
  });
});
