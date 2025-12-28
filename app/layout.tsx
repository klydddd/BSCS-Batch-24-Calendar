import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
// DELETE THIS LINE: import "./googleefe58c37a587b98b.html";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "BSCS Calendar",
  description: "BSCS Batch 2025 Exclusive Calendar Automation",
  verification: {
    google: "googleefe58c37a587b98b.html",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={inter.className}>
        {children}
      </body>
    </html>
  );
}