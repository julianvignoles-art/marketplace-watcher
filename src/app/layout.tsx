import type { Metadata } from "next";
import { Special_Elite, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";
import { NavBar } from "@/components/NavBar";

const display = Special_Elite({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-display",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-body",
});

export const metadata: Metadata = {
  title: "Marketplace Watcher",
  description: "Quietly watches Facebook Marketplace for the things you actually want.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable}`}>
      <body>
        <NavBar />
        <main className="mx-auto max-w-5xl px-4 pb-24 pt-8 sm:px-6">{children}</main>
      </body>
    </html>
  );
}
