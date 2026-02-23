import type { Metadata } from "next";
import { Open_Sans, Poppins } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";
import AppLayout from "@/components/AppLayout";

// Optimized font loading with next/font (no render-blocking)
const openSans = Open_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Nebo Dispatch | Internal Application",
  description: "Internal shift reporting and scheduling for Nebo Dispatch Team",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${openSans.variable} ${poppins.variable}`}>
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
