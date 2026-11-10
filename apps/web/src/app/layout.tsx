import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: { default: 'Strata', template: '%s · Strata' },
  description: 'Startup and sector intelligence: company profiles, funding rounds, LLM classification and analyst briefs.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ color: '#f8f9fb' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans text-sm">{children}</body>
    </html>
  );
}
