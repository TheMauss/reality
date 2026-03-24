import type { Metadata } from "next";
import { Suspense } from "react";
import { Inter, JetBrains_Mono } from "next/font/google";
import NavBar from "@/components/NavBar";
import AuthProvider from "@/components/AuthProvider";
import FavoritesProvider from "@/components/FavoritesProvider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin", "latin-ext"],
});

const jetbrains = JetBrains_Mono({
  variable: "--font-jetbrains",
  subsets: ["latin"],
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  title: "Cenolov — Agregátor nemovitostí ČR",
  description:
    "Agregátor inzerátů ze Sreality a Bezrealitky. Sledujte cenové propady, porovnávejte s prodejními cenami a najděte nejlepší nabídky na trhu.",
};

function Footer() {
  return (
    <footer className="mt-auto border-t border-border">
      <div className="mx-auto max-w-[1280px] px-5 md:px-8 lg:px-10">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 py-6">
          <div className="flex items-center gap-4 text-[12px] text-text-tertiary">
            <span className="font-medium text-text-secondary">Cenolov</span>
            <span>Agregátor nemovitostí z českého trhu</span>
          </div>
          <div className="flex items-center gap-4 text-[12px] text-text-tertiary">
            <a href="/prodeje" className="hover:text-text-secondary transition-colors">Tržní data</a>
            <a href="/data" className="hover:text-text-secondary transition-colors">Analýzy</a>
            <a href="/mapa" className="hover:text-text-secondary transition-colors">Mapa</a>
          </div>
        </div>
      </div>
    </footer>
  );
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="cs">
      <body
        className={`${inter.variable} ${jetbrains.variable} antialiased`}
      >
        <AuthProvider>
          <FavoritesProvider>
            <div className="relative z-10 min-h-screen flex flex-col">
              <Suspense fallback={null}>
                <NavBar />
              </Suspense>
              <main className="mx-auto w-full max-w-[1280px] flex-1 px-5 py-6 md:px-8 md:py-8 lg:px-10">
                {children}
              </main>
              <Footer />
            </div>
          </FavoritesProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
