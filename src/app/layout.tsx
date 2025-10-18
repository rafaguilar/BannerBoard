import type {Metadata} from 'next';
import './globals.css';
import { Toaster } from "@/components/ui/toaster"
import { Analytics } from "@firebase/analytics"
import { app } from "@/lib/firebase";
import { Suspense } from 'react';

export const metadata: Metadata = {
  title: 'BannerBoard',
  description: 'Preview & compare multiple advertising banner creatives simultaneously.',
};

function FirebaseAnalytics() {
  if (typeof window !== "undefined") {
    const analytics = app.name ? Analytics : undefined;
  }
  return null
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="font-body antialiased">
        <Suspense>
          <FirebaseAnalytics />
        </Suspense>
        {children}
        <Toaster />
        {/* 100% privacy-first analytics */}
        <script async src="https://scripts.simpleanalyticscdn.com/latest.js"></script>
      </body>
    </html>
  );
}
