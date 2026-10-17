// @expo/metro-runtime MUST be the first import to ensure Fast Refresh works on
// web, mirroring the production expo-router/entry-classic bootstrap.
import '@expo/metro-runtime';

import { registerRootComponent } from 'expo';
import { ExpoRoot } from 'expo-router';
import React from 'react';

// Test-only Expo Router entrypoint: serves the harness routes directory
// (test-harness/routes/) instead of the production app/ directory. The
// production entrypoint and app source are not modified. The import mode is
// pinned to 'sync' so the harness never depends on async route chunks.
const harnessRoutes = require.context('./routes', true, /\.[tj]sx?$/, 'sync');

function HarnessApp() {
  return <ExpoRoot context={harnessRoutes} />;
}

registerRootComponent(HarnessApp);
