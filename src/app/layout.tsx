
import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/app/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CrewSphere',
  description: 'A comprehensive portal for airline crew members.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // A single locale is used, so we can define it statically.
  // The messages can be an empty object as they are handled by middleware.
  const locale = 'en';
  const messages = {};

  return (
    <html lang={locale} suppressHydrationWarning>
      <head>
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
      </head>
      <body className={inter.variable}>
        <NextIntlClientProvider locale={locale} messages={messages}>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
