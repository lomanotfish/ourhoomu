import React, { useEffect, useState } from 'react';
import { View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { Plus, ReceiptText } from 'lucide-react-native';
import {
  AppHeader,
  Button,
  Card,
  DemoBadge,
  Empty,
  Label,
  MotionIn,
  Page,
  Pill,
  Small,
  Tap,
  Title,
} from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { confirmedRemaining, formatBaht } from '@/demo/money';
import { colors } from '@/theme/tokens';

type Filter = 'all' | 'mine' | 'pending';
export default function Bills() {
  const router = useRouter();
  const { filter: param } = useLocalSearchParams<{ filter?: string }>();
  const { bills, memberId, house } = useDemo();
  const [filter, setFilter] = useState<Filter>('all');
  useEffect(() => {
    if (param === 'mine' || param === 'pending') setFilter(param);
  }, [param]);
  const visible = bills.filter(
    (b) =>
      filter === 'all' ||
      (filter === 'mine' && confirmedRemaining(b, memberId) > 0) ||
      (filter === 'pending' && b.payments.length > 0),
  );
  const filters: { id: Filter; label: string }[] = [
    { id: 'all', label: 'ทั้งหมด' },
    { id: 'mine', label: 'ที่ต้องจ่าย' },
    { id: 'pending', label: 'รอดำเนินการ' },
  ];
  return (
    <Page>
      <AppHeader eyebrow="ค่าใช้จ่ายของบ้าน" />
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
            <Title>บิลของเรา</Title>
            <Small>ตกลงกันง่าย ๆ เรื่องเงิน</Small>
          </View>
          <View style={{ width: 48 }}>
            <Tap
              onPress={() => router.push('/bill/new')}
              accessibilityLabel="เพิ่มบิล"
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
        </View>
      </MotionIn>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: 18 }}>
        {filters.map((item) => (
          <Tap
            key={item.id}
            onPress={() => setFilter(item.id)}
            accessibilityLabel={`กรอง${item.label}`}
            style={{
              backgroundColor: filter === item.id ? colors.cocoa : colors.paper,
              borderRadius: 999,
              paddingHorizontal: 15,
              minHeight: 42,
              borderWidth: 1,
              borderColor: filter === item.id ? colors.cocoa : colors.line,
            }}
          >
            <Small
              style={{ color: filter === item.id ? colors.paper : colors.cocoa, fontWeight: '700' }}
            >
              {item.label}
            </Small>
          </Tap>
        ))}
      </View>
      {visible.length ? (
        visible.map((bill, index) => {
          const recipient = house.members.find((m) => m.id === bill.recipientId)?.name ?? 'สมาชิก';
          const myShare = bill.shares.find((s) => s.memberId === memberId);
          return (
            <MotionIn key={bill.id} delay={Math.min(index * 65, 250)} style={{ marginBottom: 11 }}>
              <Tap
                onPress={() => router.push({ pathname: '/bill/[id]', params: { id: bill.id } })}
                accessibilityLabel={`ดูบิล${bill.title}`}
              >
                <Card style={{ flexDirection: 'row', alignItems: 'center', gap: 13 }}>
                  <View
                    style={{
                      width: 54,
                      height: 54,
                      borderRadius: 18,
                      backgroundColor: colors.peach,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Label style={{ fontSize: 27 }}>{bill.emoji}</Label>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Label numberOfLines={1} style={{ fontWeight: '700', fontSize: 16 }}>
                      {bill.title}
                    </Label>
                    <Small>
                      รับเงิน: {recipient} · ครบ {bill.dueDate ?? 'ไม่กำหนด'}
                    </Small>
                    <View style={{ marginTop: 6 }}>
                      <Pill tone={bill.payments.length ? 'butter' : 'mint'}>
                        {bill.payments.length
                          ? 'มีรายการรอ'
                          : myShare && bill.recipientId !== memberId
                            ? 'ยังค้างชำระ'
                            : 'ดูรายละเอียด'}
                      </Pill>
                    </View>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Label style={{ fontWeight: '700' }}>{formatBaht(bill.amountSatang)}</Label>
                    <Small>ยอดบิล</Small>
                  </View>
                </Card>
              </Tap>
            </MotionIn>
          );
        })
      ) : (
        <Empty
          emoji="🧾"
          title={filter === 'all' ? 'ยังไม่มีบิล' : 'ไม่มีบิลในหมวดนี้'}
          detail="ลองเพิ่มบิลหรือเลือกตัวกรองอื่น"
        />
      )}
      <Card
        style={{
          marginTop: 13,
          backgroundColor: colors.mint,
          borderWidth: 0,
          flexDirection: 'row',
          gap: 11,
        }}
      >
        <ReceiptText size={22} color={colors.mintDark} />
        <Small style={{ flex: 1, color: colors.cocoa }}>
          เดโมนี้คำนวณส่วนแบ่งบนเครื่อง เงินที่รอตรวจไม่ลดหนี้จน API ยืนยันจริง
        </Small>
      </Card>
    </Page>
  );
}
