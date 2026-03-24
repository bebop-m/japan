import type { Metadata, Viewport } from "next";
import { BottomNav } from "@/components/bottom-nav";
import "./globals.css";

export const metadata: Metadata = {
  title: "NIHONGO.GO",
  description: "Pixel-perfect Japanese travel phrase trainer for iPhone Safari.",
  applicationName: "NIHONGO.GO",
  icons: {
    icon: "/icons/icon-192.svg",
    apple: "/icons/icon-192.svg"
  },
  appleWebApp: {
    capable: true,
    title: "NIHONGO.GO",
    statusBarStyle: "default"
  },
  formatDetection: {
    telephone: false
  },
  manifest: "/manifest.webmanifest"
};

export const viewport: Viewport = {
  themeColor: "#e8e4d0",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover"
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@400;500;700&family=Press+Start+2P&display=swap"
        />
      </head>
      <body>
        <main>
          <div className="shell">{children}</div>
        </main>
        <BottomNav />
      </body>
    </html>
  );
}
