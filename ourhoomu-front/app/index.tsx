import React from 'react';
import { View } from 'react-native';
import { useRouter } from 'expo-router';
import { ArrowRight, Heart, ShieldCheck } from 'lucide-react-native';
import { Button, Card, Label, MotionIn, Page, Pill, Small, Title } from '@/components/ui';
import { HouseArt } from '@/components/HouseArt';
import { useDemo } from '@/demo/repository';
import { colors } from '@/theme/tokens';

export default function Welcome() {
  const router = useRouter();
  const { enter } = useDemo();
  return (
    <Page>
      <View style={{ flex: 1, justifyContent: 'center', minHeight: 620 }}>
        <MotionIn>
          <Pill tone="peach">OURHOOMU · บ้านของเรา</Pill>
          <Title style={{ fontSize: 37, lineHeight: 50, marginTop: 16 }}>
            เรื่องเล็ก ๆ ในบ้าน{'\n'}อบอุ่นขึ้นด้วยกัน
          </Title>
          <Label style={{ color: colors.muted, marginTop: 10 }}>
            หารค่าใช้จ่าย จัดเวร และดูแลบ้านในที่เดียว{'\n'}ให้ทุกคนมีเวลายิ้มมากขึ้น
          </Label>
        </MotionIn>
        <MotionIn delay={120} style={{ alignItems: 'center', marginVertical: 25 }}>
          <View
            style={{
              width: '100%',
              borderRadius: 34,
              backgroundColor: colors.peach,
              alignItems: 'center',
              paddingVertical: 14,
            }}
          >
            <HouseArt size={215} />
          </View>
        </MotionIn>
        <MotionIn delay={210}>
          <Button
            title="ลองบ้านตัวอย่าง"
            icon={ArrowRight}
            onPress={() => {
              enter();
              router.replace('/(tabs)');
            }}
          />
          <Small style={{ textAlign: 'center', marginTop: 11 }}>
            ข้อมูลตัวอย่างอยู่ในเครื่องระหว่างเปิดแอป และเริ่มใหม่เมื่อโหลดซ้ำ
          </Small>
        </MotionIn>
        <MotionIn delay={280}>
          <Card style={{ marginTop: 24, backgroundColor: colors.mint, borderWidth: 0 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <ShieldCheck size={20} color={colors.mintDark} />
              <Label style={{ fontWeight: '700' }}>เกี่ยวกับการเข้าสู่ระบบจริง</Label>
            </View>
            <Small style={{ color: colors.cocoa, marginTop: 5 }}>
              Google และ Apple จะเปิดใช้เมื่อ API, OAuth และ iOS build พร้อม
              ตอนนี้เป็นเดโมที่ไม่เชื่อมบัญชีหรือข้อมูลจริง
            </Small>
          </Card>
        </MotionIn>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'center',
            alignItems: 'center',
            gap: 5,
            marginTop: 24,
          }}
        >
          <Heart size={13} color={colors.coral} />
          <Small>ทำบ้านให้น่าอยู่ทีละนิด</Small>
        </View>
      </View>
    </Page>
  );
}
