import type { Metadata } from "next";
import { Special_Elite, VT323 } from "next/font/google";
import "./globals.css";

const specialElite = Special_Elite({
  variable: "--font-heading",
  weight: "400",
  subsets: ["latin"],
});

const vt323 = VT323({
  variable: "--font-body",
  weight: "400",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Desktop Portfolio",
  description: "A monochrome desktop portfolio powered by GitHub.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${specialElite.variable} ${vt323.variable}`}>
      <body>{children}</body>
    </html>
  );
}
