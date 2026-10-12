import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, ReceiptText } from 'lucide-react-native';
import { Button, Card, Field, Label, Page, Pill, Small, Tap, Title } from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { allocateShares, equalBps, formatBaht, parseBps, parseSatang } from '@/demo/money';
import { dateOffset } from '@/demo/seed';
import { colors } from '@/theme/tokens';

function validDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00`);
  return (
    !Number.isNaN(date.getTime()) &&
    `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}` ===
      value
  );
}

export default function NewBill() {
  const router = useRouter();
  const { house, memberId, createBill } = useDemo();
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState(dateOffset(7));
  const [recipientId, setRecipientId] = useState(memberId);
  const [selected, setSelected] = useState<string[]>(house.members.map((m) => m.id));
  const [mode, setMode] = useState<'equal' | 'custom'>('equal');
  const [percents, setPercents] = useState<Record<string, string>>({});
  const [submitted, setSubmitted] = useState(false);
  const satang = parseSatang(amount);
  const bps = useMemo(
    () =>
      mode === 'equal'
        ? equalBps(selected)
        : Object.fromEntries(selected.map((id) => [id, parseBps(percents[id] ?? '') ?? 0])),
    [mode, selected, percents],
  );
  const sum = Object.values(bps).reduce((a, b) => a + b, 0);
  const valid =
    title.trim().length > 0 &&
    !!satang &&
    validDate(dueDate) &&
    selected.length > 0 &&
    sum === 10000 &&
    selected.every((id) => bps[id] > 0);
  const shares = valid && satang ? allocateShares(satang, bps) : [];
  const toggle = (id: string) =>
    setSelected((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const submit = () => {
    setSubmitted(true);
    if (!valid || !satang) return;
    const id = createBill({
      title,
      emoji: '🧾',
      amountSatang: satang,
      dueDate,
      recipientId,
      bpsByMember: bps,
    });
    router.replace({ pathname: '/bill/[id]', params: { id } });
  };
  return (
    <Page back title="เพิ่มบิลใหม่">
      <Small style={{ marginTop: -10, marginBottom: 21 }}>
        ลองบันทึกบิลในบ้านตัวอย่าง · ไม่มีการโอนเงินจริง
      </Small>
      <View style={{ gap: 17 }}>
        <Field
          label="ชื่อบิล"
          placeholder="เช่น ของเข้าบ้าน"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          error={submitted && !title.trim() ? 'กรุณาใส่ชื่อบิล' : undefined}
        />
        <Field
          label="ยอดรวม (บาท)"
          placeholder="0.00"
          keyboardType="decimal-pad"
          value={amount}
          onChangeText={setAmount}
          error={submitted && !satang ? 'กรอกยอดมากกว่า 0 และทศนิยมไม่เกิน 2 ตำแหน่ง' : undefined}
        />
        <Field
          label="วันครบกำหนด (YYYY-MM-DD)"
          value={dueDate}
          onChangeText={setDueDate}
          error={submitted && !validDate(dueDate) ? 'ใช้วันที่จริงในรูปแบบ YYYY-MM-DD' : undefined}
        />
        <View>
          <Label style={{ fontWeight: '700', marginBottom: 7 }}>
            คนที่ออกเงินก่อน / ผู้รับเงินคืน
          </Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {house.members.map((m) => (
              <Tap
                key={m.id}
                onPress={() => setRecipientId(m.id)}
                selected={recipientId === m.id}
                accessibilityLabel={`เลือก${m.name}เป็นผู้รับเงิน`}
                style={{
                  minHeight: 44,
                  backgroundColor: recipientId === m.id ? colors.mint : colors.paper,
                  borderWidth: 1,
                  borderColor: recipientId === m.id ? colors.mintDark : colors.line,
                  borderRadius: 14,
                  paddingHorizontal: 15,
                }}
              >
                <Label style={{ fontWeight: recipientId === m.id ? '700' : '400' }}>
                  {m.name}
                  {recipientId === m.id ? ' ✓' : ''}
                </Label>
              </Tap>
            ))}
          </View>
          <Small style={{ marginTop: 5 }}>บัญชีปลายทางตัวอย่าง •••• 3184 · ไม่ใช้โอนจริง</Small>
          <Small>ถ้าเลือกคนอื่น เดโมจะถือว่าคนนั้นออกเงินทั้งหมดก่อน</Small>
        </View>
        <View>
          <Label style={{ fontWeight: '700', marginBottom: 7 }}>สมาชิกที่หาร</Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {house.members.map((m) => (
              <Tap
                key={m.id}
                onPress={() => toggle(m.id)}
                accessibilityLabel={`${selected.includes(m.id) ? 'เอา' : 'เพิ่ม'}${m.name}${selected.includes(m.id) ? 'ออกจาก' : 'ใน'}ผู้หาร`}
                style={{
                  minHeight: 44,
                  backgroundColor: selected.includes(m.id) ? colors.peach : colors.paper,
                  borderWidth: 1,
                  borderColor: selected.includes(m.id) ? colors.coral : colors.line,
                  borderRadius: 14,
                  paddingHorizontal: 15,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 5,
                }}
              >
                <Label>{m.name}</Label>
                {selected.includes(m.id) && <Check size={15} color={colors.coralDark} />}
              </Tap>
            ))}
          </View>
          {submitted && !selected.length && (
            <Small style={{ color: colors.error }}>เลือกอย่างน้อยหนึ่งคน</Small>
          )}
        </View>
        <View>
          <Label style={{ fontWeight: '700', marginBottom: 7 }}>วิธีหาร</Label>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {(
              [
                { id: 'equal', label: 'หารเท่ากัน' },
                { id: 'custom', label: 'กำหนด % เอง' },
              ] as const
            ).map((item) => (
              <View key={item.id} style={{ flex: 1 }}>
                <Button
                  title={item.label}
                  tone={mode === item.id ? 'primary' : 'outline'}
                  onPress={() => {
                    setMode(item.id);
                    if (item.id === 'custom') {
                      const next = equalBps(selected);
                      setPercents(
                        Object.fromEntries(
                          Object.entries(next).map(([id, b]) => [id, (b / 100).toFixed(2)]),
                        ),
                      );
                    }
                  }}
                />
              </View>
            ))}
          </View>
        </View>
        {mode === 'custom' &&
          selected.map((id) => (
            <Field
              key={id}
              label={`${house.members.find((m) => m.id === id)?.name ?? 'สมาชิก'} (%)`}
              keyboardType="decimal-pad"
              value={percents[id] ?? ''}
              onChangeText={(value) => setPercents((p) => ({ ...p, [id]: value }))}
              error={submitted && !bps[id] ? 'กรอกเปอร์เซ็นต์มากกว่า 0' : undefined}
            />
          ))}
        <Card style={{ backgroundColor: colors.butter, borderWidth: 0 }}>
          <Label style={{ fontWeight: '700' }}>
            ผลรวม {mode === 'equal' ? '100.00' : (sum / 100).toFixed(2)}%
          </Label>
          <Small style={{ color: sum === 10000 ? colors.cocoa : colors.error }}>
            {sum === 10000
              ? 'ครบ 100% พร้อมดูตัวอย่าง'
              : `ต้องครบ 100.00% ตอนนี้${sum < 10000 ? 'ขาด' : 'เกิน'} ${(Math.abs(10000 - sum) / 100).toFixed(2)}%`}
          </Small>
        </Card>
        <Card>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 }}>
            <ReceiptText size={19} color={colors.coral} />
            <Label style={{ fontWeight: '700', fontSize: 17 }}>ตัวอย่างก่อนบันทึก</Label>
          </View>
          {valid ? (
            <>
              <Label style={{ fontSize: 21, fontWeight: '700' }}>{formatBaht(satang!)}</Label>
              <Small>ครบกำหนด {dueDate} · บัญชีปลายทางตัวอย่าง •••• 3184</Small>
              {shares.map((s) => {
                const m = house.members.find((m) => m.id === s.memberId);
                return (
                  <View
                    key={s.memberId}
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      gap: 10,
                      borderTopWidth: 1,
                      borderTopColor: colors.line,
                      paddingVertical: 9,
                    }}
                  >
                    <Small style={{ flex: 1 }}>
                      {m?.name} · {(s.bps / 100).toFixed(2)}%
                      {s.memberId === recipientId ? ' · ออกเอง' : ' · ต้องคืนผู้รับ'}
                    </Small>
                    <Label style={{ fontWeight: '700' }}>{formatBaht(s.amountSatang)}</Label>
                  </View>
                );
              })}
              <Pill tone="mint">
                ผู้รับเงินออกส่วนตัวเอง{' '}
                {formatBaht(shares.find((s) => s.memberId === recipientId)?.amountSatang ?? 0)}
              </Pill>
            </>
          ) : (
            <Small>กรอกชื่อ ยอด ผู้หาร และเปอร์เซ็นต์ให้ครบเพื่อดูยอดรายคน</Small>
          )}
        </Card>
        <Button title="บันทึกบิลตัวอย่าง" onPress={submit} />
        <Small style={{ textAlign: 'center' }}>บิลจริงต้องให้ API คำนวณและยืนยันอีกครั้ง</Small>
      </View>
    </Page>
  );
}
