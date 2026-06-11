import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { ensureDbUser } from "@/lib/auth";
import { RestrictedScreen } from "@/components/restricted-screen";
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

// Clerk components themed to the app's design tokens (globals.css @theme).
// Direct values, not var() — Clerk derives shades via color-mix at runtime.
const clerkAppearance = {
  variables: {
    colorPrimary: "#2ea0f8",
    colorPrimaryForeground: "#ffffff",
    colorBackground: "#0d121d",
    colorForeground: "#f1f5f9",
    colorMutedForeground: "#9aa6b8",
    colorMuted: "#151c2a",
    colorInput: "#090c15",
    colorInputForeground: "#f1f5f9",
    colorNeutral: "#f1f5f9",
    colorDanger: "#ef5a5a",
    colorSuccess: "#2ecf85",
    colorWarning: "#f5b544",
    colorBorder: "rgba(255, 255, 255, 0.12)",
    colorRing: "rgba(46, 160, 248, 0.4)",
    colorShadow: "rgba(0, 0, 0, 0.6)",
    colorModalBackdrop: "rgba(0, 0, 0, 0.6)",
    borderRadius: "10px",
    fontFamily: "var(--font-inter), ui-sans-serif, system-ui, sans-serif",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Domain gate + first-sign-in mirror into our `users` table (handbook §3).
  const gate = await ensureDbUser();

  return (
    <html lang="en" className={`${inter.variable} h-full`}>
      {/* suppressHydrationWarning: browser extensions (e.g. Bitdefender's
          `bis_register`) inject attributes into <body> before React hydrates.
          This tolerates those attribute-only diffs on <body> only — it does
          NOT hide real hydration mismatches deeper in the tree. */}
      <body className="min-h-full antialiased" suppressHydrationWarning>
        <ClerkProvider
          appearance={clerkAppearance}
          signInUrl="/sign-in"
          signUpUrl="/sign-up"
          afterSignOutUrl="/sign-in"
        >
          {gate.status === "wrong-domain" ? (
            <RestrictedScreen email={gate.email} />
          ) : (
            children
          )}
        </ClerkProvider>
      </body>
    </html>
  );
}
