import type { Metadata, Viewport } from "next";
import { Hind, Tiro_Devanagari_Sanskrit } from "next/font/google";
import { Providers } from "./providers";
import "./globals.css";

const hind = Hind({
  subsets: ["latin", "devanagari"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-hind",
});

const tiro = Tiro_Devanagari_Sanskrit({
  subsets: ["devanagari", "latin"],
  weight: ["400"],
  variable: "--font-tiro",
});

export const metadata: Metadata = {
  title: "Smriti — स्मृति",
  description: "Aapki sehat ki kahani, hamesha yaad rahegi.",
  appleWebApp: {
    capable: true,
    title: "Smriti",
  },
};

export const viewport: Viewport = {
  themeColor: "#a8553f",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="hi">
      <body className={`${hind.variable} ${tiro.variable} font-sans antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
