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
import ApplyResume from "../components/ApplyResume";
import { getCanonicalSiteUrl } from "../lib/alerts/siteUrl";
import { isNonProductionDeployment } from "../lib/siteIndexing";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseUrl = getCanonicalSiteUrl();
const brandTitle = "CareersPal | Better roles. Clearer salaries.";
const brandDescription =
  "Better roles. Clearer salaries. Operations, Systems, Automation, RevOps, Product Ops, and Chief of Staff jobs with salary on every listing.";

export const metadata: Metadata = {
  metadataBase: new URL(baseUrl),
  applicationName: "CareersPal",
  title: brandTitle,
  description: brandDescription,
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "48x48" },
      { url: "/favicon-32.png", type: "image/png", sizes: "32x32" },
      { url: "/favicon-16.png", type: "image/png", sizes: "16x16" },
      { url: "/icon.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: ["/favicon.ico"],
    apple: [{ url: "/apple-touch-icon.png", type: "image/png", sizes: "180x180" }],
  },
  openGraph: {
    title: brandTitle,
    description: brandDescription,
    url: baseUrl,
    siteName: "CareersPal",
    images: [
      {
        url: "/logo-512.png",
        width: 512,
        height: 512,
        alt: "CareersPal",
      },
    ],
    locale: "en_US",
    type: "website",
  },
  twitter: {
    card: "summary",
    title: brandTitle,
    description: brandDescription,
    images: ["/logo-512.png"],
  },
  robots: isNonProductionDeployment() ? { index: false, follow: false } : undefined,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased bg-[#F8F9FD] text-slate-900`}>
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              "@context": "https://schema.org",
              "@type": "WebSite",
              name: "CareersPal",
              url: baseUrl,
              description: brandDescription,
              publisher: {
                "@type": "Organization",
                name: "CareersPal",
                url: baseUrl,
                logo: `${baseUrl}/logo-512.png`,
              },
            }),
          }}
        />
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
          <ApplyResume />
          <main>{children}</main>
          <Footer />
        </Providers>
      </body>
    </html>
  );
}
