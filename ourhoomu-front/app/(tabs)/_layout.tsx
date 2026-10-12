import React from 'react';
import { Tabs } from 'expo-router';
import { View } from 'react-native';
import { House, LayoutGrid, ReceiptText, Sparkles, type LucideIcon } from 'lucide-react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Label, Tap } from '@/components/ui';
import { colors } from '@/theme/tokens';

const tabInfo: Record<string, { label: string; Icon: LucideIcon }> = {
  index: { label: 'ภาพรวม', Icon: LayoutGrid },
  bills: { label: 'บิล', Icon: ReceiptText },
  chores: { label: 'เวร', Icon: Sparkles },
  house: { label: 'บ้าน', Icon: House },
};

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={{
        backgroundColor: colors.paper,
        borderTopWidth: 1,
        borderTopColor: colors.line,
        paddingBottom: Math.max(insets.bottom, 7),
        paddingTop: 8,
        flexDirection: 'row',
        justifyContent: 'space-around',
      }}
    >
      {state.routes.map((route: { key: string; name: string }, index: number) => {
        const item = tabInfo[route.name];
        if (!item) return null;
        const focused = state.index === index;
        return (
          <Tap
            key={route.key}
            onPress={() => navigation.navigate(route.name)}
            accessibilityLabel={item.label}
            selected={focused}
            style={{ alignItems: 'center', paddingHorizontal: 13, minWidth: 64, minHeight: 50 }}
          >
            <View
              style={{
                width: 43,
                height: 30,
                borderRadius: 13,
                backgroundColor: focused ? colors.peach : 'transparent',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <item.Icon
                size={21}
                color={focused ? colors.coralDark : colors.muted}
                strokeWidth={focused ? 2.5 : 2}
              />
            </View>
            <Label
              style={{
                fontSize: 11,
                lineHeight: 17,
                color: focused ? colors.coralDark : colors.muted,
                fontWeight: focused ? '700' : '500',
              }}
            >
              {item.label}
            </Label>
          </Tap>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      <Tabs.Screen name="index" />
      <Tabs.Screen name="bills" />
      <Tabs.Screen name="chores" />
      <Tabs.Screen name="house" />
    </Tabs>
  );
}
