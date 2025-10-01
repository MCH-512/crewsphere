import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/app/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { Inter } from 'next/font/google';
import { NextIntlClientProvider } from 'next-intl';
import { getLocale, getMessages } from 'next-intl/server';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CrewSphere',
  description: 'A comprehensive portal for airline crew members.',
};

const ThemeInitializer = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function() {
        try {
          const theme = localStorage.getItem('theme');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          } else if (!theme) {
            const systemTheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
            if (systemTheme === 'dark') {
              document.documentElement.classList.add('dark');
            }
          }
        } catch (e) {}
      })();`,
    }}
  />
);

export default async function RootLayout({
  children,
  params: { locale },
}: Readonly<{
  children: React.ReactNode;
  params: { locale: string };
}>) {
  const messages = await getMessages();
  const resolvedLocale = await getLocale();

  return (
    <html lang={resolvedLocale} suppressHydrationWarning>
      <head>
        <ThemeInitializer />
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
      </head>
      <body className={inter.variable}>
        <NextIntlClientProvider locale={resolvedLocale} messages={messages}>
          <AuthProvider>
            <AppLayout>{children}</AppLayout>
          </AuthProvider>
          <Toaster />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
