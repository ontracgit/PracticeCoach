import { useEffect, useRef, useState } from "react";
import { useConversation, useConversationClientTool } from "@elevenlabs/react";
import { ScoreBars, ProgressLine } from "./Charts";
import Stage, { Speaker } from "./Stage";
import {
  Result, normalise, average, loadHistory, saveHistory, sampleResults,
  dimensionsFor, LEVEL_LABEL, SCORE_LABEL, parseDebrief,
} from "./data";

type Line = { id: number; who: "you" | "coach" | "client"; voice?: string; text: string };

const VOICE_DESC: Record<string, string> = {
  US_Male_Senior: "US · senior", US_Male_MiddleAged: "US", US_Male_MiddleAged_Casual: "US",
  US_Male_Measured: "US", US_Male_Young: "US", US_Female_Senior: "US · senior",
  US_Female_MiddleAged: "US", US_Female_Young: "US", UK_Male_Senior: "UK · senior",
  UK_Male_MiddleAged: "UK", UK_Male_Young: "UK", UK_Female_Senior: "UK · senior",
  UK_Female_MiddleAged: "UK", UK_Female_Young: "UK", UK_Female_BritishIndian: "UK",
};

/** Split an agent message into coach text and tagged client (character) lines. */
function splitAgentMessage(msg: string): Omit<Line, "id">[] {
  const out: Omit<Line, "id">[] = [];
  const re = /<([A-Za-z_]+)>([\s\S]*?)<\/\1>/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(msg))) {
    const before = msg.slice(last, m.index).trim();
    if (before) out.push({ who: "coach", text: before });
    out.push({ who: "client", voice: m[1], text: m[2].trim() });
    last = m.index + m[0].length;
  }
  const rest = msg.slice(last).replace(/<\/?[A-Za-z_]+>/g, "").trim();
  if (rest) out.push({ who: "coach", text: rest });
  return out;
}

const DEMO_LINES: Line[] = [
  { id: -9, who: "coach", text: "Hi, I'm Clara, your communication coach. What's your name, and what's your level?" },
  { id: -8, who: "you", text: "Hi Clara, I'm Ruth. I'm a manager." },
  { id: -7, who: "coach", text: "Great to meet you, Ruth. Here are three scenarios: an easy status update, a medium cost-variance explanation, or a hard one defending your forecast to a demanding CFO. Which would you like?" },
  { id: -6, who: "you", text: "Let's do the hard one." },
  { id: -5, who: "coach", text: "I'll play David Miller, CFO of a regional bank. He's sharp with numbers and doubts your forecast. Your goal is to defend it and agree a next step. Whenever you're ready, begin." },
  { id: -4, who: "you", text: "Hi David, thanks for the time. The headline is that we expect Q4 costs to land 12 percent over plan, mainly from contractor spend." },
  { id: -3, who: "client", voice: "US_Male_MiddleAged", text: "Twelve percent. Last month you told me eight. Why should I trust this number?" },
  { id: -2, who: "you", text: "Fair question. The gap is two late invoices we've now reconciled. I can walk you through both, and I recommend we freeze new contractor hires this month." },
  { id: -1, who: "client", voice: "US_Male_MiddleAged", text: "Fine. Send me the reconciliation by Friday and we'll decide on the freeze then." },
];

export default function App() {
  const isDemo = typeof window !== "undefined" && new URLSearchParams(window.location.search).has("demo");
  const [history, setHistory] = useState<Result[]>(() => (isDemo ? sampleResults() : loadHistory()));
  const [sessionResults, setSessionResults] = useState<Result[]>(() => (isDemo ? sampleResults().slice(-2) : []));
  const [lines, setLines] = useState<Line[]>(() => (isDemo ? DEMO_LINES : []));
  const [tab, setTab] = useState<"session" | "progress">("session");
  const [error, setError] = useState<string>("");
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(Date.now());
  const [flash, setFlash] = useState(false);
  const sessionIdRef = useRef<string>("");
  // fallback state: read scores from the spoken debrief if the tool call never arrives
  const debriefBuf = useRef<string>("");
  const ctx = useRef<{ name: string; level: string; scenario: string; difficulty: string }>({ name: "", level: "unknown", scenario: "", difficulty: "custom" });
  const lastToolAt = useRef<number>(0);
  const lastParsed = useRef<{ id: string; at: number } | null>(null);
  const lineId = useRef(0);
  const transcriptRef = useRef<HTMLDivElement>(null);

  const convo = useConversation();
  const [speaker, setSpeaker] = useState<Speaker>(() => {
    const q = new URLSearchParams(window.location.search);
    const v = q.get("client") || (q.has("demo") ? "US_Male_MiddleAged" : "");
    return v ? { kind: "client", voice: v } : { kind: "coach" };
  });
  const [character, setCharacter] = useState<{ name: string; role: string }>({ name: "", role: "" });
  const connected = convo.status === "connected";
  const connecting = convo.status === "connecting";

  useEffect(() => { if (!isDemo) saveHistory(history); }, [history, isDemo]);
  useEffect(() => {
    transcriptRef.current?.scrollTo({ top: transcriptRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);
  useEffect(() => {
    if (!connected) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [connected]);

  useConversationClientTool("show_results", (params: Record<string, unknown>) => {
    const r = normalise(params, sessionIdRef.current || "session");
    lastToolAt.current = Date.now();
    debriefBuf.current = "";
    const lp = lastParsed.current;
    if (lp && Date.now() - lp.at < 120000) {
      // the debrief was already read from the transcript: replace it with the richer tool data
      setSessionResults((s) => s.map((x) => (x.id === lp.id ? r : x)));
      setHistory((h) => h.map((x) => (x.id === lp.id ? r : x)));
      lastParsed.current = null;
    } else {
      setSessionResults((s) => [...s, r]);
      setHistory((h) => [...h, r]);
    }
    setTab("session");
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
    return "Results are now shown on the learner's dashboard.";
  });

  const addLines = (ls: Omit<Line, "id">[]) =>
    setLines((prev) => [...prev, ...ls.map((l) => ({ ...l, id: ++lineId.current }))]);

  function handleCoachText(message: string) {
    const plain = message.replace(/<([A-Za-z_]+)>[\s\S]*?<\/\1>/g, " ");
    if (!ctx.current.name) {
      const nm = plain.match(/(?:thanks|thank you|nice to meet you|great to meet you|hi|hello|welcome),?\s+([A-Z][a-z]{1,20})\b/);
      if (nm && !["Clara", "I", "Let"].includes(nm[1])) ctx.current.name = nm[1];
    }
    const play = plain.match(/I'?ll (?:play|be playing) ([^.!?]{8,160}[.!?])/i);
    const who = plain.match(/I'?ll (?:play|be playing) ([A-Z][a-z]+(?: [A-Z][a-z]+)?)(?:,\s*(?:a|an|the)\s+([^,.;]{3,60}))?/);
    if (who) setCharacter({ name: who[1], role: who[2] ? who[2].trim() : "" });
    if (play) ctx.current.scenario = "Role-play with " + play[1].replace(/[.!?]$/, "");
    if (/step out of the role-?play|let'?s step out|out of character/i.test(plain)) debriefBuf.current = "";
    debriefBuf.current += " " + plain;
    if (Date.now() - lastToolAt.current < 60000) return; // tool already delivered this debrief
    const parsed = parseDebrief(debriefBuf.current);
    if (!parsed) return;
    const r = normalise(
      {
        ...parsed,
        learner_name: ctx.current.name,
        level: ctx.current.level,
        scenario: ctx.current.scenario || "Client role-play",
        difficulty: ctx.current.difficulty,
      },
      sessionIdRef.current || "session"
    );
    debriefBuf.current = "";
    lastParsed.current = { id: r.id, at: Date.now() };
    setSessionResults((s) => [...s, r]);
    setHistory((h) => [...h, r]);
    setTab("session");
    setFlash(true);
    setTimeout(() => setFlash(false), 1600);
  }

  async function start() {
    setError("");
    try {
      await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch {
      setError("Microphone access is needed to practise. Please allow the microphone and try again.");
      return;
    }
    setLines([]);
    setSessionResults([]);
    debriefBuf.current = "";
    lastParsed.current = null;
    setSpeaker({ kind: "coach" });
    setCharacter({ name: "", role: "" });
    ctx.current = { name: "", level: "unknown", scenario: "", difficulty: "custom" };
    setStartedAt(Date.now());
    convo.startSession({
      onConnect: ({ conversationId }) => { sessionIdRef.current = conversationId; },
      onMessage: ({ message, role }) => {
        if (role === "user") {
          addLines([{ who: "you", text: message }]);
          const m = message.toLowerCase();
          if (/associate director|\bad\b/.test(m)) ctx.current.level = "associate_director";
          else if (/director/.test(m)) ctx.current.level = "director";
          else if (/manager/.test(m)) ctx.current.level = "manager";
          for (const d of ["easy", "medium", "hard"]) if (new RegExp(`\\b${d}\\b`).test(m)) ctx.current.difficulty = d;
        } else {
          const parts = splitAgentMessage(message);
          addLines(parts);
          const lastClient = [...parts].reverse().find((x) => x.who === "client");
          if (lastClient?.voice) setSpeaker({ kind: "client", voice: lastClient.voice });
          else if (parts.length) setSpeaker({ kind: "coach" });
          for (const c of parts.filter((x) => x.who === "client")) {
            const intro = c.text.match(/\b(?:I'm|I am|it's|this is|my name is)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)?)\b/);
            if (intro && !["Sorry", "Just", "Not", "Fine", "Happy", "Glad"].includes(intro[1])) {
              setCharacter((ch) => (ch.name === intro[1] ? ch : { name: intro[1], role: ch.role }));
            }
          }
          handleCoachText(message);
        }
      },
      onError: (message) => setError(typeof message === "string" ? message : "Connection error"),
    });
  }

  function stop() {
    convo.endSession();
    setStartedAt(null);
  }

  const latest = sessionResults[sessionResults.length - 1];
  const prevInSession = sessionResults.length > 1 ? sessionResults[sessionResults.length - 2] : undefined;
  const elapsed = startedAt ? Math.floor((now - startedAt) / 1000) : 0;
  const mmss = `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, "0")}`;

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand">
          <span className="logo-dot" />
          <div>
            <div className="brand-name">AI Communication Coach</div>
            <div className="brand-sub">Spoken client communication practice · by OnTrac</div>
          </div>
        </div>
        <div className="topbar-right">
          <span className={"pill " + (connected ? "live" : "")}>
            {connected ? `● Live · ${mmss}` : connecting ? "Connecting…" : "Ready"}
          </span>
        </div>
      </header>

      <main className="layout">
        {/* ---------- Practice panel ---------- */}
        <section className={"card practice" + (connected || lines.length ? " in-session" : "")}>
          <Stage
            connected={connected}
            isSpeaking={convo.isSpeaking}
            speaker={speaker}
            characterName={character.name}
            characterRole={character.role}
            getOutputVolume={convo.getOutputVolume}
            getInputVolume={convo.getInputVolume}
          />
          {!connected && (
            <p className="muted intro">Clara runs a client role-play in a realistic voice, then scores you on five parameters.</p>
          )}

          <div className="controls">
            {!connected ? (
              <button className="btn primary" onClick={start} disabled={connecting}>
                {connecting ? "Connecting…" : "Start practice session"}
              </button>
            ) : (
              <>
                <button className="btn danger" onClick={stop}>End session</button>
                <button className="btn ghost" onClick={() => convo.setMuted(!convo.isMuted)}>
                  {convo.isMuted ? "Unmute mic" : "Mute mic"}
                </button>
              </>
            )}
          </div>
          {error && <div className="error">{error}</div>}

          {!connected && lines.length === 0 && (
            <div className="steps">
              <div><b>1</b> Tell Clara your name and level</div>
              <div><b>2</b> Pick an easy, medium or hard scenario</div>
              <div><b>3</b> Role-play with the client</div>
              <div><b>4</b> See your scores on the dashboard</div>
            </div>
          )}

          <div className="transcript" ref={transcriptRef} aria-live="polite">
            {lines.length === 0 ? (
              <div className="empty">The conversation transcript appears here.</div>
            ) : (
              lines.map((l) => (
                <div key={l.id} className={"msg " + l.who}>
                  <div className="who">
                    {l.who === "you" ? "You" : l.who === "coach" ? "Clara · coach" : `Client${l.voice && VOICE_DESC[l.voice] ? ` · ${VOICE_DESC[l.voice]}` : ""}`}
                  </div>
                  <div className="bubble">{l.text}</div>
                </div>
              ))
            )}
          </div>
        </section>

        {/* ---------- Dashboard ---------- */}
        <section className={"card dash" + (flash ? " flash" : "")}>
          <div className="tabs" role="tablist">
            <button role="tab" aria-selected={tab === "session"} className={tab === "session" ? "on" : ""} onClick={() => setTab("session")}>
              This session
            </button>
            <button role="tab" aria-selected={tab === "progress"} className={tab === "progress" ? "on" : ""} onClick={() => setTab("progress")}>
              Progress over time {history.length > 0 && <span className="count">{history.length}</span>}
            </button>
          </div>

          {tab === "session" && (
            latest ? <SessionView r={latest} prev={prevInSession} attempt={sessionResults.length} /> : (
              <div className="placeholder">
                <div className="ph-title">Your scores will appear here</div>
                <p className="muted">
                  After each role-play, Clara scores you from 0 to 4 on clarity &amp; structure, tone &amp; empathy,
                  choice of words, confidence, and data storytelling (managers) or influence (ADs and directors).
                </p>
                <ScaleKey />
                {history.length > 0 && (
                  <button className="btn ghost" onClick={() => setTab("progress")}>View past sessions</button>
                )}
              </div>
            )
          )}

          {tab === "progress" && (
            <ProgressView
              history={history}
              onSample={() => { setHistory(sampleResults()); }}
              onClear={() => { if (confirm("Clear all saved practice history on this device?")) setHistory([]); }}
            />
          )}
        </section>
      </main>

      <footer className="foot">
        Practice data stays in this browser. Use made-up client names and figures — never real client information.
      </footer>
    </div>
  );
}

function ScaleKey() {
  return (
    <div className="scale">
      {SCORE_LABEL.map((s, i) => (
        <div key={s}><b>{i}</b>{s}</div>
      ))}
    </div>
  );
}

function Chips({ r }: { r: Result }) {
  return (
    <div className="chips">
      {LEVEL_LABEL[r.level] && <span className="chip">{LEVEL_LABEL[r.level]}</span>}
      <span className="chip">{r.track === "influence" ? "Influence track" : "Data storytelling track"}</span>
      <span className={"chip diff " + r.difficulty}>{r.difficulty}</span>
    </div>
  );
}

function SessionView({ r, prev, attempt }: { r: Result; prev?: Result; attempt: number }) {
  const avg = average(r);
  const strengths = r.strengths.split("|").map((s) => s.trim()).filter(Boolean);
  const dims = dimensionsFor(r.track);
  const best = dims.reduce((a, b) => ((r[b.key] as number) > (r[a.key] as number) ? b : a));
  const weakest = dims.reduce((a, b) => ((r[b.key] as number) < (r[a.key] as number) ? b : a));
  return (
    <div className="session">
      <div className="hero">
        <div>
          <div className="eyebrow">{r.learner_name ? `${r.learner_name} · ` : ""}Attempt {attempt}</div>
          <div className="scenario">{r.scenario}</div>
          <Chips r={r} />
        </div>
        <div className="hero-num">
          <div className="big">{avg.toFixed(1)}<span>/4</span></div>
          <div className="muted small">Overall · {SCORE_LABEL[Math.round(avg)]}</div>
        </div>
      </div>

      <div className="tiles">
        <div className="tile"><div className="t-label">Strongest</div><div className="t-val">{best.label}</div></div>
        <div className="tile"><div className="t-label">Focus next</div><div className="t-val">{weakest.label}</div></div>
        <div className="tile">
          <div className="t-label">vs. previous attempt</div>
          <div className="t-val">
            {prev ? `${avg - average(prev) >= 0 ? "+" : ""}${(avg - average(prev)).toFixed(1)}` : "—"}
          </div>
        </div>
      </div>

      <h3>Scores by parameter</h3>
      <ScoreBars current={r} previous={prev} />

      {r.attempt_note && <div className="note good">↗ {r.attempt_note}</div>}

      <div className="two">
        <div className="panel">
          <h4>What worked</h4>
          <ul>{strengths.map((s) => <li key={s}>{s}</li>)}</ul>
        </div>
        <div className="panel">
          <h4>One thing to change</h4>
          <p>{r.top_improvement}</p>
          {r.stronger_line && (
            <>
              <div className="label-sm">Try saying it like this</div>
              <blockquote>“{r.stronger_line}”</blockquote>
            </>
          )}
        </div>
      </div>

      <details className="reasons">
        <summary>Why these scores</summary>
        <table>
          <tbody>
            {dims.map((d) => (
              <tr key={d.key as string}>
                <th>{d.label}</th>
                <td className="num">{r[d.key] as number}/4</td>
                <td>{r[d.reasonKey] as string}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

function ProgressView({ history, onSample, onClear }: { history: Result[]; onSample: () => void; onClear: () => void }) {
  if (history.length === 0) {
    return (
      <div className="placeholder">
        <div className="ph-title">No practice sessions yet</div>
        <p className="muted">Each scored role-play is saved here so you can see your progress over weeks of practice.</p>
        <button className="btn ghost" onClick={onSample}>Load sample learner data</button>
      </div>
    );
  }
  const first = history[0];
  const last = history[history.length - 1];
  const dims = dimensionsFor(last.track);
  const gain = average(last) - average(first);
  return (
    <div className="progress">
      <div className="tiles">
        <div className="tile"><div className="t-label">Scored attempts</div><div className="t-val big2">{history.length}</div></div>
        <div className="tile"><div className="t-label">Latest overall</div><div className="t-val big2">{average(last).toFixed(1)}<small>/4</small></div></div>
        <div className="tile"><div className="t-label">Change since first</div><div className={"t-val big2 " + (gain >= 0 ? "pos" : "neg")}>{gain >= 0 ? "+" : ""}{gain.toFixed(1)}</div></div>
      </div>

      <h3>Overall score per attempt</h3>
      {history.length > 1 ? <ProgressLine history={history} /> : <p className="muted">Complete one more role-play to see a trend.</p>}

      <h3>Where you started vs. where you are</h3>
      <ScoreBars current={last} previous={first} labels={["Latest attempt", "First attempt"]} />
      <p className="muted small">The goal is to move every parameter from 0–1 to 2–3 with regular practice.</p>

      <h3>All attempts</h3>
      <div className="table-wrap">
        <table className="hist">
          <thead>
            <tr><th>Date</th><th>Scenario</th><th>Level</th>{dims.map((d) => <th key={d.key as string} className="num">{d.label.split(" ")[0]}</th>)}<th className="num">Avg</th></tr>
          </thead>
          <tbody>
            {[...history].reverse().map((r) => (
              <tr key={r.id}>
                <td>{new Date(r.at).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</td>
                <td className="scen">{r.scenario} <span className={"chip diff " + r.difficulty}>{r.difficulty}</span></td>
                <td>{LEVEL_LABEL[r.level] || "—"}</td>
                {dimensionsFor(r.track).map((d) => <td key={d.key as string} className="num">{r[d.key] as number}</td>)}
                <td className="num"><b>{average(r).toFixed(1)}</b></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="row-end">
        <button className="btn ghost small" onClick={onClear}>Clear history</button>
      </div>
    </div>
  );
}
