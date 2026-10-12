import React from 'react';
import { View } from 'react-native';
import { Card, DemoBadge, Empty, Label, Page, Small } from '@/components/ui';
import { useDemo } from '@/demo/repository';
import { colors } from '@/theme/tokens';

export default function ActivityFeed() {
  const { state, house } = useDemo();
  const items = state.activity.filter((item) => item.houseId === house.id);
  return (
    <Page back title="เรื่องล่าสุดในบ้าน">
      <DemoBadge />
      <Small style={{ marginTop: 10, marginBottom: 17 }}>
        กิจกรรมของ{house.name}ในเดโม · ยังไม่มีการแจ้งเตือนจากเซิร์ฟเวอร์
      </Small>
      {items.length ? (
        <Card>
          {items.map((item, index) => (
            <View
              key={item.id}
              style={{
                flexDirection: 'row',
                gap: 12,
                paddingVertical: 12,
                borderBottomWidth: index === items.length - 1 ? 0 : 1,
                borderBottomColor: colors.line,
              }}
            >
              <Label style={{ fontSize: 24 }}>{item.emoji}</Label>
              <View style={{ flex: 1 }}>
                <Label style={{ fontWeight: '700' }}>{item.text}</Label>
                <Small>{new Date(item.createdAt).toLocaleString('th-TH')}</Small>
              </View>
            </View>
          ))}
        </Card>
      ) : (
        <Empty
          emoji="🌱"
          title="บ้านนี้ยังเงียบสงบ"
          detail="เมื่อเพิ่มบิลหรือทำเวร กิจกรรมจะปรากฏตรงนี้"
        />
      )}
    </Page>
  );
}
