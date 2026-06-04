import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' });

export const viewport: Viewport = {
  themeColor:           '#0a0a0a',
  width:                'device-width',
  initialScale:         1,
  minimumScale:         1,
  viewportFit:          'cover',  // respect iPhone notch / home indicator
};

export const metadata: Metadata = {
  title: {
    default:  'Shared Spaces',
    template: '%s · Shared Spaces',
  },
  description: 'Book and manage shared creative resources with your trusted group.',
  manifest:    '/manifest.webmanifest',
  appleWebApp: {
    capable:           true,
    statusBarStyle:    'black-translucent',  // content under status bar (notch-safe)
    title:             'Shared Spaces',
    startupImage: [
      // iPhone 14 Pro Max
      { url: '/splash/apple-splash-1290x2796.png', media: '(device-width: 430px) and (device-height: 932px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone 14 / 13 / 12
      { url: '/splash/apple-splash-1170x2532.png', media: '(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3)' },
      // iPhone SE (3rd gen)
      { url: '/splash/apple-splash-750x1334.png',  media: '(device-width: 375px) and (device-height: 667px) and (-webkit-device-pixel-ratio: 2)' },
    ],
  },
  icons: {
    icon:       [
      { url: '/icons/icon-192.png', sizes: '192x192', type: 'image/png' },
      { url: '/icons/icon-512.png', sizes: '512x512', type: 'image/png' },
    ],
    apple:      '/icons/apple-touch-icon.png',
    shortcut:   '/icons/favicon.ico',
  },
  formatDetection: { telephone: false },
  // Required for "Add to Home Screen" on Chrome Android
  other: {
    'mobile-web-app-capable': 'yes',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="bg-neutral-950 text-neutral-100 antialiased">
        {children}
      </body>
    </html>
  );
}
