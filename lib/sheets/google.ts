// Google Sheets driver: service-account JWT → OAuth access token →
// spreadsheets.values.append, all over plain fetch + node:crypto.
// Zero deps on purpose: the googleapis meta-package is ~80MB of generated
// clients (cold-start weight on Vercel) when all we need is one signed JWT
// and one REST endpoint. The JWT-bearer flow is Google's stable, documented
// path for service accounts.
//
// Env (both required for this driver to be selected):
//   GOOGLE_SERVICE_ACCOUNT_KEY - the service account's JSON key, verbatim
//   LD_SHEET_ID                - the target spreadsheet id (from its URL)
// The sheet must be SHARED with the service account's client_email (Editor).
import { createSign } from "node:crypto";
import type { SheetSync } from "./index";
import { behavioralCells, technicalCells } from "./rows";

// Tab names in the L&D sheet (override if their tracker names differ).
const TECHNICAL_TAB = process.env.LD_SHEET_TECHNICAL_TAB ?? "Technical";
const BEHAVIORAL_TAB = process.env.LD_SHEET_BEHAVIORAL_TAB ?? "Behavioral";

function credentials(): { clientEmail: string; privateKey: string } {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_KEY;
  if (!raw) throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is not set");
  const json = JSON.parse(raw) as { client_email?: string; private_key?: string };
  if (!json.client_email || !json.private_key)
    throw new Error("GOOGLE_SERVICE_ACCOUNT_KEY is missing client_email/private_key");
  // Vercel env vars often arrive with the key's newlines escaped.
  return { clientEmail: json.client_email, privateKey: json.private_key.replace(/\\n/g, "\n") };
}

// Module-scope token cache - warm serverless invocations reuse it.
let cached: { token: string; expiresAt: number } | null = null;

async function accessToken(): Promise<string> {
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
  const { clientEmail, privateKey } = credentials();
  const now = Math.floor(Date.now() / 1000);
  const b64 = (o: object) => Buffer.from(JSON.stringify(o)).toString("base64url");
  const unsigned = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: clientEmail,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  })}`;
  const signature = createSign("RSA-SHA256").update(unsigned).sign(privateKey, "base64url");
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: `${unsigned}.${signature}`,
    }),
  });
  if (!res.ok)
    throw new Error(`Google token exchange failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cached = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cached.token;
}

async function appendValues(tab: string, values: (string | number)[][]): Promise<void> {
  const sheetId = process.env.LD_SHEET_ID;
  if (!sheetId) throw new Error("LD_SHEET_ID is not set");
  const token = await accessToken();
  const range = encodeURIComponent(`${tab}!A1`);
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${sheetId}/values/${range}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ values }),
    },
  );
  if (!res.ok)
    throw new Error(`Sheets append to "${tab}" failed: ${res.status} ${(await res.text()).slice(0, 300)}`);
}

export const googleSheetSync: SheetSync = {
  async appendPublished(rows) {
    if (rows.technical.length)
      await appendValues(TECHNICAL_TAB, rows.technical.map(technicalCells));
    if (rows.behavioral.length)
      await appendValues(BEHAVIORAL_TAB, rows.behavioral.map(behavioralCells));
  },
};
