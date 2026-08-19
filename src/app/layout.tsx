import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import { DemoBanner } from "@/components/DemoBanner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "CRM System",
  description: "Lead Management & CRM Platform",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    // suppressHydrationWarning covers attributes that browser extensions inject
    // into <html> and <body> before React hydrates (Bitdefender's
    // `bis_skin_checked`, password managers, translation tools). Those are not
    // ours and cannot be prevented from the app side. It suppresses one level
    // only, so a genuine mismatch in any component below still reports normally.
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      suppressHydrationWarning
    >
      <body className="min-h-full flex flex-col" suppressHydrationWarning>
        <DemoBanner />
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
