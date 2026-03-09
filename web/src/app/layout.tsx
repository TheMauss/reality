import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CenovýPád – Sledování cen nemovitostí",
  description: "Monitorujeme cenové propady nemovitostí na českém trhu",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <nav className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
          <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
            <a href="/" className="flex items-center gap-2 text-xl font-bold">
              <span className="text-2xl">📉</span>
              <span className="bg-gradient-to-r from-accent-light to-accent bg-clip-text text-transparent">
                CenovýPád
              </span>
            </a>
            <div className="flex items-center gap-6 text-sm text-muted">
              <a href="/inzerce" className="transition-colors hover:text-foreground">
                Inzerce
              </a>
              <a
                href="/prodeje"
                className="transition-colors hover:text-foreground"
              >
                Prodeje
              </a>
              <a
                href="/data"
                className="transition-colors hover:text-foreground"
              >
                Data
              </a>
              <a
                href="/mapa"
                className="transition-colors hover:text-foreground"
              >
                Mapa
              </a>
            </div>
          </div>
        </nav>
        <main className="mx-auto max-w-7xl px-6 py-8">{children}</main>
      </body>
    </html>
  );
}
