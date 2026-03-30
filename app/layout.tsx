import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Social Value Checker | MapHorizon",
  description:
    "Identify local social need and prioritise interventions aligned to TOMS and ESG frameworks.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">

        <header
          className="flex items-center gap-3 px-6 py-4 border-b"
          style={{ background: "#00285B" }}
        >
          <img
            src="/maphorizon-logo.svg"
            alt="MapHorizon"
            className="h-8"
          />

          <div className="text-white">
            <div className="text-xs opacity-80">
              MapHorizon
            </div>

            <div className="text-lg font-semibold">
              Social Value Checker
            </div>
          </div>
        </header>

        {children}

      </body>
    </html>
  );
}
