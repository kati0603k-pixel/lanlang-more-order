# ร้านหลังมอ

ระบบสั่งอาหารร้านคาเฟ่ — Next.js (App Router, JavaScript) + Supabase, deploy บน Vercel

## เริ่มใช้งาน
```bash
npm install
cp .env.example .env.local   # แล้วใส่ค่า Supabase
npm run dev
```

## Deploy บน Vercel
1. Push โปรเจกต์ขึ้น GitHub แล้ว Import เข้า Vercel
2. ตั้ง Environment Variables: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`
3. Deploy แล้วเปิดหน้าแรกเพื่อตรวจสอบ

## ข้อควรจำ
- Next.js เวอร์ชันล่าสุด: `params` ของ Dynamic Route เป็น Promise ต้อง unwrap ด้วย `use()` จาก React เสมอ
- โครงสร้างตารางฐานข้อมูลและกฎอื่น ๆ ดูใน [CLAUDE.md](./CLAUDE.md)
