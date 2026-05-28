import type { Metadata, Viewport } from "next";
import { Archivo, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import SyncProvider from "@/components/SyncProvider";
import GlobalUI from "@/components/GlobalUI";

const archivo = Archivo({
  subsets: ["latin"],
  variable: "--font-archivo",
  display: "swap",
  axes: ["wdth"],
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono-nf",
  weight: ["400", "500", "700"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Claude Coach",
  description: "Ton coach sportif personnel — Maxime",
  manifest: `${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/manifest.json`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Claude Coach",
  },
};

export const viewport: Viewport = {
  themeColor: "#0a0a0a",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const env = process.env.NEXT_PUBLIC_ENV;

  return (
    <html lang="fr" className={`${archivo.variable} ${jetbrainsMono.variable}`}>
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="mobile-web-app-capable" content="yes" />
        <link rel="icon" type="image/svg+xml" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.svg`} />
        <link rel="icon" type="image/x-icon" sizes="32x32" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/favicon.ico`} />
        <link rel="apple-touch-icon" sizes="180x180" href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ""}/apple-touch-icon.png`} />
      </head>
      <body className="bg-background text-white font-body antialiased">
        <script dangerouslySetInnerHTML={{ __html: `
          if ('serviceWorker' in navigator && location.hostname !== 'localhost') {
            window.addEventListener('load', () => {
              navigator.serviceWorker.register('${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/sw.js', {
                scope: '${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/'
              });
            });
          }
          if ('serviceWorker' in navigator && location.hostname === 'localhost') {
            navigator.serviceWorker.getRegistrations().then(regs => regs.forEach(r => r.unregister()));
          }
        `}} />
        {env && (
          <div
            className="fixed top-3 right-3 z-50 font-mono text-[10px] px-2 py-0.5 rounded-full pointer-events-none"
            style={{
              background: env === "staging" ? "rgba(251,146,60,0.15)" : "rgba(100,100,100,0.15)",
              color: env === "staging" ? "#fb923c" : "#888",
              border: `1px solid ${env === "staging" ? "rgba(251,146,60,0.3)" : "rgba(100,100,100,0.3)"}`,
            }}
          >
            {env === "staging" ? "STG2" : "LOCAL"}
          </div>
        )}
        <SyncProvider />
        <GlobalUI>
          <div className="min-h-screen pb-nav">
            {children}
          </div>
        </GlobalUI>
      </body>
    </html>
  );
}
