// L&D sheet row shapes + the pure mapping from a published experience's
// content (PRD §13). Two row types, matching the L&D tracker:
//   Technical  - one row per coding / system_design block
//   Behavioral - one row per behavioral block
// `open` blocks don't sync (PRD lists only these two shapes). No author
// identity in either row - anonymity (PRD §11) extends to the sheet.
//
// Column order/casing is provisional until L&D confirms their tracker's
// exact shape (PRD §15 Q6): adjust *_HEADERS and *Cells here, nothing else.

export interface SheetBlockTag {
  label: string;
  category: string; // topic_tags.category: dsa | system_design | behavioral | tooling | domain | other
  isDsa: boolean;
}

export interface SheetBlock {
  blockType: "coding" | "system_design" | "behavioral" | "open";
  prompt: string;
  detail: string | null;
  tags: SheetBlockTag[];
}

export interface SheetRound {
  name: string;
  platform: string | null;
  blocks: SheetBlock[];
}

export interface SheetExperience {
  id: string;
  company: string;
  role: string;
  year: number;
  publishedAt: Date | null;
  rounds: SheetRound[];
}

export interface TechnicalRow {
  publishedOn: string; // yyyy-mm-dd
  company: string;
  role: string;
  cycle: number; // placement year
  round: string; // pipeline label ("OA", "Tech 1", …)
  category: "Coding" | "System Design";
  topics: string[]; // non-tooling tag labels
  isDsa: boolean; // any tag with is_dsa - the L&D DSA/non-DSA split
  tools: string[]; // tooling-category tags + the round's platform
  question: string; // the prompt paraphrase
  link: string; // absolute experience URL
}

export interface BehavioralRow {
  publishedOn: string;
  company: string;
  role: string;
  round: string;
  prompt: string;
  competencies: string[]; // the block's (behavioral) tag labels
  notes: string; // "what they looked for / your approach" detail
  link: string;
}

export interface SheetRows {
  technical: TechnicalRow[];
  behavioral: BehavioralRow[];
}

// Header rows for the two tabs - paste these as row 1 when creating the sheet
// (the sync only appends data rows; it never writes headers).
export const TECHNICAL_HEADERS = [
  "Published", "Company", "Role", "Year", "Round", "Category",
  "Topics", "DSA / Non-DSA", "Tools / Tech", "Question", "Link",
] as const;
export const BEHAVIORAL_HEADERS = [
  "Published", "Company", "Role", "Round",
  "Prompt", "Competencies", "What they looked for / approach", "Link",
] as const;

const day = (d: Date | null) => (d ? d.toISOString().slice(0, 10) : "");

export function buildSheetRows(exp: SheetExperience, origin: string): SheetRows {
  const base = {
    publishedOn: day(exp.publishedAt),
    company: exp.company,
    role: exp.role,
    link: `${origin}/experiences/${exp.id}`,
  };
  const technical: TechnicalRow[] = [];
  const behavioral: BehavioralRow[] = [];
  for (const round of exp.rounds) {
    for (const b of round.blocks) {
      if (b.blockType === "coding" || b.blockType === "system_design") {
        technical.push({
          ...base,
          cycle: exp.year,
          round: round.name,
          category: b.blockType === "coding" ? "Coding" : "System Design",
          topics: b.tags.filter((t) => t.category !== "tooling").map((t) => t.label),
          isDsa: b.tags.some((t) => t.isDsa),
          tools: [
            ...b.tags.filter((t) => t.category === "tooling").map((t) => t.label),
            ...(round.platform ? [round.platform] : []),
          ],
          question: b.prompt,
        });
      } else if (b.blockType === "behavioral") {
        behavioral.push({
          ...base,
          round: round.name,
          prompt: b.prompt,
          competencies: b.tags.map((t) => t.label),
          notes: b.detail ?? "",
        });
      }
    }
  }
  return { technical, behavioral };
}

// Serialization for values.append - order must match *_HEADERS above.
type Cell = string | number;
const list = (xs: string[]) => xs.join(", ");

export const technicalCells = (r: TechnicalRow): Cell[] => [
  r.publishedOn, r.company, r.role, r.cycle, r.round, r.category,
  list(r.topics), r.isDsa ? "DSA" : "Non-DSA", list(r.tools),
  r.question, r.link,
];

export const behavioralCells = (r: BehavioralRow): Cell[] => [
  r.publishedOn, r.company, r.role, r.round,
  r.prompt, list(r.competencies), r.notes, r.link,
];
