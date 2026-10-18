import React, { useCallback, useState } from 'react';
import { Label, Page, Pill, Small, Title } from '@/components/ui';
import { router, useLocalSearchParams } from 'expo-router';
import { Button } from 'react-native';
import { harnessCredentials } from '../harness-runtime';
import type { Session } from '@/session/authority';

// Test-only sign-in route for the actual-local-HTTP browser lane. It performs
// the real synthetic-issuer flow against the local API exactly once per tap:
//   POST /v1/auth/challenges {provider, clientNonce}
//   POST /__synthetic/token  {nonce, subject, email}
//   POST /v1/auth/exchange   {provider, challengeId, proof, idToken}
// The exchanged session is saved into the memory-only harness credential
// store and the route navigates to the harness screen. No mocks are involved
// and nothing is persisted outside memory.

function randomClientNonce(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

async function postJson(url: string, body: unknown, idempotencyKey?: string): Promise<Response> {
  return fetch(url, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}),
    },
    body: JSON.stringify(body),
  });
}

export default function HarnessSignIn() {
  const [status, setStatus] = useState<'idle' | 'signing-in' | 'ok' | 'error'>('idle');
  const [message, setMessage] = useState('');
  // The test controls the synthetic subject via ?subject=<uuid> so each test
  // run owns an isolated identity; a random one is used when absent.
  const params = useLocalSearchParams<{ subject?: string }>();

  const signIn = useCallback(async () => {
    const baseUrl = process.env.EXPO_PUBLIC_API_BASE_URL;
    if (!baseUrl) {
      setStatus('error');
      setMessage('EXPO_PUBLIC_API_BASE_URL is not set.');
      return;
    }
    const subject =
      typeof params.subject === 'string' && params.subject ? params.subject : crypto.randomUUID();
    setStatus('signing-in');
    setMessage('');
    try {
      const clientNonce = randomClientNonce();
      const challengeResponse = await postJson(
        new URL('v1/auth/challenges', baseUrl).toString(),
        { provider: 'google', clientNonce },
        crypto.randomUUID(),
      );
      if (!challengeResponse.ok) throw new Error(`challenges ${challengeResponse.status}`);
      const challenge = (await challengeResponse.json()).data as { id: string; nonce: string };

      const tokenResponse = await postJson(new URL('__synthetic/token', baseUrl).toString(), {
        nonce: challenge.nonce,
        subject,
      });
      if (!tokenResponse.ok) throw new Error(`synthetic token ${tokenResponse.status}`);
      const idToken = (await tokenResponse.json()).idToken as string;

      const exchangeResponse = await postJson(
        new URL('v1/auth/exchange', baseUrl).toString(),
        {
          provider: 'google',
          challengeId: challenge.id,
          proof: clientNonce,
          idToken,
        },
        crypto.randomUUID(),
      );
      if (!exchangeResponse.ok) throw new Error(`exchange ${exchangeResponse.status}`);
      const session = (await exchangeResponse.json()).data as Session;

      await harnessCredentials.save(session);
      setStatus('ok');
      setMessage(`HARNESS SIGN-IN OK ${subject}`);
      // The typed route union only covers the production app/ directory; the
      // harness routes are registered by the test-only entry context.
      router.replace('/harness' as Parameters<typeof router.replace>[0]);
    } catch (cause) {
      setStatus('error');
      setMessage(cause instanceof Error ? cause.message : 'Unknown sign-in failure');
    }
  }, []);

  return (
    <Page>
      <Pill tone="peach">HARNESS SIGN-IN · actual-local-HTTP lane</Pill>
      <Title style={{ marginTop: 14 }}>Synthetic issuer sign-in</Title>
      <Label style={{ marginTop: 8 }}>
        {status === 'ok'
          ? 'HARNESS SIGN-IN OK'
          : status === 'error'
            ? 'HARNESS SIGN-IN FAILED'
            : 'HARNESS SIGN-IN READY'}
      </Label>
      <Small>{message || 'Tap the button to run the real challenge/exchange flow.'}</Small>
      <Button
        title="RUN HARNESS SIGN-IN"
        disabled={status === 'signing-in'}
        onPress={() => void signIn()}
      />
    </Page>
  );
}
