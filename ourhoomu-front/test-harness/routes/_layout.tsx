import React from 'react';
import { Slot } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppRuntimeProvider } from '@/runtime/api-mode';
import { harnessRuntime } from '../harness-runtime';

// Test-only harness shell: mirrors the production SafeAreaProvider + runtime
// composition, but injects the memory-credential harness runtime instead of
// building one from public env/storage. Slot mounts the matched harness route
// from the router context without introducing production navigation behavior.
// No production entrypoint is touched.
export default function HarnessLayout(): React.ReactElement {
  return (
    <SafeAreaProvider>
      <AppRuntimeProvider testRuntime={harnessRuntime}>
        <Slot />
      </AppRuntimeProvider>
    </SafeAreaProvider>
  );
}
