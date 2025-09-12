
import type { Metadata } from 'next';
import './globals.css';
import { AppLayout } from '@/app/layout/app-layout';
import { Toaster } from "@/components/ui/toaster";
import { AuthProvider } from '@/contexts/auth-context';
import { Inter } from 'next/font/google';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const metadata: Metadata = {
  title: 'CrewSphere',
  description: 'A comprehensive portal for airline crew members.',
};

// This script is injected into the head to prevent FOUC (Flash of Unstyled Content) for the theme
const ThemeInitializer = () => (
  <script
    dangerouslySetInnerHTML={{
      __html: `(function() {
        try {
          const theme = localStorage.getItem('theme');
          if (theme === 'dark') {
            document.documentElement.classList.add('dark');
          }
        } catch (e) {}
      })();`,
    }}
  />
);


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning className={inter.variable}>
      <head>
        <ThemeInitializer />
      </head>
      <body>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
