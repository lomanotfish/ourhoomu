/** Synthetic trusted-verifier fixtures, never native/live issuer acceptance. */
import { createHash, randomUUID } from 'node:crypto';
import type { SessionStore } from '../../src/db/connection';

export const syntheticDigest = () => createHash('sha256').update(randomUUID()).digest('hex');
export const syntheticEvidence = () => ({
  keyDigest: syntheticDigest(),
  bodyHash: syntheticDigest(),
});
export const syntheticCiphertext = () => `synthetic-encrypted-result-${syntheticDigest()}`;

export async function issueSyntheticSession(
  store: SessionStore,
  displayName = 'Synthetic actor',
  subject = randomUUID(),
) {
  const challengeInput = {
    provider: 'google' as const,
    proofDigest: syntheticDigest(),
    ...syntheticEvidence(),
  };
  const challenge = await store.execute('challenge', challengeInput);
  const accessDigest = syntheticDigest();
  const refreshDigest = syntheticDigest();
  const input = {
    provider: challengeInput.provider,
    proofDigest: challengeInput.proofDigest,
    challengeId: challenge.challengeId,
    ...syntheticEvidence(),
    issuer: 'https://synthetic.invalid',
    subject,
    displayName,
    accessDigest,
    refreshDigest,
    replayCiphertext: syntheticCiphertext(),
    authTime: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 900_000).toISOString(),
    refreshExpiresAt: new Date(Date.now() + 2_592_000_000).toISOString(),
  };
  const result = await store.execute('exchange', input);
  const claims = await store.verifyAccessDigest(accessDigest);
  return { claims, accessDigest, refreshDigest, input, result, challengeInput };
}
