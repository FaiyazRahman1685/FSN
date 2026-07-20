import type { Metadata } from "next";
import { Press_Start_2P } from "next/font/google";
import "./globals.css";

const pressStart2P = Press_Start_2P({
  subsets: ["latin"],
  weight: "400",
  variable: "--font-press-start",
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
    <html lang="en" className={`${pressStart2P.variable} h-full`}>
      <body
        className={`${pressStart2P.className} font-sans min-h-full flex flex-col`}
      >
        {children}
      </body>
    </html>
  );
}
