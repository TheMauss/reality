import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import AuthProvider from "@/components/AuthProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
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
  title: "Cenolov – Agregátor nemovitostí a hlídací pes",
  description: "Agregátor inzerátů z Sreality a Bezrealitky. Hlídejte ceny, sledujte propady a lovte nejlepší nabídky.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <AuthProvider>
          <FavoritesProvider>
          <div className="relative z-10">
            <Suspense fallback={null}>
              <NavBar />
            </Suspense>
            <main className="mx-auto max-w-7xl px-5 py-8 md:px-8">
              {children}
            </main>
          </div>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
