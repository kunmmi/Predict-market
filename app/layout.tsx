import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import "./globals.css";

const displayFont = Cormorant_Garamond({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

const bodyFont = DM_Sans({
  subsets: ["latin"],
  weight: ["300", "400", "500", "600"],
  variable: "--font-sans",
  display: "swap",
});

const monoFont = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Predict Market — Crypto Prediction Markets",
  description: "Trade real-time crypto prediction markets with 5-minute rounds.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}>
      <body className="app-shell">
        <NextTopLoader
          color="#E8A020"
          shadow="0 0 10px #E8A020,0 0 5px #E8A020"
          height={2}
          showSpinner={false}
          easing="ease"
          speed={200}
        />
        {children}
      </body>
    </html>
  );
}
