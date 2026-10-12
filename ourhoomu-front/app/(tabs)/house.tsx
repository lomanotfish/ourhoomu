import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, House, LogOut, Settings2, Users } from 'lucide-react-native';
import {
  AppHeader,
  Button,
  Card,
  DemoBadge,
  Field,
  Label,
  MotionIn,
  Page,
  Pill,
  RowLink,
  SectionHead,
  Small,
  Tap,
  Title,
} from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { colors } from '@/theme/tokens';

export default function HouseTab() {
  const router = useRouter();
  const { house, state, memberId, renameHouse, reset } = useDemo();
  const owner = house.members.find((m) => m.id === memberId)?.role === 'owner';
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(house.name);
  const [error, setError] = useState('');
  const [confirmReset, setConfirmReset] = useState(false);
  return (
    <Page>
      <AppHeader eyebrow="คนสำคัญในบ้าน" />
      <MotionIn>
        <DemoBadge />
        <View style={{ marginTop: 14, marginBottom: 18 }}>
          <Title>บ้านของเรา</Title>
          <Small>พื้นที่เล็ก ๆ ที่ทุกคนช่วยกันดูแล</Small>
        </View>
      </MotionIn>
      <MotionIn delay={70}>
        <Card style={{ backgroundColor: colors.peach, borderWidth: 0 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <View
              style={{
                width: 62,
                height: 62,
                borderRadius: 21,
                backgroundColor: colors.paper,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <House size={31} color={colors.coralDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ fontSize: 22, fontWeight: '700' }}>{house.name}</Label>
              <Small style={{ color: colors.cocoa }}>{house.subtitle}</Small>
            </View>
          </View>
          <View style={{ flexDirection: 'row', gap: 7, marginTop: 16 }}>
            <Pill tone="mint">{house.members.length} สมาชิก</Pill>
            <Pill tone="butter">{state.houses.length} บ้านในเดโม</Pill>
          </View>
        </Card>
      </MotionIn>
      <MotionIn delay={130} style={{ marginTop: 27 }}>
        <SectionHead title="สมาชิกในบ้าน" />
        <Card>
          {house.members.map((member, index) => (
            <View
              key={member.id}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 12,
                paddingVertical: 9,
                borderBottomWidth: index === house.members.length - 1 ? 0 : 1,
                borderBottomColor: colors.line,
              }}
            >
              <View
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 16,
                  backgroundColor: index % 2 ? colors.peach : colors.mint,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Label style={{ fontWeight: '700', fontSize: 17 }}>{member.avatar}</Label>
              </View>
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>
                  {member.name}
                  {member.id === memberId ? ' · คุณ' : ''}
                </Label>
                <Small>{member.role === 'owner' ? 'เจ้าของบ้าน' : 'สมาชิก'}</Small>
              </View>
            </View>
          ))}
        </Card>
      </MotionIn>
      <MotionIn delay={180} style={{ marginTop: 25 }}>
        <SectionHead title="จัดการบ้าน" />
        <Card>
          <RowLink
            title="เปลี่ยน / เพิ่มบ้าน"
            caption="สลับบ้าน สร้างบ้าน หรือเข้าร่วมเดโม"
            icon={House}
            onPress={() => router.push('/house/select')}
          />
          {owner && (
            <>
              <View style={{ height: 1, backgroundColor: colors.line }} />
              <RowLink
                title="แก้ชื่อบ้าน"
                caption="ชื่อเดโมของบ้านนี้"
                icon={Settings2}
                onPress={() => {
                  setName(house.name);
                  setEditing(!editing);
                }}
              />
            </>
          )}
          <View style={{ height: 1, backgroundColor: colors.line }} />
          <RowLink
            title="รหัสเข้าร่วมบ้าน"
            caption={`รหัสเดโม: ${house.inviteCode}`}
            icon={Users}
            onPress={() => router.push('/house/select')}
          />
        </Card>
        {editing && (
          <Card style={{ marginTop: 9, gap: 10 }}>
            <Field
              label="ชื่อบ้านใหม่"
              value={name}
              onChangeText={(value) => {
                setName(value);
                setError('');
              }}
              error={error}
              maxLength={40}
            />
            <Button
              title="บันทึกชื่อบ้าน"
              onPress={() => {
                if (!name.trim()) {
                  setError('ใส่ชื่อบ้านก่อนบันทึก');
                  return;
                }
                renameHouse(name);
                setEditing(false);
              }}
            />
            <Button title="ยกเลิก" tone="outline" onPress={() => setEditing(false)} />
          </Card>
        )}
      </MotionIn>
      <MotionIn delay={230} style={{ marginTop: 25 }}>
        <SectionHead title="ตั้งค่าและการเชื่อมต่อ" />
        <Card>
          <Label style={{ fontWeight: '700' }}>บัญชีรับเงินของมิว</Label>
          <Small>บัญชีตัวอย่าง •••• 3184 · ยังแก้หรือใช้โอนจริงไม่ได้</Small>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 13 }} />
          <Label style={{ fontWeight: '700' }}>LINE และการแจ้งเตือน</Label>
          <Small>ยังไม่เชื่อมต่อ LINE · การเปลี่ยนแปลงแสดงภายในแอปเท่านั้น</Small>
          <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 13 }} />
          <Label style={{ fontWeight: '700' }}>Google / Apple และข้อมูลบัญชี</Label>
          <Small>รอ API และ iOS build สำหรับเข้าสู่ระบบ ออกจากระบบ และขอลบบัญชีจริง</Small>
        </Card>
        <Card style={{ backgroundColor: colors.mint, borderWidth: 0, marginTop: 14 }}>
          <Label style={{ fontWeight: '700' }}>ข้อมูลเดโมอยู่ในหน่วยความจำ</Label>
          <Small style={{ color: colors.cocoa, marginTop: 4 }}>
            ปิดหรือโหลดแอปใหม่ ข้อมูลตัวอย่างเริ่มใหม่ ไม่มีการส่งข้อมูลไปเซิร์ฟเวอร์
          </Small>
        </Card>
        <Button
          title="เริ่มเดโมใหม่"
          tone="outline"
          onPress={() => setConfirmReset(true)}
          style={{ marginTop: 13 }}
        />
        {confirmReset && (
          <Card style={{ marginTop: 9, gap: 9, backgroundColor: colors.butter, borderWidth: 0 }}>
            <Label style={{ fontWeight: '700' }}>เริ่มข้อมูลตัวอย่างใหม่?</Label>
            <Small>บิล เวร และบ้านที่คุณเพิ่มในเดโมจะหายไป</Small>
            <Button
              title="ยืนยันเริ่มใหม่"
              onPress={() => {
                reset();
                router.replace('/');
              }}
            />
            <Button title="เก็บข้อมูลเดิม" tone="outline" onPress={() => setConfirmReset(false)} />
          </Card>
        )}
        <Button
          title="กลับหน้าเริ่มต้น"
          icon={LogOut}
          tone="outline"
          onPress={() => router.replace('/')}
          style={{ marginTop: 9 }}
        />
      </MotionIn>
    </Page>
  );
}
