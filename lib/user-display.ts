// Display helpers for the signed-in user — pure functions, safe on both
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

// "Thrishal Madasu" → "Thrishal M." — the byline style used app-wide.
// Falls back to the email's first name segment when Clerk has no name.
export function shortName(fullName?: string | null, email?: string | null): string {
  const fromEmail = (email ?? "").split("@")[0].split(".")[0];
  const name = fullName?.trim() || fromEmail;
  if (!name) return "Student";
  const parts = name.split(/\s+/);
  const first = parts[0][0].toUpperCase() + parts[0].slice(1);
  return parts.length > 1 ? `${first} ${parts[parts.length - 1][0].toUpperCase()}.` : first;
}

export function initialsOf(fullName?: string | null, email?: string | null): string {
  const name = fullName?.trim() || (email ?? "").split("@")[0].split(".")[0];
  if (!name) return "?";
  const parts = name.split(/\s+/);
  return parts.length > 1
    ? (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    : name.slice(0, 2).toUpperCase();
}
