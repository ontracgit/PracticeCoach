export type Result = {
  id: string;
  at: number; // epoch ms
  sessionId: string;
  learner_name: string;
  level: string;
  track: "data_storytelling" | "influence";
  scenario: string;
  difficulty: string;
  score_clarity_structure: number;
  score_tone_empathy: number;
  score_word_choice: number;
  score_confidence: number;
  score_track_skill: number;
  reason_clarity_structure: string;
  reason_tone_empathy: string;
  reason_word_choice: string;
  reason_confidence: string;
  reason_track_skill: string;
  strengths: string;
  top_improvement: string;
  stronger_line: string;
  attempt_note?: string;
};

export type Dimension = {
  key: keyof Result;
  reasonKey: keyof Result;
  label: string;
};

export function dimensionsFor(track: Result["track"]): Dimension[] {
  return [
    { key: "score_clarity_structure", reasonKey: "reason_clarity_structure", label: "Clarity & structure" },
    { key: "score_tone_empathy", reasonKey: "reason_tone_empathy", label: "Tone & empathy" },
    { key: "score_word_choice", reasonKey: "reason_word_choice", label: "Choice of words" },
    { key: "score_confidence", reasonKey: "reason_confidence", label: "Confidence & presence" },
    {
      key: "score_track_skill",
      reasonKey: "reason_track_skill",
      label: track === "influence" ? "Influence" : "Data storytelling",
    },
  ];
}

export const LEVEL_LABEL: Record<string, string> = {
  manager: "Manager",
  associate_director: "Associate Director",
  director: "Director",
  unknown: "",
};

export const SCORE_LABEL = ["Not yet shown", "Developing", "Competent", "Strong", "Exemplary"];

const clamp = (n: unknown) => {
  const v = Math.round(Number(n));
  return Number.isFinite(v) ? Math.max(0, Math.min(4, v)) : 0;
};

export function normalise(raw: Record<string, unknown>, sessionId: string): Result {
  const s = (k: string) => (typeof raw[k] === "string" ? (raw[k] as string) : "");
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    at: Date.now(),
    sessionId,
    learner_name: s("learner_name"),
    level: s("level") || "unknown",
    track: s("track") === "influence" ? "influence" : "data_storytelling",
    scenario: s("scenario"),
    difficulty: s("difficulty") || "custom",
    score_clarity_structure: clamp(raw.score_clarity_structure),
    score_tone_empathy: clamp(raw.score_tone_empathy),
    score_word_choice: clamp(raw.score_word_choice),
    score_confidence: clamp(raw.score_confidence),
    score_track_skill: clamp(raw.score_track_skill),
    reason_clarity_structure: s("reason_clarity_structure"),
    reason_tone_empathy: s("reason_tone_empathy"),
    reason_word_choice: s("reason_word_choice"),
    reason_confidence: s("reason_confidence"),
    reason_track_skill: s("reason_track_skill"),
    strengths: s("strengths"),
    top_improvement: s("top_improvement"),
    stronger_line: s("stronger_line"),
    attempt_note: s("attempt_note"),
  };
}

export function average(r: Result): number {
  const d = dimensionsFor(r.track);
  return d.reduce((sum, x) => sum + (r[x.key] as number), 0) / d.length;
}

// ---- local history (per browser) ----
const KEY = "ontrac-coach-history-v1";

export function loadHistory(): Result[] {
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Result[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(list: Result[]) {
  try {
    localStorage.setItem(KEY, JSON.stringify(list.slice(-200)));
  } catch {
    /* storage unavailable */
  }
}

// ---- sample data for demo mode ----
export function sampleResults(): Result[] {
  const day = 24 * 3600 * 1000;
  const base = Date.now() - 20 * day;
  const mk = (
    i: number,
    scores: [number, number, number, number, number],
    scenario: string,
    difficulty: string,
    extra: Partial<Result> = {}
  ): Result => ({
    id: `sample-${i}`,
    at: base + i * 3 * day,
    sessionId: `sample-session-${i}`,
    learner_name: "Ruth",
    level: "manager",
    track: "data_storytelling",
    scenario,
    difficulty,
    score_clarity_structure: scores[0],
    score_tone_empathy: scores[1],
    score_word_choice: scores[2],
    score_confidence: scores[3],
    score_track_skill: scores[4],
    reason_clarity_structure: "Opened with the headline variance before the background.",
    reason_tone_empathy: "Acknowledged the CFO's frustration about the late numbers before explaining.",
    reason_word_choice: "Fewer fillers than last time; 'basically' came up twice.",
    reason_confidence: "Held the position when the CFO challenged the forecast.",
    reason_track_skill: "Explained why the 12% overrun matters and proposed a next step.",
    strengths:
      "Led with the key number: 'costs are 12 percent over, mainly from contractor spend' | Acknowledged the CFO's concern before answering",
    top_improvement: "Close with a specific ask and date instead of 'let us know your thoughts'.",
    stronger_line:
      "My recommendation is that we freeze new contractor hires this month. Can we agree that by Friday?",
    ...extra,
  });
  return [
    mk(0, [1, 1, 1, 1, 0], "Monthly status update to a friendly finance manager", "easy"),
    mk(1, [1, 2, 1, 1, 1], "Explaining a 12% cost variance to Mark Thompson, Financial Controller", "medium"),
    mk(2, [2, 2, 1, 2, 1], "Delivering a one-week delay to a busy US project lead", "medium"),
    mk(3, [2, 2, 2, 2, 2], "Explaining a 12% cost variance to Mark Thompson, Financial Controller", "medium"),
    mk(4, [2, 3, 2, 2, 2], "Defending the forecast to David Miller, a CFO who challenges every number", "hard"),
    mk(5, [3, 3, 2, 3, 3], "Defending the forecast to David Miller, a CFO who challenges every number", "hard", {
      attempt_note: "Much stronger opening: you led with the answer and kept the CFO on your structure.",
    }),
  ];
}

// ---- fallback: read scores from Clara's spoken debrief ----
const NUM: Record<string, number> = { zero: 0, one: 1, two: 2, three: 3, four: 4, "0": 0, "1": 1, "2": 2, "3": 3, "4": 4 };
const SCORE_RE = String.raw`\s*(?:is|was|gets|scores?)?\s*[:,\-–—]?\s*(?:a\s+)?(zero|one|two|three|four|[0-4])(?![0-9])(?:\s*(?:out of|\/)\s*(?:four|4))?`;
const DIMS: { key: string; re: string }[] = [
  { key: "clarity_structure", re: String.raw`clarity(?:\s*(?:and|&)\s*structure)?` },
  { key: "tone_empathy", re: String.raw`tone(?:\s*(?:and|&)\s*empathy)?` },
  { key: "word_choice", re: String.raw`(?:choice of words|word choice)` },
  { key: "confidence", re: String.raw`confidence(?:\s*(?:and|&)\s*presence)?` },
  { key: "track_skill", re: String.raw`(data storytelling|influence)` },
];

function firstSentence(s: string): string {
  const t = s.replace(/^\s*[.:,\-–—]\s*/, "").trim();
  const m = t.match(/^(.{10,240}?[.!?])(\s|$)/);
  return (m ? m[1] : t.slice(0, 200)).trim();
}

/** Returns a Result-like record if the text contains all five spoken scores, else null. */
export function parseDebrief(text: string): Record<string, unknown> | null {
  const clean = text.replace(/<\/?[A-Za-z_]+>/g, " ").replace(/\s+/g, " ");
  const found: { key: string; score: number; start: number; end: number; label: string }[] = [];
  for (const d of DIMS) {
    const re = new RegExp(d.re + SCORE_RE, "gi");
    let m: RegExpExecArray | null;
    let last: (typeof found)[number] | null = null;
    while ((m = re.exec(clean))) {
      const numStr = m[m.length - 1].toLowerCase();
      last = { key: d.key, score: NUM[numStr], start: m.index, end: m.index + m[0].length, label: m[0] };
    }
    if (!last) return null;
    found.push(last);
  }
  const ordered = [...found].sort((a, b) => a.start - b.start);
  const reason = (k: string) => {
    const f = found.find((x) => x.key === k)!;
    const next = ordered.find((x) => x.start > f.start);
    return firstSentence(clean.slice(f.end, next ? next.start : f.end + 300));
  };
  const after = clean.slice(ordered[ordered.length - 1].end);
  const strengthsM = after.match(/(?:things?|what)\s+(?:that\s+)?worked(?:\s+well)?[.:,]?\s*(.+?)(?=(?:the\s+)?(?:one\s+)?(?:highest[- ]impact|thing to change|one thing to)|$)/i);
  const strengths = strengthsM
    ? strengthsM[1].split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 8).slice(0, 2).join(" | ")
    : "";
  const impM = after.match(/(?:highest[- ]impact[^.]*?|one thing to change[^.]*?)(?:is|:)\s+(?:to\s+)?(.+?[.!?])(\s|$)/i);
  const lineM = after.match(/try(?:\s+saying)?[:,]?\s*["“]([^"”]{10,300})["”]/i);
  const trackLabel = found.find((x) => x.key === "track_skill")!.label.toLowerCase();
  return {
    track: trackLabel.includes("influence") ? "influence" : "data_storytelling",
    score_clarity_structure: found[0].score,
    score_tone_empathy: found[1].score,
    score_word_choice: found[2].score,
    score_confidence: found[3].score,
    score_track_skill: found[4].score,
    reason_clarity_structure: reason("clarity_structure"),
    reason_tone_empathy: reason("tone_empathy"),
    reason_word_choice: reason("word_choice"),
    reason_confidence: reason("confidence"),
    reason_track_skill: reason("track_skill"),
    strengths,
    top_improvement: impM ? impM[1].charAt(0).toUpperCase() + impM[1].slice(1) : "",
    stronger_line: lineM ? lineM[1].trim() : "",
  };
}
