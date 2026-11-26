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
