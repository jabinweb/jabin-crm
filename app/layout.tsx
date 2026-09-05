import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, DM_Sans, Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { ConfirmActionHost } from '@/components/ui/confirm-action-host';
import { ErrorBoundary } from '@/components/error-boundary';

const inter = Inter({
  subsets: ['latin'],
  fallback: ['system-ui', 'arial'],
  display: 'swap',
});

const landingSans = DM_Sans({
  subsets: ['latin'],
  variable: '--font-landing-sans',
  display: 'swap',
});

const landingDisplay = Outfit({
  subsets: ['latin'],
  variable: '--font-landing-display',
  display: 'swap',
});

const appName = process.env.NEXT_PUBLIC_APP_NAME?.trim() || 'Opslane';

export const metadata: Metadata = {
  title: `${appName} — Business workspace for every industry`,
  description:
    'Sales pipeline, delivery projects, tickets, HR, invoicing, and a client portal in one workspace. Pick your industry — terminology and defaults follow.',
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/brand/opslane-mark.svg', type: 'image/svg+xml' }],
    apple: [{ url: '/icons/icon.svg' }],
    shortcut: ['/brand/opslane-mark.svg'],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appName,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0f766e',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="icon" href="/brand/opslane-mark.svg" type="image/svg+xml" />
        <link rel="apple-touch-icon" href="/icons/icon.svg" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={appName} />
        <meta name="mobile-web-app-capable" content="yes" />
      </head>
      <body
        className={`${inter.className} ${landingSans.variable} ${landingDisplay.variable}`}
      >
        <ErrorBoundary>
          <AuthProvider>
            <QueryProvider>
              {children}
              <Toaster />
              <ConfirmActionHost />
            </QueryProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
