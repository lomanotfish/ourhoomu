import React, { useRef, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight } from 'lucide-react-native';
import { dateOffset } from '@/demo/seed';
import { colors, radius } from '@/theme/tokens';
import { Label, Small, Tap } from './ui';
import {
  calendarDays,
  formatThaiDate,
  formatThaiMonth,
  moveMonth,
  parseChoreDate,
  toDateKey,
  type CalendarMonth,
} from './chore-date';

const weekdays = ['อา', 'จ', 'อ', 'พ', 'พฤ', 'ศ', 'ส'];

export function ChoreDatePicker({
  label,
  value,
  onChange,
  error,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const triggerRef = useRef<View>(null);
  const [open, setOpen] = useState(false);
  const [visibleMonth, setVisibleMonth] = useState<CalendarMonth>(() => {
    const date = parseChoreDate(value) ?? parseChoreDate(dateOffset(0))!;
    return { year: date.year, month: date.month };
  });
  const selected = parseChoreDate(value);
  const today = dateOffset(0);
  const cells = calendarDays(visibleMonth.year, visibleMonth.month);

  const toggle = () => {
    if (!open && selected) setVisibleMonth({ year: selected.year, month: selected.month });
    setOpen((current) => !current);
  };
  const choose = (next: string) => {
    onChange(next);
    setOpen(false);
    if (Platform.OS === 'web') {
      requestAnimationFrame(() =>
        (triggerRef.current as unknown as { focus?: () => void } | null)?.focus?.(),
      );
    }
  };

  return (
    <View style={{ maxWidth: 420 }}>
      <Label style={{ fontWeight: '700', marginBottom: 7 }}>{label}</Label>
      <Pressable
        ref={triggerRef}
        onPress={toggle}
        accessibilityRole="button"
        accessibilityLabel={`${label} ${formatThaiDate(value)}`}
        accessibilityHint="เปิดหรือปิดปฏิทินเพื่อเลือกวัน"
        accessibilityState={{ expanded: open }}
        aria-expanded={open}
        style={{
          minHeight: 62,
          borderRadius: radius.input,
          borderWidth: 1,
          borderColor: open ? colors.mintDark : colors.line,
          backgroundColor: colors.paper,
          paddingHorizontal: 12,
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <View
          style={{
            height: 42,
            width: 42,
            borderRadius: 13,
            backgroundColor: colors.mint,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <CalendarDays size={22} color={colors.mintDark} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label style={{ fontWeight: '700' }}>{formatThaiDate(value)}</Label>
          <Small>แตะเพื่อเลือกวันที่</Small>
        </View>
        <ChevronDown
          size={19}
          color={colors.mintDark}
          style={{ transform: [{ rotate: open ? '180deg' : '0deg' }] }}
        />
      </Pressable>
      {error && <Small style={{ color: colors.error, marginTop: 5 }}>{error}</Small>}
      {open && (
        <View
          style={{
            marginTop: 9,
            borderRadius: radius.card,
            borderWidth: 1,
            borderColor: colors.line,
            backgroundColor: colors.paper,
            paddingVertical: 12,
            paddingHorizontal: 8,
          }}
        >
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              paddingHorizontal: 5,
              marginBottom: 10,
            }}
          >
            <Tap
              onPress={() => setVisibleMonth((month) => moveMonth(month.year, month.month, -1))}
              disabled={visibleMonth.year === 1 && visibleMonth.month === 1}
              accessibilityLabel="เดือนก่อนหน้า"
              style={{ width: 44, alignItems: 'center' }}
            >
              <ChevronLeft size={21} color={colors.mintDark} />
            </Tap>
            <Label style={{ fontWeight: '700', textAlign: 'center', flex: 1 }}>
              {formatThaiMonth(visibleMonth.year, visibleMonth.month)}
            </Label>
            <Tap
              onPress={() => setVisibleMonth((month) => moveMonth(month.year, month.month, 1))}
              disabled={visibleMonth.year === 9999 && visibleMonth.month === 12}
              accessibilityLabel="เดือนถัดไป"
              style={{ width: 44, alignItems: 'center' }}
            >
              <ChevronRight size={21} color={colors.mintDark} />
            </Tap>
          </View>
          <View style={{ flexDirection: 'row', marginBottom: 3 }}>
            {weekdays.map((day) => (
              <View key={day} style={{ flex: 1, alignItems: 'center' }}>
                <Small style={{ fontWeight: '700', color: colors.muted }}>{day}</Small>
              </View>
            ))}
          </View>
          {Array.from({ length: cells.length / 7 }, (_, week) => (
            <View key={week} style={{ flexDirection: 'row' }}>
              {cells.slice(week * 7, week * 7 + 7).map((day, index) => {
                const key = day ? toDateKey(visibleMonth.year, visibleMonth.month, day) : null;
                const isSelected = key === value;
                const isToday = key === today;
                return (
                  <View key={index} style={{ flex: 1 }}>
                    {day && key ? (
                      <Tap
                        onPress={() => choose(key)}
                        selected={isSelected}
                        accessibilityLabel={`เลือกวันที่ ${formatThaiDate(key)}${isToday ? ' วันนี้' : ''}${isSelected ? ' เลือกแล้ว' : ''}`}
                        style={{
                          minHeight: 44,
                          alignItems: 'center',
                          borderRadius: 14,
                          backgroundColor: isSelected
                            ? colors.mintDark
                            : isToday
                              ? colors.mint
                              : colors.paper,
                          borderWidth: isToday && !isSelected ? 1 : 0,
                          borderColor: colors.mintDark,
                        }}
                      >
                        <Label
                          style={{
                            fontWeight: isSelected || isToday ? '700' : '400',
                            color: isSelected ? colors.paper : colors.cocoa,
                          }}
                        >
                          {day}
                        </Label>
                        {isToday && (
                          <View
                            style={{
                              position: 'absolute',
                              bottom: 4,
                              height: 3,
                              width: 12,
                              borderRadius: 2,
                              backgroundColor: isSelected ? colors.paper : colors.mintDark,
                            }}
                          />
                        )}
                      </Tap>
                    ) : (
                      <View style={{ minHeight: 44 }} />
                    )}
                  </View>
                );
              })}
            </View>
          ))}
          <View style={{ alignItems: 'flex-start', marginTop: 7, paddingHorizontal: 5 }}>
            <Tap
              onPress={() => choose(today)}
              accessibilityLabel="เลือกวันนี้"
              style={{
                borderRadius: 12,
                backgroundColor: colors.mint,
                paddingHorizontal: 13,
                alignItems: 'center',
              }}
            >
              <Small style={{ color: colors.mintDark, fontWeight: '700' }}>วันนี้</Small>
            </Tap>
          </View>
        </View>
      )}
    </View>
  );
}
