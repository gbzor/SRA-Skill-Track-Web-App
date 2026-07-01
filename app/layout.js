import { headers } from 'next/headers';
import './globals.css';
import Providers from './Providers';

// Nonce-based CSP (see middleware.js) needs a fresh nonce every request, which
// requires dynamic rendering — reading headers() here (rather than only in
// middleware) is what opts this layout, and everything under it, out of
// static prerendering so Next.js can embed a matching nonce in its own
// hydration bootstrap script each time instead of baking a stale one into a
// cached static page.

export const metadata = {
  title: 'SRA Tracker',
  description: 'SRA color level tracker',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#faf7f2',
};

export default function RootLayout({ children }) {
  // eslint-disable-next-line no-unused-vars -- reading headers() forces dynamic rendering; see comment above
  const nonce = headers().get('x-nonce');

  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Instrument+Serif:ital@0;1&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
