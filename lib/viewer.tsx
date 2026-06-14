"use client";

// The viewer identity, resolved SERVER-side in the root layout (Clerk in
// normal operation, the dev-impersonation cookie under `next dev` - §7) and
// passed down as a DTO. Client components consume THIS, not Clerk's
// useUser(), so display identity has one source of truth and the auth vendor
// stays swappable (and headless dev testing works without a Clerk session).
import { createContext, useContext } from "react";

export interface Viewer {
  name: string;
  email: string;
  isOps: boolean;
  /** Google/Clerk profile photo URL; null when the account has no real image
   * (we fall back to the initials chip). */
  imageUrl: string | null;
  /** true only under dev impersonation - flips sign-out to /dev-login?off */
  dev: boolean;
}

const ViewerContext = createContext<Viewer | null>(null);

export function ViewerProvider({
  viewer,
  children,
}: {
  viewer: Viewer | null;
  children: React.ReactNode;
}) {
  return <ViewerContext.Provider value={viewer}>{children}</ViewerContext.Provider>;
}

// null while signed out (the sign-in/sign-up routes render through the layout).
export const useViewer = () => useContext(ViewerContext);
