import React, { useState } from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { Check, House, Plus, Users } from 'lucide-react-native';
import { Button, Card, Field, Label, Page, Pill, Small, Tap } from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { colors } from '@/theme/tokens';

export default function SelectHouse() {
  const router = useRouter();
  const { state, house, switchHouse, createHouse, joinHouse } = useDemo();
  const [form, setForm] = useState<'none' | 'create' | 'join'>('none');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const home = () => router.replace('/(tabs)');
  const create = () => {
    if (!name.trim()) {
      setError('กรุณาใส่ชื่อบ้าน');
      return;
    }
    createHouse(name);
    home();
  };
  const join = () => {
    if (!joinHouse(code)) {
      setError('รหัสตัวอย่างที่ใช้ได้คือ MINT');
      return;
    }
    home();
  };
  return (
    <Page back title="เลือกบ้าน">
      <Small style={{ marginTop: -10, marginBottom: 17 }}>
        คุณอยู่ได้หลายบ้าน เลือกบ้านที่อยากดูวันนี้
      </Small>
      {state.houses.map((item) => (
        <Tap
          key={item.id}
          onPress={() => {
            switchHouse(item.id);
            home();
          }}
          accessibilityLabel={`เลือก${item.name}`}
          style={{ marginBottom: 10 }}
        >
          <Card
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 13,
              borderColor: item.id === house.id ? colors.coral : colors.line,
            }}
          >
            <View
              style={{
                width: 49,
                height: 49,
                borderRadius: 16,
                backgroundColor: colors.peach,
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <House size={24} color={colors.coralDark} />
            </View>
            <View style={{ flex: 1 }}>
              <Label style={{ fontWeight: '700', fontSize: 17 }}>{item.name}</Label>
              <Small>
                {item.members.length} สมาชิก · {item.subtitle}
              </Small>
            </View>
            {item.id === house.id && <Check size={21} color={colors.coral} />}
          </Card>
        </Tap>
      ))}
      <View style={{ flexDirection: 'row', gap: 9, marginTop: 15 }}>
        <View style={{ flex: 1 }}>
          <Button
            title="สร้างบ้าน"
            icon={Plus}
            onPress={() => {
              setForm('create');
              setError('');
            }}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Button
            title="เข้าร่วม"
            icon={Users}
            tone="soft"
            onPress={() => {
              setForm('join');
              setError('');
            }}
          />
        </View>
      </View>
      {form === 'create' && (
        <Card style={{ marginTop: 14, gap: 10 }}>
          <Label style={{ fontWeight: '700' }}>บ้านใหม่ของคุณ</Label>
          <Field
            label="ชื่อบ้าน"
            placeholder="เช่น บ้านของเรา"
            value={name}
            onChangeText={(value) => {
              setName(value);
              setError('');
            }}
            error={error}
            maxLength={40}
          />
          <Button title="สร้างบ้านตัวอย่าง" onPress={create} />
          <Button title="ยกเลิก" tone="outline" onPress={() => setForm('none')} />
        </Card>
      )}
      {form === 'join' && (
        <Card style={{ marginTop: 14, gap: 10 }}>
          <Label style={{ fontWeight: '700' }}>เข้าร่วมบ้านตัวอย่าง</Label>
          <Small>ใช้รหัส MINT เพื่อลองเข้าร่วมบ้าน ไม่มีการส่งคำเชิญจริง</Small>
          <Field
            label="รหัสเข้าร่วม"
            autoCapitalize="characters"
            placeholder="MINT"
            value={code}
            onChangeText={(value) => {
              setCode(value);
              setError('');
            }}
            error={error}
          />
          <Button title="เข้าร่วมบ้านมิ้นต์" onPress={join} />
          <Button title="ยกเลิก" tone="outline" onPress={() => setForm('none')} />
        </Card>
      )}
      <Card style={{ backgroundColor: colors.mint, borderWidth: 0, marginTop: 24 }}>
        <Pill tone="butter">DEMO ONLY</Pill>
        <Small style={{ color: colors.cocoa, marginTop: 8 }}>
          รหัสนี้ใช้กับบ้านตัวอย่างเท่านั้น คำเชิญจริงจะพร้อมเมื่อเชื่อมต่อบริการ
          รหัสที่นี่ใช้ลองหน้าจอเท่านั้น
        </Small>
      </Card>
    </Page>
  );
}
