# ร้านหลังมอ — ระบบสั่งอาหารร้านคาเฟ่

Next.js (App Router, **JavaScript ไม่ใช่ TypeScript**) deploy บน Vercel และใช้ Supabase เป็นฐานข้อมูล

## Environment variables
- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

ตั้งใน `.env.local` (เครื่องตัวเอง) และ Vercel > Project Settings > Environment Variables
สร้าง Supabase client ที่ `lib/supabaseClient.js` (`import { supabase } from '@/lib/supabaseClient'` หรือ path สัมพัทธ์)

## กฎสำคัญ: Next.js เวอร์ชันล่าสุด — `params` ของ Dynamic Route เป็น Promise
โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด (16.x) ดังนั้น `params` (และ `searchParams`) ในหน้า Dynamic Route เช่น `app/order/[sessionId]/page.js`
**เป็น Promise** ต้อง unwrap ด้วย `use()` จาก React เสมอ ห้ามอ่านค่าตรง ๆ

```js
'use client';
import { use } from 'react';

export default function OrderPage({ params }) {
  const { sessionId } = use(params); // ถูกต้อง
  // const { sessionId } = params;   // ผิด — params เป็น Promise
  ...
}
```

หมายเหตุ: ถ้าเป็น Server Component แบบ `async function` ใช้ `await params` ได้เช่นกัน แต่ค่าเริ่มต้นของโปรเจกต์นี้คือ `use(params)`

## โครงสร้างตารางฐานข้อมูล (มีอยู่แล้วใน Supabase — ไม่ต้องสร้างใหม่)
ใช้ชื่อตารางและคอลัมน์ตามนี้เท่านั้น ห้ามเดาชื่อคอลัมน์เพิ่ม

| ตาราง | คอลัมน์ |
|---|---|
| `sessions` | `id`, `table_number`, `adult_count`, `child_count`, `status`, `created_at` |
| `menu_categories` | `id`, `name`, `sort_order` |
| `menu_items` | `id`, `category_id`, `name` |
| `orders` | `id`, `session_id`, `table_number`, `items` (jsonb), `status`, `created_at` |

ความสัมพันธ์: `menu_items.category_id` → `menu_categories.id`, `orders.session_id` → `sessions.id`

## หน้าที่มีแล้ว / วางแผนไว้
- `/` หน้าแรก (ใช้ทดสอบ deploy)
- `/generate-qr` สร้าง QR ประจำโต๊ะ (ยังไม่สร้าง)
- `/kitchen` หน้าครัว (ยังไม่สร้าง)
- หน้าสั่งอาหารแบบ Dynamic Route (ขั้นตอนถัดไป)
