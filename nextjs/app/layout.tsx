import type { Metadata } from "next";
import { Suspense } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Script from "next/script";
import "./globals.css";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Providers from "../components/Providers";
import AnalyticsTracker from "../components/AnalyticsTracker";
import CanonicalHostRedirect from "../components/CanonicalHostRedirect";

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
  title: "CareersPal | Ops & Systems jobs",
  description:
    "Find Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles. Remote, hybrid, and onsite. Search, save, and apply on the company site.",
  icons: {
    icon: [
      { url: "/favicon.svg", type: "image/svg+xml" },
      { url: "/logo.svg", type: "image/svg+xml" },
      { url: "/icon", type: "image/png", sizes: "512x512" },
    ],
    shortcut: [{ url: "/logo.svg", type: "image/svg+xml" }],
    apple: [{ url: "/icon", type: "image/png", sizes: "512x512" }],
  },
  openGraph: {
    title: "CareersPal | Ops & Systems jobs",
    description:
      "Find Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles. Remote, hybrid, and onsite. Search, save, and apply on the company site.",
    url: baseUrl,
    siteName: "CareersPal",
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
    title: "CareersPal | Ops & Systems jobs",
    description:
      "Find Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff roles. Remote, hybrid, and onsite. Search, save, and apply on the company site.",
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
          {/* Canonicalize apex -> www as early as possible (before client routing / RSC fetches). */}
          <Script id="cp-canonical-host" strategy="beforeInteractive">
            {`
              (function () {
                try {
                  if (window.location.hostname !== "careerspal.com") return;
                  var target = "https://www.careerspal.com" + window.location.pathname + window.location.search + window.location.hash;
                  window.location.replace(target);
                } catch (e) {}
              })();
            `}
          </Script>
          <CanonicalHostRedirect />
          <Suspense fallback={null}>
            <AnalyticsTracker />
          </Suspense>
          <Navbar />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
