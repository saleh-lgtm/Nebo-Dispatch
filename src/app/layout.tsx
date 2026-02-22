import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import AppLayout from "@/components/AppLayout";

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
    <html lang="en">
      <body>
        <Providers>
          <AppLayout>{children}</AppLayout>
        </Providers>
      </body>
    </html>
  );
}
