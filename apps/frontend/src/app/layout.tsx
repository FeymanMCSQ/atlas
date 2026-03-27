import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Atlas Neural Control',
  description: 'Internal content engine orchestration dashboard.',
  icons: {
    icon: '/icons/icon-32.png',
    apple: '/icons/icon-192.png',
    other: [
      {
        rel: 'apple-touch-icon-precomposed',
        url: '/icons/icon-192.png',
      },
      {
        rel: 'icon',
        url: '/icons/icon-512.png',
        sizes: '512x512',
      },
    ],
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>{children}</body>
    </html>
  );
}
