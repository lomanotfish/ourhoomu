import React, { useEffect, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  Animated,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Activity,
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  type LucideIcon,
} from 'lucide-react-native';
import { useRouter } from 'expo-router';
import { colors, radius, type as font } from '@/theme/tokens';
import { useDemo } from '@/demo/repository';

export function useReducedMotion() {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled()
      .then(setReduced)
      .catch(() => {});
    const listener = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => listener.remove();
  }, []);
  return reduced;
}

export function Label({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      allowFontScaling
      style={[
        { color: colors.cocoa, fontFamily: font.regular, fontSize: 15, lineHeight: 24 },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
export function Title({
  children,
  style,
  numberOfLines,
}: {
  children: React.ReactNode;
  style?: any;
  numberOfLines?: number;
}) {
  return (
    <Label
      numberOfLines={numberOfLines}
      style={[{ fontSize: 27, lineHeight: 38, fontWeight: '700' }, style]}
    >
      {children}
    </Label>
  );
}
export function Small({ children, style }: { children: React.ReactNode; style?: any }) {
  return (
    <Label style={[{ fontSize: 12, lineHeight: 19, color: colors.muted }, style]}>{children}</Label>
  );
}

export function MotionIn({
  children,
  delay = 0,
  style,
}: {
  children: React.ReactNode;
  delay?: number;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const value = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) {
      value.setValue(1);
      return;
    }
    const animation = Animated.timing(value, {
      toValue: 1,
      delay,
      duration: 460,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [delay, reduced, value]);
  return (
    <Animated.View
      style={[
        style,
        {
          opacity: value,
          transform: [
            { translateY: value.interpolate({ inputRange: [0, 1], outputRange: [15, 0] }) },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

export function Tap({
  children,
  onPress,
  style,
  accessibilityLabel,
  disabled = false,
  selected,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: any;
  accessibilityLabel?: string;
  disabled?: boolean;
  selected?: boolean;
}) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduced) {
      scale.stopAnimation();
      scale.setValue(1);
    }
    return () => scale.stopAnimation();
  }, [reduced, scale]);
  const animate = (toValue: number) => {
    if (reduced) {
      scale.stopAnimation();
      scale.setValue(1);
      return;
    }
    Animated.spring(scale, {
      toValue,
      useNativeDriver: Platform.OS !== 'web',
      friction: 5,
      tension: 180,
    }).start();
  };
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={accessibilityLabel}
        accessibilityState={{ disabled, selected }}
        disabled={disabled}
        onPressIn={() => animate(0.96)}
        onPressOut={() => animate(1)}
        onPress={onPress}
        style={[{ minHeight: 44, justifyContent: 'center' }, style]}
      >
        {children}
      </Pressable>
    </Animated.View>
  );
}

export function Button({
  title,
  onPress,
  icon: Icon,
  tone = 'primary',
  disabled = false,
  style,
}: {
  title: string;
  onPress: () => void;
  icon?: LucideIcon;
  tone?: 'primary' | 'soft' | 'outline';
  disabled?: boolean;
  style?: any;
}) {
  const bg = tone === 'primary' ? colors.coral : tone === 'soft' ? colors.peach : colors.paper;
  const fg = tone === 'primary' ? colors.paper : colors.cocoa;
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={title}
      disabled={disabled}
      style={[
        styles.button,
        {
          backgroundColor: bg,
          borderWidth: tone === 'outline' ? 1 : 0,
          borderColor: colors.line,
          opacity: disabled ? 0.45 : 1,
        },
        style,
      ]}
    >
      <View
        style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }}
      >
        {Icon && <Icon size={18} color={fg} strokeWidth={2.3} />}
        <Label style={{ color: fg, fontWeight: '700', fontSize: 15 }}>{title}</Label>
      </View>
    </Tap>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: any }) {
  return <View style={[styles.card, style]}>{children}</View>;
}
export function Pill({
  children,
  tone = 'mint',
}: {
  children: React.ReactNode;
  tone?: 'mint' | 'peach' | 'butter';
}) {
  return (
    <View
      style={{
        alignSelf: 'flex-start',
        paddingHorizontal: 11,
        paddingVertical: 4,
        borderRadius: 99,
        backgroundColor:
          tone === 'mint' ? colors.mint : tone === 'peach' ? colors.peach : colors.butter,
      }}
    >
      <Small style={{ color: tone === 'mint' ? colors.mintDark : colors.cocoa, fontWeight: '700' }}>
        {children}
      </Small>
    </View>
  );
}
export function RowLink({
  title,
  caption,
  icon: Icon,
  onPress,
}: {
  title: string;
  caption?: string;
  icon: LucideIcon;
  onPress: () => void;
}) {
  return (
    <Tap
      onPress={onPress}
      accessibilityLabel={title}
      style={{
        minHeight: 64,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 13,
        paddingVertical: 7,
      }}
    >
      <View
        style={{
          width: 42,
          height: 42,
          borderRadius: 14,
          backgroundColor: colors.peach,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Icon size={20} color={colors.coralDark} />
      </View>
      <View style={{ flex: 1 }}>
        <Label style={{ fontWeight: '700' }}>{title}</Label>
        {caption && <Small>{caption}</Small>}
      </View>
      <ChevronRight size={19} color={colors.muted} />
    </Tap>
  );
}

export function Field({
  label,
  error,
  ...props
}: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ gap: 6 }}>
      <Label style={{ fontSize: 13, fontWeight: '700' }}>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor="#9A8B83"
        style={[styles.input, error ? { borderColor: colors.error } : null]}
        {...props}
      />
      {error && <Small style={{ color: colors.error }}>{error}</Small>}
    </View>
  );
}

export function DemoBadge() {
  return <Pill tone="butter">DEMO · ข้อมูลตัวอย่าง</Pill>;
}
export function SectionHead({
  title,
  action,
  onPress,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
}) {
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        marginBottom: 12,
      }}
    >
      <Label style={{ fontSize: 18, fontWeight: '700' }}>{title}</Label>
      {action && onPress && (
        <Tap onPress={onPress} accessibilityLabel={action}>
          <Small style={{ color: colors.coralDark, fontWeight: '700' }}>{action} ›</Small>
        </Tap>
      )}
    </View>
  );
}

export function Page({
  children,
  title,
  back = false,
  scroll = true,
}: {
  children: React.ReactNode;
  title?: string;
  back?: boolean;
  scroll?: boolean;
}) {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const content = (
    <View
      style={{
        width: '100%',
        maxWidth: 680,
        alignSelf: 'center',
        paddingHorizontal: 20,
        paddingBottom: Math.max(insets.bottom, 18) + 24,
        paddingTop: 12,
      }}
    >
      {back && (
        <Tap
          onPress={() => router.back()}
          accessibilityLabel="ย้อนกลับ"
          style={{
            alignSelf: 'flex-start',
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            marginBottom: 15,
          }}
        >
          <ArrowLeft size={20} color={colors.cocoa} />
          <Label>ย้อนกลับ</Label>
        </Tap>
      )}
      {title && <Title style={{ marginBottom: 20 }}>{title}</Title>}
      {children}
    </View>
  );
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1, backgroundColor: colors.cream, paddingTop: insets.top }}
    >
      {scroll ? (
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ flexGrow: 1 }}
          showsVerticalScrollIndicator={false}
        >
          {content}
        </ScrollView>
      ) : (
        content
      )}
    </KeyboardAvoidingView>
  );
}

export function AppHeader({ eyebrow }: { eyebrow: string }) {
  const { house } = useDemo();
  const router = useRouter();
  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
        marginBottom: 22,
      }}
    >
      <View style={{ flex: 1 }}>
        <Small style={{ letterSpacing: 1, fontWeight: '700' }}>{eyebrow}</Small>
        <Tap
          onPress={() => router.push('/house/select')}
          accessibilityLabel={`เปลี่ยนบ้าน ปัจจุบัน ${house.name}`}
          style={{ flexDirection: 'row', alignItems: 'center', gap: 5, alignSelf: 'flex-start' }}
        >
          <Title style={{ fontSize: 23 }}>{house.name}</Title>
          <ChevronDown size={18} color={colors.coral} />
        </Tap>
      </View>
      <Tap
        onPress={() => router.push('/activity')}
        accessibilityLabel="ดูกิจกรรมในบ้าน"
        style={{
          width: 48,
          height: 48,
          borderRadius: 17,
          backgroundColor: colors.mint,
          alignItems: 'center',
        }}
      >
        <Activity size={23} color={colors.mintDark} />
      </Tap>
    </View>
  );
}

export function Empty({ emoji, title, detail }: { emoji: string; title: string; detail: string }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: 34 }}>
      <Label style={{ fontSize: 34, lineHeight: 46 }}>{emoji}</Label>
      <Label style={{ fontWeight: '700', marginTop: 8 }}>{title}</Label>
      <Small style={{ textAlign: 'center', marginTop: 4 }}>{detail}</Small>
    </Card>
  );
}

const styles = StyleSheet.create({
  button: { borderRadius: radius.input, minHeight: 52, paddingHorizontal: 16, paddingVertical: 10 },
  card: {
    backgroundColor: colors.paper,
    borderRadius: radius.card,
    padding: 18,
    borderWidth: 1,
    borderColor: '#F2EBE3',
  },
  input: {
    color: colors.cocoa,
    fontFamily: font.regular,
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: radius.input,
    backgroundColor: colors.paper,
    borderWidth: 1,
    borderColor: '#98786A',
  },
});
