import { expect, test } from '@playwright/test';
import { enterDemo, newBill, tab } from './helpers';

test.beforeEach(async ({ page }) => {
  await enterDemo(page);
});

test('demo entry, tabs and reload reset', async ({ page }) => {
  await tab(page, 'บิล');
  await expect(page.getByText('บิลของเรา', { exact: true })).toBeVisible();
  await tab(page, 'เวร');
  await expect(page.getByText('เวรในบ้าน', { exact: true })).toBeVisible();
  await tab(page, 'บ้าน');
  await expect(page.getByText('รหัสเดโม: MALI', { exact: true })).toBeVisible();
  await tab(page, 'ภาพรวม');
  await page.reload();
  await expect(page.getByRole('button', { name: 'ลองบ้านตัวอย่าง', exact: true })).toBeVisible();
});

test('equal bill split and partial cash pending, cap, cancellation', async ({ page }) => {
  await newBill(page, 'Playwright cash');
  await expect(page.getByText('มิว · 50.00% · ต้องคืนผู้รับ', { exact: true })).toBeVisible();
  await expect(page.getByText('บีม · 50.00% · ออกเอง', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'บันทึกบิลตัวอย่าง', exact: true }).click();
  await expect(page.getByText('🧾 Playwright cash', { exact: true })).toBeVisible();
  const pay = page.getByRole('button', { name: 'แจ้งจ่ายบางส่วน / ทั้งหมด', exact: true });
  await pay.click();
  await page.getByRole('textbox', { name: 'จำนวนเงิน (บาท)', exact: true }).fill('40');
  await page.getByRole('button', { name: 'เงินสด', exact: true }).click();
  await page.getByRole('button', { name: 'ส่งคำขอตัวอย่าง', exact: true }).click();
  await expect(page.getByText('มีคำขอรอ ฿40.00', { exact: true })).toBeVisible();
  await expect(page.getByText('฿40.00 · เงินสด', { exact: true })).toBeVisible();
  await expect(
    page.getByText('มิว · รอผู้สร้างบิลยืนยันเมื่อเชื่อมข้อมูลจริง', { exact: true }),
  ).toBeVisible();
  await expect(page.getByText('฿100.00', { exact: true })).toHaveCount(4);
  await pay.click();
  await expect(page.getByRole('textbox', { name: 'จำนวนเงิน (บาท)', exact: true })).toHaveValue(
    '60.00',
  );
  await page.getByRole('textbox', { name: 'จำนวนเงิน (บาท)', exact: true }).fill('60.01');
  await page.getByRole('button', { name: 'ส่งคำขอตัวอย่าง', exact: true }).click();
  await expect(page.getByText('กรอกยอดมากกว่า 0 และไม่เกิน ฿60.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'ปิด', exact: true }).click();
  await page.getByRole('button', { name: 'ถอนคำขอที่รออยู่', exact: true }).click();
  await expect(page.getByText('ยังไม่มีรายการจ่าย', { exact: true })).toBeVisible();
  await pay.click();
  await expect(page.getByRole('textbox', { name: 'จำนวนเงิน (บาท)', exact: true })).toHaveValue(
    '100.00',
  );
});

test('custom percentages reject incomplete total and preserve exact shares', async ({ page }) => {
  await newBill(page, 'Playwright percentages');
  await page.getByRole('button', { name: 'กำหนด % เอง', exact: true }).click();
  await page.getByRole('textbox', { name: 'มิว (%)', exact: true }).fill('40');
  await page.getByRole('textbox', { name: 'บีม (%)', exact: true }).fill('59.99');
  await page.getByRole('button', { name: 'บันทึกบิลตัวอย่าง', exact: true }).click();
  await expect(page.getByText('ต้องครบ 100.00% ตอนนี้ขาด 0.01%', { exact: true })).toBeVisible();
  await expect(page.getByRole('textbox', { name: 'ชื่อบิล', exact: true })).toBeVisible();
  await page.getByRole('textbox', { name: 'บีม (%)', exact: true }).fill('60');
  await expect(page.getByText('฿80.00', { exact: true })).toBeVisible();
  await expect(page.getByText('฿120.00', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'บันทึกบิลตัวอย่าง', exact: true }).click();
  await expect(page.getByText('🧾 Playwright percentages', { exact: true })).toBeVisible();
  await expect(page.getByText('40.00%', { exact: true })).toBeVisible();
  await expect(page.getByText('60.00%', { exact: true })).toBeVisible();
});

for (const mode of ['จัดเอง · ครั้งเดียว', 'ทำซ้ำ · คนเดิม', 'หมุนเวียน · เรียงตามสมาชิก']) {
  test(`chore schedule: ${mode}`, async ({ page }) => {
    await tab(page, 'เวร');
    await page.getByRole('button', { name: 'เพิ่มตารางเวร', exact: true }).click();
    await page.getByRole('textbox', { name: 'ชื่องาน', exact: true }).fill(`QA ${mode}`);
    await page.getByRole('button', { name: mode, exact: true }).click();
    if (mode.startsWith('หมุนเวียน')) {
      await page.getByRole('button', { name: 'เลือกบีม', exact: true }).click();
      await page.getByRole('button', { name: 'เลื่อนบีมขึ้น', exact: true }).click();
      await expect(page.getByText('1. บีม', { exact: true })).toHaveCount(2);
    }
    if (!mode.startsWith('จัดเอง'))
      await expect(page.getByText('และอีก 7 ครั้ง', { exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'บันทึกตารางตัวอย่าง', exact: true }).click();
    await expect(
      page
        .getByText(`QA ${mode}`, { exact: true })
        .and(page.locator(':not([aria-hidden="true"] *)')),
    ).toBeVisible();
    await page.getByRole('button', { name: 'สัปดาห์นี้', exact: true }).click();
    await expect(
      page
        .getByText(`QA ${mode}`, { exact: true })
        .and(page.locator(':not([aria-hidden="true"] *)')),
    ).toHaveCount(mode.startsWith('จัดเอง') ? 1 : 7);
    await page.getByRole('button', { name: 'เลือกวัน', exact: true }).click();
    await expect(
      page
        .getByText(`QA ${mode}`, { exact: true })
        .and(page.locator(':not([aria-hidden="true"] *)')),
    ).toHaveCount(1);
  });
}

test('calendar keyboard expansion, month navigation, date selection and focus return', async ({
  page,
}) => {
  await tab(page, 'เวร');
  await page.getByRole('button', { name: 'เพิ่มตารางเวร', exact: true }).click();
  const trigger = page.getByRole('button', { name: /^วันที่ทำ / });
  const initial = await trigger.getAttribute('aria-label');
  await trigger.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-expanded', 'true');
  await page.getByRole('button', { name: 'เดือนถัดไป', exact: true }).click();
  const date = page.getByRole('button', { name: /^เลือกวันที่ 1 / });
  const selected = (await date.getAttribute('aria-label'))!.replace('เลือกวันที่ ', 'วันที่ทำ ');
  await date.focus();
  await page.keyboard.press('Enter');
  await expect(trigger).toHaveAttribute('aria-label', selected);
  await expect(trigger).toHaveAttribute('aria-expanded', 'false');
  await expect(trigger).toBeFocused();
  await trigger.press('Space');
  await page.getByRole('button', { name: 'เดือนก่อนหน้า', exact: true }).click();
  await page.getByRole('button', { name: 'เลือกวันนี้', exact: true }).click();
  await expect(trigger).toHaveAttribute('aria-label', initial!);
});

test('switch houses, create and join demo house', async ({ page }) => {
  await page.getByRole('button', { name: /^เปลี่ยนบ้าน ปัจจุบัน / }).click();
  await page.getByRole('button', { name: 'เลือกบ้านพีช', exact: true }).click();
  await tab(page, 'บิล');
  await expect(page.getByText('ต้นไม้หน้าบ้าน', { exact: true })).toBeVisible();
  await expect(page.getByText('ของเข้าบ้าน', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^เปลี่ยนบ้าน ปัจจุบัน / }).click();
  await page.getByRole('button', { name: 'สร้างบ้าน', exact: true }).click();
  await page.getByRole('textbox', { name: 'ชื่อบ้าน', exact: true }).fill('บ้าน QA');
  await page.getByRole('button', { name: 'สร้างบ้านตัวอย่าง', exact: true }).click();
  await tab(page, 'บิล');
  await expect(page.getByText('ของเข้าบ้าน', { exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: /^เปลี่ยนบ้าน ปัจจุบัน / }).click();
  await page.getByRole('button', { name: 'เข้าร่วม', exact: true }).click();
  await page.getByRole('textbox', { name: 'รหัสเข้าร่วม', exact: true }).fill('MINT');
  await page.getByRole('button', { name: 'เข้าร่วมบ้านมิ้นต์', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'เปลี่ยนบ้าน ปัจจุบัน บ้านมิ้นต์', exact: true }),
  ).toBeVisible();
});

test('reduced motion keeps interactive press transform at identity', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect
    .poll(() => page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches))
    .toBe(true);
  const button = page.getByRole('button', { name: 'บิล', exact: true });
  await button.scrollIntoViewIfNeeded();
  const box = (await button.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  await expect
    .poll(() => button.evaluate((element) => getComputedStyle(element.parentElement!).transform))
    .toBe('matrix(1, 0, 0, 1, 0, 0)');
  await page.mouse.up();
  await expect(page.getByText('บิลของเรา', { exact: true })).toBeVisible();
});

test('assigned member completes a demo chore and sees house activity', async ({ page }) => {
  await tab(page, 'เวร');
  const complete = page.getByRole('button', { name: 'ทำรดน้ำต้นไม้เสร็จ', exact: true });
  await complete.click();
  await expect(complete).toHaveCount(0);
  await expect(page.getByText('เยี่ยมเลย! บ้านสดใสขึ้นอีกนิด ✨', { exact: true })).toBeVisible();
  await tab(page, 'ภาพรวม');
  await expect(
    page
      .getByText('มิวทำรดน้ำต้นไม้เสร็จแล้ว', { exact: true })
      .and(page.locator(':not([aria-hidden="true"] *)')),
  ).toBeVisible();
});
