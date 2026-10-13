import React, { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowDown, ArrowUp, CalendarDays, Check, RotateCw } from 'lucide-react-native';
import { Button, Card, Field, Label, Page, Small, Tap } from '@/components/ui';
import { ChoreDatePicker } from '@/components/chore-date-picker';
import { parseChoreDate } from '@/components/chore-date';
import { previewChores, useDemo } from '@/demo/repository';
import { dateOffset } from '@/demo/seed';
import type { ChoreMode } from '@/demo/types';
import { colors } from '@/theme/tokens';

const weekdays = [
  { id: 0, label: 'อา' },
  { id: 1, label: 'จ' },
  { id: 2, label: 'อ' },
  { id: 3, label: 'พ' },
  { id: 4, label: 'พฤ' },
  { id: 5, label: 'ศ' },
  { id: 6, label: 'ส' },
];
export default function NewChore() {
  const router = useRouter();
  const { house, memberId, createChores } = useDemo();
  const [title, setTitle] = useState('');
  const [date, setDate] = useState(dateOffset(0));
  const [mode, setMode] = useState<ChoreMode>('manual');
  const [assignees, setAssignees] = useState<string[]>([memberId]);
  const [days, setDays] = useState<number[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const input = useMemo(
    () => ({ title, emoji: '🧹', startDate: date, mode, assigneeIds: assignees, weekdays: days }),
    [title, date, mode, assignees, days],
  );
  const dateIsValid = Boolean(parseChoreDate(date));
  const preview = dateIsValid ? previewChores(input) : [];
  const valid =
    title.trim().length > 0 && dateIsValid && assignees.length > 0 && preview.length > 0;
  const toggleAssignee = (id: string) =>
    setAssignees((current) =>
      current.includes(id) ? current.filter((x) => x !== id) : [...current, id],
    );
  const moveAssignee = (id: string, direction: -1 | 1) =>
    setAssignees((current) => {
      const next = [...current];
      const index = next.indexOf(id);
      const target = index + direction;
      if (index < 0 || target < 0 || target >= next.length) return current;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  const submit = () => {
    setSubmitted(true);
    if (!valid) return;
    createChores(input);
    router.back();
  };
  return (
    <Page back title="เพิ่มตารางเวร">
      <Small style={{ marginTop: -11, marginBottom: 20 }}>
        จัดงานเล็ก ๆ ให้บ้านเป็นระเบียบขึ้น
      </Small>
      <View style={{ gap: 17 }}>
        <Field
          label="ชื่องาน"
          placeholder="เช่น กวาดห้องนั่งเล่น"
          value={title}
          onChangeText={setTitle}
          maxLength={60}
          error={submitted && !title.trim() ? 'กรุณาใส่ชื่องาน' : undefined}
        />
        <View>
          <Label style={{ fontWeight: '700', marginBottom: 7 }}>รูปแบบตาราง</Label>
          <View style={{ gap: 8 }}>
            {(
              [
                { id: 'manual', label: 'จัดเอง · ครั้งเดียว', Icon: CalendarDays },
                { id: 'repeat', label: 'ทำซ้ำ · คนเดิม', Icon: RotateCw },
                { id: 'rotation', label: 'หมุนเวียน · เรียงตามสมาชิก', Icon: RotateCw },
              ] as const
            ).map((item) => (
              <Tap
                key={item.id}
                onPress={() => {
                  setMode(item.id);
                  if (item.id !== 'rotation' && assignees.length > 1) setAssignees([assignees[0]]);
                }}
                accessibilityLabel={item.label}
                style={{
                  minHeight: 52,
                  backgroundColor: mode === item.id ? colors.mint : colors.paper,
                  borderColor: mode === item.id ? colors.mintDark : colors.line,
                  borderWidth: 1,
                  borderRadius: 15,
                  paddingHorizontal: 14,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 9,
                }}
              >
                <item.Icon size={20} color={mode === item.id ? colors.mintDark : colors.muted} />
                <Label style={{ flex: 1, fontWeight: mode === item.id ? '700' : '400' }}>
                  {item.label}
                </Label>
                {mode === item.id && <Check size={18} color={colors.mintDark} />}
              </Tap>
            ))}
          </View>
        </View>
        <ChoreDatePicker
          label={mode === 'manual' ? 'วันที่ทำ' : 'วันเริ่ม'}
          value={date}
          onChange={setDate}
          error={submitted && !dateIsValid ? 'กรุณาเลือกวันที่' : undefined}
        />
        <View>
          <Label style={{ fontWeight: '700', marginBottom: 7 }}>
            {mode === 'rotation' ? 'ลำดับคนรับเวร' : 'คนรับเวร'}
          </Label>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {house.members.map((m) => (
              <Tap
                key={m.id}
                selected={assignees.includes(m.id)}
                onPress={() => (mode === 'rotation' ? toggleAssignee(m.id) : setAssignees([m.id]))}
                accessibilityLabel={`เลือก${m.name}`}
                style={{
                  minHeight: 44,
                  borderRadius: 14,
                  backgroundColor: assignees.includes(m.id) ? colors.peach : colors.paper,
                  borderWidth: 1,
                  borderColor: assignees.includes(m.id) ? colors.coral : colors.line,
                  paddingHorizontal: 13,
                }}
              >
                <Label>
                  {mode === 'rotation' && assignees.includes(m.id)
                    ? `${assignees.indexOf(m.id) + 1}. `
                    : ''}
                  {m.name}
                </Label>
              </Tap>
            ))}
          </View>
          {submitted && !assignees.length && (
            <Small style={{ color: colors.error }}>เลือกอย่างน้อยหนึ่งคน</Small>
          )}
          {mode === 'rotation' && assignees.length > 1 && (
            <View style={{ marginTop: 9, gap: 6 }}>
              {assignees.map((id, index) => (
                <View key={id} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                  <Small style={{ flex: 1 }}>
                    {index + 1}. {house.members.find((m) => m.id === id)?.name}
                  </Small>
                  <Tap
                    disabled={index === 0}
                    onPress={() => moveAssignee(id, -1)}
                    accessibilityLabel={`เลื่อน${house.members.find((m) => m.id === id)?.name}ขึ้น`}
                    style={{ width: 44, alignItems: 'center' }}
                  >
                    <ArrowUp size={19} color={colors.cocoa} />
                  </Tap>
                  <Tap
                    disabled={index === assignees.length - 1}
                    onPress={() => moveAssignee(id, 1)}
                    accessibilityLabel={`เลื่อน${house.members.find((m) => m.id === id)?.name}ลง`}
                    style={{ width: 44, alignItems: 'center' }}
                  >
                    <ArrowDown size={19} color={colors.cocoa} />
                  </Tap>
                </View>
              ))}
            </View>
          )}
          {mode === 'rotation' && (
            <Small style={{ marginTop: 5 }}>แตะเพื่อเลือกคน แล้วใช้ลูกศรจัดลำดับ</Small>
          )}
        </View>
        {mode !== 'manual' && (
          <View>
            <Label style={{ fontWeight: '700', marginBottom: 7 }}>วันที่ทำซ้ำ</Label>
            <Small style={{ marginBottom: 7 }}>ไม่เลือก = ทุกวัน · เลือกได้หลายวันในสัปดาห์</Small>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {weekdays.map((w) => (
                <Tap
                  key={w.id}
                  selected={days.includes(w.id)}
                  onPress={() =>
                    setDays((current) =>
                      current.includes(w.id)
                        ? current.filter((x) => x !== w.id)
                        : [...current, w.id],
                    )
                  }
                  accessibilityLabel={`เลือกวัน${w.label}`}
                  style={{
                    minWidth: 44,
                    alignItems: 'center',
                    minHeight: 44,
                    borderRadius: 12,
                    backgroundColor: days.includes(w.id) ? colors.cocoa : colors.paper,
                    borderWidth: 1,
                    borderColor: colors.line,
                  }}
                >
                  <Small
                    style={{
                      color: days.includes(w.id) ? colors.paper : colors.cocoa,
                      fontWeight: '700',
                    }}
                  >
                    {w.label}
                  </Small>
                </Tap>
              ))}
            </View>
          </View>
        )}
        <Card style={{ backgroundColor: colors.butter, borderWidth: 0 }}>
          <Label style={{ fontWeight: '700', marginBottom: 8 }}>
            ตัวอย่าง {mode === 'manual' ? 'งานนี้' : '2 สัปดาห์ข้างหน้า'}
          </Label>
          {preview.length ? (
            preview.slice(0, 7).map((item, index) => (
              <View
                key={`${item.date}-${index}`}
                style={{
                  flexDirection: 'row',
                  justifyContent: 'space-between',
                  borderTopWidth: index ? 1 : 0,
                  borderTopColor: '#EADBA9',
                  paddingVertical: 5,
                  gap: 10,
                }}
              >
                <Small>{item.date}</Small>
                <Small style={{ fontWeight: '700', color: colors.cocoa }}>
                  {house.members.find((m) => m.id === item.assigneeId)?.name ?? 'สมาชิก'}
                </Small>
              </View>
            ))
          ) : (
            <Small>เลือกวันและคนรับเวรเพื่อดูตัวอย่าง</Small>
          )}
          {preview.length > 7 && <Small>และอีก {preview.length - 7} ครั้ง</Small>}
        </Card>
        <Button title="บันทึกตารางตัวอย่าง" onPress={submit} />
        <Small style={{ textAlign: 'center' }}>
          เดโมสร้างรายการล่วงหน้า 14 วัน และเริ่มใหม่เมื่อโหลดซ้ำ
        </Small>
      </View>
    </Page>
  );
}
