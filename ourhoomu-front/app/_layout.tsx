import React from 'react';
import { Stack, useRouter, useSegments } from 'expo-router';
import { useFonts } from 'expo-font';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Text, View } from 'react-native';
import { DemoProvider } from '@/demo/repository';
import { AppRuntimeProvider, useAppRuntime } from '@/runtime/api-mode';
import { useReducedMotion } from '@/components/ui';
import { colors } from '@/theme/tokens';

export default function RootLayout() {
  const reduced = useReducedMotion();
  const [loaded, error] = useFonts({ NotoThai: require('../assets/fonts/NotoSansThai.ttf') });
  if (!loaded && !error)
    return (
      <View
        style={{
          flex: 1,
          backgroundColor: colors.cream,
          alignItems: 'center',
          justifyContent: 'center',
          gap: 14,
        }}
        accessibilityLabel="กำลังเตรียมบ้านตัวอย่าง"
      >
        <View
          style={{
            width: 82,
            height: 82,
            borderRadius: 26,
            backgroundColor: colors.peach,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontSize: 36 }}>⌂</Text>
        </View>
        <Text style={{ fontSize: 16, color: colors.cocoa }}>กำลังเตรียมบ้านตัวอย่าง…</Text>
      </View>
    );
  return (
    <SafeAreaProvider>
      <AppRuntimeProvider>
        <DemoProvider>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.cream },
              animation: reduced ? 'none' : 'slide_from_right',
            }}
          >
            <Stack.Screen name="index" />
            <Stack.Screen name="api" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="activity" />
            <Stack.Screen
              name="bill/new"
              options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }}
            />
            <Stack.Screen name="bill/[id]" />
            <Stack.Screen
              name="chore/new"
              options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }}
            />
            <Stack.Screen
              name="house/select"
              options={{ presentation: 'modal', animation: reduced ? 'none' : 'slide_from_bottom' }}
            />
          </Stack>
          <ModeGuard />
        </DemoProvider>
      </AppRuntimeProvider>
    </SafeAreaProvider>
  );
}

function ModeGuard() {
  const { mode } = useAppRuntime();
  const router = useRouter();
  const segments = useSegments();
  React.useEffect(() => {
    if (mode === 'api' && segments[0] !== 'api') router.replace('/api');
  }, [mode, router, segments]);
  return null;
}
