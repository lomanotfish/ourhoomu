import React, { useState } from 'react';
import { AccessibilityInfo, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, Plus, Sparkles } from 'lucide-react-native';
import {
  AppHeader,
  Button,
  Card,
  DemoBadge,
  Empty,
  Field,
  Label,
  MotionIn,
  Page,
  Pill,
  Small,
  Tap,
  Title,
} from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { dateOffset } from '@/demo/seed';
import { colors } from '@/theme/tokens';
import type { Chore } from '@/demo/types';

function ChoreCard({
  chore,
  index,
  onDone,
}: {
  chore: Chore;
  index: number;
  onDone: (id: string) => void;
}) {
  const { house, memberId } = useDemo();
  const mine = chore.assigneeId === memberId;
  const assignee = house.members.find((m) => m.id === chore.assigneeId)?.name ?? 'สมาชิก';
  return (
    <MotionIn delay={Math.min(index * 55, 220)} style={{ marginBottom: 10 }}>
      <Card
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          backgroundColor: chore.completedAt ? colors.mint : colors.paper,
        }}
      >
        <View
          style={{
            width: 51,
            height: 51,
            borderRadius: 17,
            backgroundColor: colors.peach,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Label style={{ fontSize: 26 }}>{chore.emoji}</Label>
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Label style={{ fontWeight: '700' }}>{chore.title}</Label>
          <Small>
            {assignee} ·{' '}
            {chore.mode === 'manual' ? 'จัดเอง' : chore.mode === 'repeat' ? 'ทำซ้ำ' : 'หมุนเวียน'} ·{' '}
            {chore.date}
          </Small>
        </View>
        {chore.completedAt ? (
          <MotionIn>
            <View
              style={{
                width: 44,
                height: 44,
                backgroundColor: colors.mintDark,
                borderRadius: 22,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Check size={20} color={colors.paper} />
            </View>
          </MotionIn>
        ) : mine ? (
          <Tap
            onPress={() => onDone(chore.id)}
            accessibilityLabel={`ทำ${chore.title}เสร็จ`}
            style={{
              minWidth: 44,
              height: 44,
              borderRadius: 16,
              borderWidth: 2,
              borderColor: colors.mintDark,
              alignItems: 'center',
            }}
          >
            <Check size={20} color={colors.mintDark} />
          </Tap>
        ) : (
          <Small>เวรของ{assignee}</Small>
        )}
      </Card>
    </MotionIn>
  );
}

export default function Chores() {
  const router = useRouter();
  const { chores, completeChore } = useDemo();
  const [view, setView] = useState<'today' | 'week' | 'date'>('today');
  const [selectedDate, setSelectedDate] = useState(dateOffset(0));
  const [success, setSuccess] = useState('');
  const dates = Array.from({ length: 7 }, (_, index) => dateOffset(index));
  const visible = chores
    .filter((c) =>
      view === 'today'
        ? c.date === dateOffset(0)
        : view === 'week'
          ? dates.includes(c.date)
          : c.date === selectedDate,
    )
    .sort((a, b) => a.date.localeCompare(b.date));
  const finish = (id: string) => {
    if (completeChore(id)) {
      const message = 'เยี่ยมเลย! บ้านสดใสขึ้นอีกนิด';
      setSuccess(`${message} ✨`);
      AccessibilityInfo.announceForAccessibility(message);
      setTimeout(() => setSuccess(''), 3200);
    }
  };
  return (
    <Page>
      <AppHeader eyebrow="เรื่องเล็ก ๆ ที่ช่วยกัน" />
      <MotionIn>
        <DemoBadge />
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'flex-end',
            marginTop: 14,
            marginBottom: 13,
          }}
        >
          <View>
            <Title>เวรในบ้าน</Title>
            <Small>ทำด้วยกัน บ้านก็น่าอยู่</Small>
          </View>
          <Tap
            onPress={() => router.push('/chore/new')}
            accessibilityLabel="เพิ่มตารางเวร"
            style={{
              width: 48,
              height: 48,
              borderRadius: 16,
              backgroundColor: colors.coral,
              alignItems: 'center',
            }}
          >
            <Plus size={22} color={colors.paper} />
          </Tap>
        </View>
      </MotionIn>
      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 17 }}>
        {(
          [
            { id: 'today', label: 'วันนี้' },
            { id: 'week', label: 'สัปดาห์นี้' },
            { id: 'date', label: 'เลือกวัน' },
          ] as const
        ).map((item) => (
          <Tap
            key={item.id}
            onPress={() => setView(item.id)}
            accessibilityLabel={item.label}
            style={{
              borderRadius: 99,
              backgroundColor: view === item.id ? colors.cocoa : colors.paper,
              paddingHorizontal: 14,
              minHeight: 42,
              borderWidth: 1,
              borderColor: view === item.id ? colors.cocoa : colors.line,
            }}
          >
            <Small
              style={{ color: view === item.id ? colors.paper : colors.cocoa, fontWeight: '700' }}
            >
              {item.label}
            </Small>
          </Tap>
        ))}
      </View>
      {view === 'date' && (
        <View style={{ marginBottom: 18 }}>
          <Field
            label="วันที่ (YYYY-MM-DD)"
            value={selectedDate}
            onChangeText={setSelectedDate}
            placeholder="2026-10-12"
          />
          <View style={{ flexDirection: 'row', gap: 7, marginTop: 8, flexWrap: 'wrap' }}>
            {dates.map((date, index) => (
              <Tap
                key={date}
                onPress={() => setSelectedDate(date)}
                accessibilityLabel={`เลือกวันที่ ${date}`}
                style={{
                  backgroundColor: selectedDate === date ? colors.mint : colors.paper,
                  borderRadius: 12,
                  paddingHorizontal: 10,
                  minHeight: 44,
                }}
              >
                <Small style={{ fontWeight: '700' }}>
                  {index === 0
                    ? 'วันนี้'
                    : new Date(`${date}T12:00:00`).toLocaleDateString('th-TH', {
                        weekday: 'short',
                        day: 'numeric',
                      })}
                </Small>
              </Tap>
            ))}
          </View>
        </View>
      )}
      {success && (
        <MotionIn>
          <Card
            style={{
              backgroundColor: colors.mint,
              borderWidth: 0,
              marginBottom: 14,
              flexDirection: 'row',
              gap: 9,
            }}
          >
            <Sparkles size={19} color={colors.mintDark} />
            <Label style={{ color: colors.mintDark, fontWeight: '700' }}>{success}</Label>
          </Card>
        </MotionIn>
      )}
      <View
        style={{
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: 12,
        }}
      >
        <Label style={{ fontSize: 18, fontWeight: '700' }}>
          {view === 'today' ? 'วันนี้' : view === 'week' ? '7 วันข้างหน้า' : selectedDate}
        </Label>
        <Pill tone="mint">{visible.filter((c) => !c.completedAt).length} งานรอทำ</Pill>
      </View>
      {visible.length ? (
        visible.map((c, index) => <ChoreCard key={c.id} chore={c} index={index} onDone={finish} />)
      ) : (
        <Empty emoji="🌿" title="วันนี้ว่างจากเวร" detail="เลือกวันอื่นหรือเพิ่มตารางเวรใหม่" />
      )}
      <Card style={{ marginTop: 17, backgroundColor: colors.peach, borderWidth: 0 }}>
        <Label style={{ fontWeight: '700' }}>เวรเป็นของใคร คนนั้นกดเสร็จ</Label>
        <Small>การทำเสร็จในเดโมจะปรากฏในกิจกรรมบ้าน ส่วนข้อมูลจริงรอ API ยืนยัน</Small>
      </Card>
    </Page>
  );
}
