import type { Metadata } from "next";
import { Pixelify_Sans } from "next/font/google";
import "./globals.css";

const pixelifySans = Pixelify_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-pixelify-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Pitch Runner",
  description: "Endless soccer runner — dodge defenders and survive",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${pixelifySans.variable} h-full`}>
      <body
        className={`${pixelifySans.className} font-sans min-h-full flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
