// Minimal className joiner — filters falsy values and joins with spaces.
// We control all class strings ourselves, so tailwind-merge isn't needed.
export type ClassValue = string | number | false | null | undefined;

export function cn(...values: ClassValue[]): string {
  return values.filter(Boolean).join(" ");
}
