import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import "./readability.css";
import { siteOrigin } from "@/lib/site-metadata";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const baseMetadata: Metadata = {
  title: "Reliable Snitch — Civic Disruption Management",
  description:
    "Spot it. Report it. Resolve it. A shared workspace for citizen reports and transparent civic action.",
  openGraph: {
    title: "Reliable Snitch",
    description: "Spot it. Report it. Resolve it.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Reliable Snitch",
    description: "Spot it. Report it. Resolve it.",
  },
};
export function generateMetadata(): Metadata {
  const origin = siteOrigin();
  const images = origin
    ? [
        {
          url: new URL("/og.png", origin).href,
          width: 1731,
          height: 909,
          alt: "Reliable Snitch — Spot it. Report it. Resolve it.",
        },
      ]
    : [];
  return {
    ...baseMetadata,
    metadataBase: origin,
    openGraph: { ...baseMetadata.openGraph, images },
    twitter: {
      ...baseMetadata.twitter,
      images: images.map((image) => image.url),
    },
    icons: { icon: "/icon" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
