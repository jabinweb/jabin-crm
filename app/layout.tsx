import './globals.css';
import type { Metadata, Viewport } from 'next';
import { Inter, DM_Sans, Outfit } from 'next/font/google';
import { AuthProvider } from '@/components/providers/auth-provider';
import { QueryProvider } from '@/components/providers/query-provider';
import { Toaster } from '@/components/ui/sonner';
import { ErrorBoundary } from '@/components/error-boundary';
import { ServiceWorkerRegistration } from '@/components/pwa/service-worker-registration';

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
  title: `${appName} — Simple service ops for every role`,
  description:
    'Sales, tickets, field service, AMC renewals, and a client portal in one workspace. Clear enough for anyone — live in minutes.',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: appName,
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  themeColor: '#000000',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
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
              <ServiceWorkerRegistration />
              {children}
              <Toaster />
            </QueryProvider>
          </AuthProvider>
        </ErrorBoundary>
      </body>
    </html>
  );
}
