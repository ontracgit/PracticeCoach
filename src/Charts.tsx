import { useState } from "react";
import { Result, dimensionsFor, SCORE_LABEL, average } from "./data";

/** Horizontal 0-4 bars, one per parameter. Optional previous attempt shown as a second series. */
export function ScoreBars({
  current, previous, labels = ["This attempt", "Previous attempt"],
}: { current: Result; previous?: Result; labels?: [string, string] }) {
  const dims = dimensionsFor(current.track);
  const [hover, setHover] = useState<number | null>(null);
  return (
    <div className="viz-root">
      {previous && (
        <div className="legend" aria-hidden="true">
          <span><i className="swatch s1" /> {labels[0]}</span>
          <span><i className="swatch s2" /> {labels[1]}</span>
        </div>
      )}
      <div className="bars" role="table" aria-label="Scores by parameter, 0 to 4">
        {dims.map((d, i) => {
          const v = current[d.key] as number;
          const p = previous ? (previous[d.key] as number) : undefined;
          const delta = p === undefined ? 0 : v - p;
          return (
            <div
              className={"bar-row" + (hover === i ? " is-hover" : "")}
              role="row"
              key={d.key as string}
              onMouseEnter={() => setHover(i)}
              onMouseLeave={() => setHover(null)}
            >
              <div className="bar-label" role="rowheader">{d.label}</div>
              <div className="bar-track" role="cell">
                {[1, 2, 3].map((g) => (
                  <span key={g} className="gl" style={{ left: `${(g / 4) * 100}%` }} />
                ))}
                <div className="bar s1" style={{ width: `${Math.max(v, 0.08) / 4 * 100}%` }} />
                {p !== undefined && (
                  <div className="bar s2 thin" style={{ width: `${Math.max(p, 0.08) / 4 * 100}%` }} />
                )}
                {hover === i && (
                  <div className="tip">
                    <strong>{d.label}: {v}/4 · {SCORE_LABEL[v]}</strong>
                    {p !== undefined && <div>{labels[1]}: {p}/4</div>}
                    <div className="tip-reason">{current[d.reasonKey] as string}</div>
                  </div>
                )}
              </div>
              <div className="bar-value" role="cell">
                {v}<span className="of">/4</span>
                {p !== undefined && delta !== 0 && (
                  <span className={"delta " + (delta > 0 ? "up" : "down")}>
                    {delta > 0 ? "▲" : "▼"} {Math.abs(delta)}
                  </span>
                )}
              </div>
            </div>
          );
        })}
        <div className="bar-axis">
          <span />
          <div className="axis-ticks">
            {[0, 1, 2, 3, 4].map((t) => (
              <span key={t} style={{ left: `${(t / 4) * 100}%` }}>{t}</span>
            ))}
          </div>
          <span />
        </div>
      </div>
    </div>
  );
}

/** Line of average score per practice attempt, with crosshair tooltip. */
export function ProgressLine({ history }: { history: Result[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 560, H = 200, L = 32, R = 16, T = 16, B = 28;
  const pts = history.map((r, i) => ({
    x: L + (history.length === 1 ? (W - L - R) / 2 : (i / (history.length - 1)) * (W - L - R)),
    y: T + (1 - average(r) / 4) * (H - T - B),
    r,
  }));
  const path = pts.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const target = T + (1 - 3 / 4) * (H - T - B);
  const fmt = (t: number) => new Date(t).toLocaleDateString(undefined, { day: "numeric", month: "short" });

  return (
    <div className="viz-root line-wrap">
      <svg viewBox={`0 0 ${W} ${H}`} className="line-svg" role="img"
        aria-label={`Average score across ${history.length} attempts, latest ${average(history[history.length - 1]).toFixed(1)} out of 4`}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = (e.currentTarget as SVGSVGElement).getBoundingClientRect();
          const x = ((e.clientX - rect.left) / rect.width) * W;
          let best = 0;
          pts.forEach((p, i) => { if (Math.abs(p.x - x) < Math.abs(pts[best].x - x)) best = i; });
          setHover(best);
        }}>
        {[0, 1, 2, 3, 4].map((t) => {
          const y = T + (1 - t / 4) * (H - T - B);
          return (
            <g key={t}>
              <line x1={L} x2={W - R} y1={y} y2={y} className="gridline" />
              <text x={L - 10} y={y + 4} className="axis-text" textAnchor="end">{t}</text>
            </g>
          );
        })}
        <line x1={L} x2={W - R} y1={target} y2={target} className="target-line" />
        <text x={W - R} y={target - 6} className="axis-text" textAnchor="end">Target proficiency (3)</text>
        <path d={path} className="series-line" />
        {pts.map((p, i) => (
          <circle key={i} cx={p.x} cy={p.y} r={hover === i ? 6 : 4.5} className="series-dot" />
        ))}
        {hover !== null && (
          <line x1={pts[hover].x} x2={pts[hover].x} y1={T} y2={H - B} className="crosshair" />
        )}
        <text x={pts[0].x} y={H - 8} className="axis-text" textAnchor="start">{fmt(history[0].at)}</text>
        {history.length > 1 && (
          <text x={pts[pts.length - 1].x} y={H - 8} className="axis-text" textAnchor="end">
            {fmt(history[history.length - 1].at)}
          </text>
        )}
      </svg>
      {hover !== null && (
        <div className="line-tip" style={{ left: `${(pts[hover].x / W) * 100}%` }}>
          <strong>Attempt {hover + 1} · {average(pts[hover].r).toFixed(1)}/4</strong>
          <div>{fmt(pts[hover].r.at)} · {pts[hover].r.difficulty}</div>
          <div className="tip-reason">{pts[hover].r.scenario}</div>
        </div>
      )}
    </div>
  );
}
