import { IBM_Plex_Sans_Thai } from 'next/font/google';
import './globals.css';

const plexThai = IBM_Plex_Sans_Thai({
  subsets: ['thai', 'latin'],
  weight: ['400', '600', '700'],
  display: 'swap',
});

export const metadata = {
  title: 'ร้านหลังมอ',
  description: 'ระบบสั่งอาหารร้านหลังมอ',
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body className={plexThai.className}>{children}</body>
    </html>
  );
}
