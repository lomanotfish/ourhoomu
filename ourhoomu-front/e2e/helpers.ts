import { expect, type Page } from '@playwright/test';

export async function enterDemo(page: Page) {
  await page.goto('/');
  await page.getByRole('button', { name: 'ลองบ้านตัวอย่าง', exact: true }).click();
  await expect(page.getByText('DEMO · ข้อมูลตัวอย่าง', { exact: true })).toBeVisible();
}

export async function tab(page: Page, name: string) {
  await page.getByRole('button', { name, exact: true }).click();
}

export async function newBill(page: Page, title: string) {
  await tab(page, 'บิล');
  await page.getByRole('button', { name: 'เพิ่มบิล', exact: true }).click();
  await page.getByRole('textbox', { name: 'ชื่อบิล', exact: true }).fill(title);
  await page.getByRole('textbox', { name: 'ยอดรวม (บาท)', exact: true }).fill('200');
  await page.getByRole('button', { name: 'เลือกบีมเป็นผู้รับเงิน', exact: true }).click();
  await page.getByRole('button', { name: 'เอาฟ้าออกจากผู้หาร', exact: true }).click();
}
