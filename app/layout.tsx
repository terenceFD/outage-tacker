import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Plus_Jakarta_Sans, Inter } from "next/font/google";
import SWRegister from "./SWRegister";
import "./globals.css";

// Fonts recommended in "outage tracker.pdf" §7 and "complete.pdf" §5 Fonts:
// Plus Jakarta Sans (headings), Inter (body, tabular numbers), Latin subset, display: swap.
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["600", "700"],
  display: "swap",
  variable: "--font-heading-jakarta",
});

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
  variable: "--font-body-inter",
});

export const metadata: Metadata = {
  title: "Outage Tracker",
  description: "Track power and water outages in your quartier",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Outages",
  },
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
  },
};

// Next 16: theme-color belongs in the viewport export, not metadata.
export const viewport: Viewport = {
  themeColor: "#14365d",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      className={`h-full antialiased ${jakarta.variable} ${inter.variable}`}
    >
      <body className="page-bg min-h-full flex flex-col text-text">
        {children}
        <SWRegister />
      </body>
    </html>
  );
}
