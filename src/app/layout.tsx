import type { Metadata } from "next";

import {
  SiteFooter,
  SiteHeader,
} from "@/components/storefront/site-shell";

import "./globals.css";

export const metadata: Metadata = {
  title: {
    absolute: "Vercel Swag Store",
  },
  description:
    "Developer apparel, desk essentials, and everyday gear inspired by the things you build.",
  openGraph: {
    title: "Vercel Swag Store",
    description:
      "Developer apparel, desk essentials, and everyday gear.",
    type: "website",
    locale: "en_US",
    siteName: "Vercel Swag Store",
  },
};

// Deliberately evaluated at module initialization, not inside rendering.
// This copyright year follows the server module's lifecycle.
const copyrightYear = new Date().getFullYear();

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>
        <a className="skip-link" href="#main-content">
          Skip to content
        </a>

        <SiteHeader />

        {children}

        <SiteFooter year={copyrightYear} />
      </body>
    </html>
  );
}