
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

const LanguageInitializer = () => (
    <script
        dangerouslySetInnerHTML={{
        __html: `(function() {
            try {
                const lang = navigator.language.split('-')[0] || 'fr';
                document.documentElement.lang = lang;
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
        <LanguageInitializer />
        <ThemeInitializer />
        <link rel="icon" href="data:;base64,iVBORw0KGgo=" />
      </head>
      <body>
        <a
            href="#main"
            className="sr-only focus:not-sr-only focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 px-4 py-2 bg-primary text-white rounded-md transition-all absolute top-2 left-2 z-[9999]"
            >
            Aller au contenu principal
        </a>
        <AuthProvider>
          <AppLayout>{children}</AppLayout>
        </AuthProvider>
        <Toaster />
      </body>
    </html>
  );
}
