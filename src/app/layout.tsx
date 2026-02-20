import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";
import Navbar from "@/components/Navbar";

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
          <Navbar />
          <main className="container animate-fade-in" style={{ padding: '2rem 0', flex: 1 }}>
            {children}
          </main>
          <footer className="container" style={{ padding: '2rem 0', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            &copy; {new Date().getFullYear()} Nebo Rides. All rights reserved.
          </footer>
        </Providers>
      </body>
    </html>
  );
}
