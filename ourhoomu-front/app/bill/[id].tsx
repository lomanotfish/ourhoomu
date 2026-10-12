import React, { useState } from 'react';
import { KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowUpRight, Clock3, Info, ReceiptText, X } from 'lucide-react-native';
import {
  Button,
  Card,
  Empty,
  Field,
  Label,
  Page,
  Pill,
  Small,
  Tap,
  Title,
  useReducedMotion,
} from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { availableToRequest, confirmedRemaining, formatBaht, parseSatang } from '@/demo/money';
import { colors } from '@/theme/tokens';

export default function BillDetail() {
  const router = useRouter();
  const reduced = useReducedMotion();
  const { id } = useLocalSearchParams<{ id: string }>();
  const { bills, house, memberId, requestPayment, cancelPayment } = useDemo();
  const [sheet, setSheet] = useState(false);
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState<'cash' | 'transfer_demo'>('cash');
  const [error, setError] = useState('');
  const bill = bills.find((b) => b.id === id);
  if (!bill)
    return (
      <Page back title="ไม่พบบิล">
        <Empty
          emoji="🔎"
          title="บิลนี้ไม่มีในบ้านที่เลือก"
          detail="ลองเปลี่ยนบ้านหรือกลับไปดูรายการบิล"
        />
        <Button
          title="กลับไปหน้าบิล"
          onPress={() => router.replace('/(tabs)/bills')}
          style={{ marginTop: 16 }}
        />
      </Page>
    );
  const name = (memberId: string) => house.members.find((m) => m.id === memberId)?.name ?? 'สมาชิก';
  const available = availableToRequest(bill, memberId);
  const myRemaining = confirmedRemaining(bill, memberId);
  const myShare = bill.shares.find((s) => s.memberId === memberId);
  const pending = bill.payments
    .filter((p) => p.payerId === memberId)
    .reduce((sum, p) => sum + p.amountSatang, 0);
  const submit = () => {
    const satang = parseSatang(amount);
    if (!satang || satang > available) {
      setError(`กรอกยอดมากกว่า 0 และไม่เกิน ${formatBaht(available)}`);
      return;
    }
    try {
      requestPayment(bill.id, satang, method);
      setSheet(false);
      setAmount('');
      setError('');
    } catch {
      setError('ยอดที่ขอจ่ายไม่พร้อม ลองเปิดบิลใหม่อีกครั้ง');
    }
  };
  return (
    <Page back>
      <Pill tone="peach">บิลตัวอย่าง · ไม่มีการจ่ายจริง</Pill>
      <Title style={{ marginTop: 14 }}>
        {bill.emoji} {bill.title}
      </Title>
      <Small>
        สร้างโดย {name(bill.creatorId)} · ผู้รับเงิน {name(bill.recipientId)}
      </Small>
      <Small>ครบกำหนด {bill.dueDate ?? 'ยังไม่กำหนด'} · บัญชีปลายทางตัวอย่าง •••• 3184</Small>
      <Card style={{ backgroundColor: colors.peach, borderWidth: 0, marginTop: 20 }}>
        <Small style={{ color: colors.coralDark }}>ยอดค่าใช้จ่าย</Small>
        <Title style={{ fontSize: 36, lineHeight: 48 }}>{formatBaht(bill.amountSatang)}</Title>
        <Small>ผู้รับเงินเป็นคนออกค่าใช้จ่ายไว้ก่อน</Small>
      </Card>
      <View style={{ flexDirection: 'row', gap: 10, marginTop: 11 }}>
        <Card style={{ flex: 1, minWidth: 0 }}>
          <Small>ส่วนของคุณ</Small>
          <Label style={{ fontWeight: '700', fontSize: 19 }}>
            {formatBaht(myShare?.amountSatang ?? 0)}
          </Label>
        </Card>
        <Card style={{ flex: 1, minWidth: 0 }}>
          <Small>ค้างยืนยัน</Small>
          <Label style={{ fontWeight: '700', fontSize: 19 }}>{formatBaht(myRemaining)}</Label>
        </Card>
      </View>
      {pending > 0 && (
        <Card style={{ backgroundColor: colors.butter, borderWidth: 0, marginTop: 10 }}>
          <Label style={{ fontWeight: '700' }}>มีคำขอรอ {formatBaht(pending)}</Label>
          <Small>
            ยอดค้างยังไม่ลด เงินสดรอผู้สร้างบิลยืนยัน ส่วนโอนเดโมยังไม่มี SlipOK หรือสลิปจริง
          </Small>
        </Card>
      )}
      {available > 0 && (
        <Button
          title="แจ้งจ่ายบางส่วน / ทั้งหมด"
          icon={ArrowUpRight}
          onPress={() => {
            setAmount((available / 100).toFixed(2));
            setSheet(true);
          }}
          style={{ marginTop: 16 }}
        />
      )}
      {myShare && bill.recipientId === memberId && (
        <Card style={{ backgroundColor: colors.mint, borderWidth: 0, marginTop: 15 }}>
          <Label style={{ fontWeight: '700' }}>ส่วนของคุณออกเองแล้ว</Label>
          <Small>ส่วนของผู้รับเงินไม่สร้างยอดให้โอนกลับตัวเอง</Small>
        </Card>
      )}
      <View style={{ marginTop: 29 }}>
        <Label style={{ fontSize: 18, fontWeight: '700', marginBottom: 9 }}>
          ใครรับผิดชอบเท่าไร
        </Label>
        <Card>
          {bill.shares.map((share, index) => (
            <View
              key={share.memberId}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                paddingVertical: 9,
                gap: 9,
                borderBottomWidth: index === bill.shares.length - 1 ? 0 : 1,
                borderBottomColor: colors.line,
              }}
            >
              <View
                style={{
                  width: 38,
                  height: 38,
                  borderRadius: 14,
                  backgroundColor: colors.mint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Label style={{ fontWeight: '700' }}>{name(share.memberId).slice(0, 1)}</Label>
              </View>
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>
                  {name(share.memberId)} {share.memberId === bill.recipientId ? '· ออกเอง' : ''}
                </Label>
                <Small>{(share.bps / 100).toFixed(2)}%</Small>
              </View>
              <Label style={{ fontWeight: '700' }}>{formatBaht(share.amountSatang)}</Label>
            </View>
          ))}
        </Card>
      </View>
      <View style={{ marginTop: 25 }}>
        <Label style={{ fontSize: 18, fontWeight: '700', marginBottom: 9 }}>รายการจ่าย</Label>
        {bill.payments.length ? (
          bill.payments.map((p) => (
            <Card key={p.id} style={{ marginBottom: 9 }}>
              <View style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}>
                <Clock3 size={20} color={colors.coral} />
                <View style={{ flex: 1 }}>
                  <Label style={{ fontWeight: '700' }}>
                    {formatBaht(p.amountSatang)} · {p.method === 'cash' ? 'เงินสด' : 'โอนตัวอย่าง'}
                  </Label>
                  <Small>
                    {name(p.payerId)} ·{' '}
                    {p.status === 'awaiting_confirmation'
                      ? 'รอผู้สร้างบิลยืนยันเมื่อเชื่อมข้อมูลจริง'
                      : 'รอตรวจ · เดโมไม่ส่ง SlipOK'}
                  </Small>
                </View>
              </View>
              {p.payerId === memberId && (
                <Tap
                  onPress={() => cancelPayment(bill.id, p.id)}
                  accessibilityLabel="ถอนคำขอที่รออยู่"
                  style={{ alignSelf: 'flex-end', marginTop: 9 }}
                >
                  <Small style={{ color: colors.coralDark, fontWeight: '700' }}>ถอนคำขอ</Small>
                </Tap>
              )}
            </Card>
          ))
        ) : (
          <Empty
            emoji="🌼"
            title="ยังไม่มีรายการจ่าย"
            detail="เมื่อมีคนแจ้งจ่าย รายการที่รอจะปรากฏตรงนี้"
          />
        )}
      </View>
      <Card
        style={{
          backgroundColor: colors.blue,
          borderWidth: 0,
          marginTop: 20,
          flexDirection: 'row',
          gap: 10,
        }}
      >
        <Info size={20} color={colors.cocoa} />
        <Small style={{ flex: 1, color: colors.cocoa }}>
          นี่เป็นรายการตัวอย่างในเครื่อง ยังไม่ส่งสลิปหรือตรวจเงินโอนจริง ยอดค้างจึงยังไม่ลดลง
          ในภายหลัง
        </Small>
      </Card>
      <Modal
        transparent
        visible={sheet}
        animationType={reduced ? 'none' : 'slide'}
        onRequestClose={() => setSheet(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: '#2A1F1B66' }}
        >
          <Pressable
            style={{ flex: 1 }}
            onPress={() => setSheet(false)}
            accessibilityLabel="ปิดหน้าจ่ายเงิน"
          />
          <View
            style={{
              backgroundColor: colors.cream,
              borderTopLeftRadius: 29,
              borderTopRightRadius: 29,
              width: '100%',
              maxWidth: 680,
              maxHeight: '88%',
              alignSelf: 'center',
            }}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ padding: 22, paddingBottom: 38 }}
            >
              <View
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginBottom: 8,
                }}
              >
                <Title style={{ fontSize: 23 }}>แจ้งการจ่าย</Title>
                <Tap
                  onPress={() => setSheet(false)}
                  accessibilityLabel="ปิด"
                  style={{ width: 44, alignItems: 'center' }}
                >
                  <X size={22} color={colors.cocoa} />
                </Tap>
              </View>
              <Small style={{ marginBottom: 17 }}>
                ส่งคำขอตัวอย่างเท่านั้น · จ่ายได้สูงสุด {formatBaht(available)}
              </Small>
              <Field
                label="จำนวนเงิน (บาท)"
                keyboardType="decimal-pad"
                value={amount}
                onChangeText={(value) => {
                  setAmount(value);
                  setError('');
                }}
                error={error}
              />
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 16 }}>
                <View style={{ flex: 1 }}>
                  <Button
                    title="เงินสด"
                    tone={method === 'cash' ? 'primary' : 'outline'}
                    onPress={() => setMethod('cash')}
                  />
                </View>
                <View style={{ flex: 1 }}>
                  <Button
                    title="โอนตัวอย่าง"
                    tone={method === 'transfer_demo' ? 'primary' : 'outline'}
                    onPress={() => setMethod('transfer_demo')}
                  />
                </View>
              </View>
              <Small style={{ marginVertical: 15 }}>
                {method === 'cash'
                  ? 'คำขอตัวอย่างจะอยู่ในสถานะรอ การยืนยันเงินจริงจะพร้อมเมื่อเชื่อมต่อบริการ'
                  : 'ไม่มีการโอนหรืออัปโหลดสลิปจริง สถานะจะค้างรอการตรวจ'}
              </Small>
              <Button title="ส่งคำขอตัวอย่าง" onPress={submit} />
              <Tap
                onPress={() => setSheet(false)}
                accessibilityLabel="ยกเลิก"
                style={{ alignItems: 'center', marginTop: 8 }}
              >
                <Small>ยกเลิก</Small>
              </Tap>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </Page>
  );
}
