import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Inherit — SST Placement Intelligence",
  description:
    "What current students leave behind for the batches that follow. Every OA, interview, and offer your batchmates have been through, searchable in one place.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Bitdefender's
          `bis_register`) inject attributes into <body> before React hydrates.
          This tolerates those attribute-only diffs on <body> only — it does
          NOT hide real hydration mismatches deeper in the tree. */}
      <body className="min-h-full antialiased" suppressHydrationWarning>
        {children}
      </body>
    </html>
  );
}
