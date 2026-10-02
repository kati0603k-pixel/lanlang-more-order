import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="home">
      <h1>ร้านหลังมอ</h1>
      <p>ระบบสั่งอาหารสำหรับลูกค้าและครัว</p>

      <nav className="links" aria-label="เมนูหลัก">
        <Link href="/generate-qr" className="link primary">
          สร้าง QR Code ประจำโต๊ะ
          <small>/generate-qr</small>
        </Link>
        <Link href="/kitchen" className="link">
          หน้าครัว
          <small>/kitchen</small>
        </Link>
      </nav>
    </main>
  );
}
