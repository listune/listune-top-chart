import './globals.css';
import { Inter, JetBrains_Mono } from 'next/font/google';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  variable: '--font-jetbrains',
  display: 'swap',
});

export const metadata = {
  title: 'Listune Top Chart Spotify Chart Developer API & Explorer',
  description: 'High-performance JSON API for Spotify top daily charts scraped from Kworb with token-free metadata resolution and Drizzle ORM.',
  keywords: 'spotify api, kworb top chart, spotify streams api, music chart api, listune api',
  icons: {
    icon: '/listune.png',
    shortcut: '/listune.png',
    apple: '/listune.png',
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#060608',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrainsMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
