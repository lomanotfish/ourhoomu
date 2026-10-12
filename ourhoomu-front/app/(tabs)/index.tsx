import React, { useState } from 'react';
import { AccessibilityInfo, useWindowDimensions, View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowUpRight, Plus, Sparkles } from 'lucide-react-native';
import {
  AppHeader,
  Button,
  Card,
  DemoBadge,
  Empty,
  Label,
  MotionIn,
  Page,
  SectionHead,
  Small,
  Tap,
  Title,
} from '@/components/ui';
import { HouseArt } from '@/components/HouseArt';
import { useDemo } from '@/demo/repository';
import { confirmedRemaining, formatBaht } from '@/demo/money';
import { dateOffset } from '@/demo/seed';
import { colors } from '@/theme/tokens';

export default function Overview() {
  const router = useRouter();
  const { width } = useWindowDimensions();
  const { bills, chores, state, house, memberId, completeChore } = useDemo();
  const [success, setSuccess] = useState('');
  const toPay = bills.reduce((sum, bill) => sum + confirmedRemaining(bill, memberId), 0);
  const toReceive = bills.reduce(
    (sum, bill) =>
      sum +
      (bill.recipientId === memberId
        ? bill.shares.filter((s) => s.memberId !== memberId).reduce((n, s) => n + s.amountSatang, 0)
        : 0),
    0,
  );
  const pending = bills.reduce(
    (sum, bill) =>
      sum +
      bill.payments.filter((p) => p.payerId === memberId).reduce((n, p) => n + p.amountSatang, 0),
    0,
  );
  const today = chores.filter((c) => c.date === dateOffset(0));
  const myOpen = today.filter((c) => c.assigneeId === memberId && !c.completedAt);
  const activity = state.activity.filter((a) => a.houseId === house.id).slice(0, 3);
  const finish = (id: string) => {
    if (completeChore(id)) {
      const message = 'ทำเวรเสร็จแล้ว บ้านสดใสขึ้นอีกนิด';
      setSuccess(message);
      AccessibilityInfo.announceForAccessibility(message);
      setTimeout(() => setSuccess(''), 3200);
    }
  };
  return (
    <Page>
      <AppHeader eyebrow="สวัสดี มิว ☀️" />
      <MotionIn>
        <DemoBadge />
      </MotionIn>
      <MotionIn delay={70}>
        <View
          style={{
            backgroundColor: colors.peach,
            borderRadius: 28,
            padding: 20,
            flexDirection: 'row',
            alignItems: 'center',
            marginTop: 18,
            overflow: 'hidden',
          }}
        >
          <View style={{ flex: 1, zIndex: 1 }}>
            <Small style={{ color: colors.coralDark, fontWeight: '700', letterSpacing: 1 }}>
              WELCOME HOME
            </Small>
            <Title style={{ fontSize: 22, lineHeight: 32, marginTop: 4 }}>
              บ้านน่าอยู่ขึ้น{'\n'}เพราะมีเรา
            </Title>
            <Small style={{ color: colors.cocoa, marginTop: 6 }}>
              วันนี้มี {myOpen.length} เวรที่รอคุณอยู่
            </Small>
          </View>
          <HouseArt size={130} />
        </View>
      </MotionIn>
      <MotionIn delay={130}>
        <View style={{ flexDirection: width < 360 ? 'column' : 'row', gap: 10, marginTop: 14 }}>
          <Tap
            onPress={() => router.push({ pathname: '/(tabs)/bills', params: { filter: 'mine' } })}
            accessibilityLabel={`ดูบิลที่ต้องจ่าย ${formatBaht(toPay)}`}
            style={{ flex: 1 }}
          >
            <Card style={{ flex: 1, backgroundColor: colors.mint, borderWidth: 0, minWidth: 0 }}>
              <Small style={{ color: colors.mintDark }}>ฉันยังต้องจ่าย</Small>
              <Title style={{ fontSize: 21, lineHeight: 30 }}>{formatBaht(toPay)}</Title>
              <Small>ดูบิลที่ต้องจ่าย ›</Small>
            </Card>
          </Tap>
          <Tap
            onPress={() => router.push('/(tabs)/bills')}
            accessibilityLabel={`ดูบิลที่ต้องรับคืน ${formatBaht(toReceive)}`}
            style={{ flex: 1 }}
          >
            <Card style={{ flex: 1, backgroundColor: colors.butter, borderWidth: 0, minWidth: 0 }}>
              <Small style={{ color: colors.cocoa }}>คนอื่นต้องคืนฉัน</Small>
              <Title style={{ fontSize: 21, lineHeight: 30 }}>{formatBaht(toReceive)}</Title>
              <Small>ดูบิลทั้งหมด ›</Small>
            </Card>
          </Tap>
        </View>
        {pending > 0 && (
          <Tap
            onPress={() =>
              router.push({ pathname: '/(tabs)/bills', params: { filter: 'pending' } })
            }
            accessibilityLabel={`ดูรายการรอ ${formatBaht(pending)}`}
            style={{ marginTop: 9 }}
          >
            <Card style={{ backgroundColor: colors.blue, borderWidth: 0 }}>
              <Label style={{ fontWeight: '700' }}>รอดำเนินการ {formatBaht(pending)}</Label>
              <Small>ยอดนี้ยังไม่หักจากเงินค้าง · ดูรายการ ›</Small>
            </Card>
          </Tap>
        )}
      </MotionIn>
      <MotionIn delay={190}>
        <View style={{ flexDirection: 'row', gap: 10, marginTop: 18 }}>
          <View style={{ flex: 1 }}>
            <Button title="เพิ่มบิล" icon={Plus} onPress={() => router.push('/bill/new')} />
          </View>
          <View style={{ flex: 1 }}>
            <Button
              title="เพิ่มเวร"
              icon={Sparkles}
              tone="soft"
              onPress={() => router.push('/chore/new')}
            />
          </View>
        </View>
      </MotionIn>
      <MotionIn delay={250} style={{ marginTop: 30 }}>
        <SectionHead
          title="เวรวันนี้"
          action="ดูทั้งหมด"
          onPress={() => router.push('/(tabs)/chores')}
        />
        {success && (
          <Card style={{ backgroundColor: colors.mint, borderWidth: 0, marginBottom: 10 }}>
            <Label style={{ color: colors.mintDark, fontWeight: '700' }}>✓ {success}</Label>
          </Card>
        )}
        {today.length ? (
          today.map((c) => (
            <Card
              key={c.id}
              style={{
                marginBottom: 9,
                flexDirection: 'row',
                alignItems: 'center',
                gap: 10,
                padding: 12,
              }}
            >
              <Label style={{ fontSize: 25 }}>{c.emoji}</Label>
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>{c.title}</Label>
                <Small>
                  {c.assigneeId === memberId
                    ? 'เวรของคุณ'
                    : `เวรของ${house.members.find((m) => m.id === c.assigneeId)?.name ?? 'สมาชิก'}`}
                </Small>
              </View>
              {c.assigneeId === memberId && !c.completedAt ? (
                <Tap
                  onPress={() => finish(c.id)}
                  accessibilityLabel={`ทำ${c.title}เสร็จ`}
                  style={{ paddingHorizontal: 12, backgroundColor: colors.mint, borderRadius: 13 }}
                >
                  <Small style={{ color: colors.mintDark, fontWeight: '700' }}>ทำเสร็จ</Small>
                </Tap>
              ) : (
                <Small>{c.completedAt ? '✓ เสร็จแล้ว' : 'รอทำ'}</Small>
              )}
            </Card>
          ))
        ) : (
          <Empty
            emoji="🌿"
            title="วันนี้บ้านพักผ่อน"
            detail="ยังไม่มีเวรในวันนี้ เพิ่มเวรใหม่ได้เลย"
          />
        )}
      </MotionIn>
      <MotionIn delay={310} style={{ marginTop: 22 }}>
        <SectionHead
          title="เรื่องล่าสุดในบ้าน"
          action="ดูทั้งหมด"
          onPress={() => router.push('/activity')}
        />
        <Card>
          {activity.length ? (
            activity.map((a, i) => (
              <View
                key={a.id}
                style={{
                  flexDirection: 'row',
                  gap: 12,
                  paddingVertical: 8,
                  borderBottomWidth: i === activity.length - 1 ? 0 : 1,
                  borderBottomColor: colors.line,
                }}
              >
                <Label style={{ fontSize: 21 }}>{a.emoji}</Label>
                <View style={{ flex: 1 }}>
                  <Label>{a.text}</Label>
                  <Small>ในบ้านตัวอย่าง · ล่าสุด</Small>
                </View>
                <ArrowUpRight size={17} color={colors.muted} />
              </View>
            ))
          ) : (
            <Small>ยังไม่มีกิจกรรมในบ้านนี้</Small>
          )}
        </Card>
      </MotionIn>
      <Small style={{ textAlign: 'center', marginTop: 22 }}>
        ข้อมูลเดโมไม่เชื่อมบัญชีธนาคารหรือบริการภายนอก
      </Small>
    </Page>
  );
}
