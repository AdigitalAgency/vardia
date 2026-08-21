import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import PwaSetup from "@/components/PwaSetup";
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
  title: "Vardia — Πρόγραμμα βαρδιών",
  description: "Το εβδομαδιαίο πρόγραμμα του μαγαζιού σου, online.",
  appleWebApp: { capable: true, title: "Vardia", statusBarStyle: "default" },
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#4f46e5",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="el"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        {children}
        <PwaSetup />
      </body>
    </html>
  );
}
