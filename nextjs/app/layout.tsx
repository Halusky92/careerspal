import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Providers from "../components/Providers";
import AnalyticsTracker from "../components/AnalyticsTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl =
  (process.env.NEXT_PUBLIC_SITE_URL && process.env.NEXT_PUBLIC_SITE_URL.replace(/\/+$/, "")) ||
  (process.env.VERCEL_URL && `https://${process.env.VERCEL_URL}`) ||
  "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  title: "CareersPal Elite | Curated Remote Roles",
  description:
    "Premium job board for Notion-first operations, product, and automation talent. Curated roles, verified employers, transparent salaries.",
  openGraph: {
    title: "CareersPal Elite | Curated Remote Roles",
    description:
      "Premium job board for Notion-first operations, product, and automation talent. Curated roles, verified employers, transparent salaries.",
    url: baseUrl,
    siteName: "CareersPal Elite",
    images: [
      {
        url: "/mockups/job-board-concept.svg",
        width: 1200,
        height: 630,
        alt: "CareersPal job board preview",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "CareersPal Elite | Curated Remote Roles",
    description:
      "Premium job board for Notion-first operations, product, and automation talent. Curated roles, verified employers, transparent salaries.",
    images: ["/mockups/job-board-concept.svg"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F8F9FD] text-slate-900`}>
        <Providers>
          <AnalyticsTracker />
          <Navbar />
          <main className="min-h-screen">{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
