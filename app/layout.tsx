import type { Metadata } from "next";
import { Cormorant_Garamond, DM_Sans, JetBrains_Mono } from "next/font/google";
import NextTopLoader from "nextjs-toploader";
import { ThemeProvider } from "@/lib/contexts/theme-context";
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
  viewport: "width=device-width, initial-scale=1, viewport-fit=cover",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      translate="no"
      className={`notranslate ${displayFont.variable} ${bodyFont.variable} ${monoFont.variable}`}
      data-theme="dark"
    >
      <head>
        {/*
          Disable browser auto-translation (Chrome/Edge "Translate this page").
          The app already ships native EN/ZH via the in-app language switcher, and
          browser translation rewrites DOM text nodes out from under React, which
          throws "a client-side exception" and white-screens the app.
        */}
        <meta name="google" content="notranslate" />
        {/* No-flash theme script — runs before React hydrates */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('pm-theme');if(t==='light'||t==='dark')document.documentElement.setAttribute('data-theme',t);}catch(e){}})();`,
          }}
        />
      </head>
      <body className="app-shell">
        <NextTopLoader
          color="#E8A020"
          shadow="0 0 10px #E8A020,0 0 5px #E8A020"
          height={2}
          showSpinner={false}
          easing="ease"
          speed={200}
        />
        <ThemeProvider>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
