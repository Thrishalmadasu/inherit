// Display helpers for the signed-in user - pure functions, safe on both
// server and client. SST emails encode the joining year:
// "thrishal.23bcs10115@sst.scaler.com" → joined 2023 → batch of '27.

export function batchYearFromEmail(email?: string | null): number | null {
  const m = /\.(\d{2})[a-z]{2,4}\d+@/i.exec(email ?? "");
  return m ? 2000 + Number(m[1]) + 4 : null;
}

// "'27"-style label; empty string when the email doesn't carry a year.
export function batchLabelFromEmail(email?: string | null): string {
  const year = batchYearFromEmail(email);
  return year ? `'${String(year).slice(-2)}` : "";
}

// Google profile names are often junk ("THRISHAL .", "RIYA K 23BCS10043"):
// drop parts that aren't pure words (lone punctuation, roll numbers) and
// de-SHOUT all-caps parts.
export function cleanPersonName(raw?: string | null): string {
  return (raw ?? "")
    .split(/\s+/)
    .filter((p) => /\p{L}/u.test(p) && !/\d/.test(p))
    .map((p) => (p === p.toUpperCase() ? p[0] + p.slice(1).toLowerCase() : p))
    .join(" ");
}

function nameParts(fullName?: string | null, email?: string | null): string[] {
  const name = cleanPersonName(fullName) || (email ?? "").split("@")[0].split(".")[0];
  return name ? name.split(/\s+/).map((p) => p[0].toUpperCase() + p.slice(1)) : [];
}

// "Thrishal Madasu" → "Thrishal M." - the byline style used app-wide.
// Falls back to the email's first name segment when Clerk has no name.
export function shortName(fullName?: string | null, email?: string | null): string {
  const parts = nameParts(fullName, email);
  if (!parts.length) return "Student";
  return parts.length > 1 ? `${parts[0]} ${parts[parts.length - 1][0]}.` : parts[0];
}

export function initialsOf(fullName?: string | null, email?: string | null): string {
  const parts = nameParts(fullName, email);
  if (!parts.length) return "?";
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : parts[0].slice(0, 2).toUpperCase();
}
