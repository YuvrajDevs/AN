import type { Metadata, Viewport } from 'next';
import { Outfit } from 'next/font/google';
import './globals.css';

const sans = Outfit({ subsets: ['latin'], variable: '--font-sans', display: 'swap' });

export const metadata: Metadata = {
  title: { default: 'Strata · Startup & sector intelligence', template: '%s · Strata' },
  description: 'Startup and sector intelligence from public data: SEC Form D funding, LLM sector classification with human review, and analyst briefs where every claim cites a source.',
};

export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: [{ color: '#f6f1e7' }] };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={sans.variable}>
      <body className="min-h-screen font-sans text-body">{children}</body>
    </html>
  );
}
