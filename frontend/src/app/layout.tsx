import type { Metadata, Viewport } from 'next';
import { Inter, Noto_Sans_Telugu } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';
import { auth } from '@/auth';
import { SessionProvider } from 'next-auth/react';
import PwaRegister from '@/components/PwaRegister';
import './globals.css';

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-geist-sans', // match globals.css expectation or use custom
});

const notoSansTelugu = Noto_Sans_Telugu({
  subsets: ['telugu'],
  variable: '--font-noto-telugu',
  weight: ['400', '500', '600', '700'],
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Tractor Hours Tracker',
  description: 'Track daily working hours of tractor laborers',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Tractor Hours',
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport: Viewport = {
  themeColor: '#1B4332',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const locale = await getLocale();
  const messages = await getMessages();
  const session = await auth();

  return (
    <html
      lang={locale}
      className={`${inter.variable} ${notoSansTelugu.variable}`}
      suppressHydrationWarning
    >
      <body className={locale === 'te' ? 'font-telugu' : 'font-sans'} suppressHydrationWarning>
        <SessionProvider session={session}>
          <PwaRegister />
          <NextIntlClientProvider messages={messages}>
            <div className="app-container">
              {children}
            </div>
          </NextIntlClientProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
