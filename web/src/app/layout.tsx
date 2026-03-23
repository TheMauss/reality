import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
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
  description: "Monitorujeme cenové propady nemovitostí na českém trhu v reálném čase.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <div className="relative z-10">
          <Suspense fallback={null}>
            <NavBar />
          </Suspense>
          <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
            {children}
          </main>
        </div>
      </body>
    </html>
  );
}
