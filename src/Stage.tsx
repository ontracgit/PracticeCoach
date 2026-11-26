import { useEffect, useRef, useState } from "react";

export type Speaker = { kind: "coach" } | { kind: "client"; voice: string };

/** Default display info per character voice. Persona voices carry the persona's name. */
export const CHARACTERS: Record<string, { name: string; role: string; region: string }> = {
  US_Male_MiddleAged: { name: "David Miller", role: "CFO, regional bank", region: "US" },
  US_Male_MiddleAged_Casual: { name: "Mark Thompson", role: "Financial Controller", region: "US" },
  US_Male_Measured: { name: "Robert Chen", role: "Head of Internal Audit", region: "US" },
  US_Female_MiddleAged: { name: "Jennifer Cole", role: "Chief Operating Officer", region: "US" },
  UK_Male_Senior: { name: "Graham Hughes", role: "Head of Procurement", region: "UK" },
  UK_Female_Senior: { name: "Linda Walsh", role: "Managing Director", region: "UK" },
  UK_Female_MiddleAged: { name: "Sarah Bennett", role: "Chief Financial Officer", region: "UK" },
  UK_Female_BritishIndian: { name: "Priya Shah", role: "VP Finance Transformation", region: "UK" },
  US_Male_Senior: { name: "Client", role: "Senior executive", region: "US" },
  US_Male_Young: { name: "Client", role: "Client manager", region: "US" },
  US_Female_Senior: { name: "Client", role: "Senior executive", region: "US" },
  US_Female_Young: { name: "Client", role: "Client manager", region: "US" },
  UK_Male_MiddleAged: { name: "Client", role: "Finance director", region: "UK" },
  UK_Male_Young: { name: "Client", role: "Client manager", region: "UK" },
  UK_Female_Young: { name: "Client", role: "Client manager", region: "UK" },
};

const PERSONA_NAMES = new Set(Object.values(CHARACTERS).map((c) => c.name).filter((n) => n !== "Client"));

type Props = {
  connected: boolean;
  isSpeaking: boolean;
  speaker: Speaker;
  characterName?: string; // name Clara announced, e.g. "I'll play Tom, a CFO"
  getOutputVolume: () => number;
  getInputVolume: () => number;
};

export default function Stage({ connected, isSpeaking, speaker, characterName, getOutputVolume, getInputVolume }: Props) {
  const stageRef = useRef<HTMLDivElement>(null);
  const [imgFailed, setImgFailed] = useState<Record<string, boolean>>({});
  const smooth = useRef(0);
  const smoothIn = useRef(0);

  // Drive the ripple size from live audio levels without re-rendering React.
  useEffect(() => {
    let raf = 0;
    const tick = () => {
      let out = 0, inp = 0;
      try { out = connected ? getOutputVolume() : 0; } catch { /* not ready */ }
      try { inp = connected ? getInputVolume() : 0; } catch { /* not ready */ }
      smooth.current += (Math.min(1, out * 2.2) - smooth.current) * 0.25;
      smoothIn.current += (Math.min(1, inp * 2.5) - smoothIn.current) * 0.25;
      stageRef.current?.style.setProperty("--lvl", smooth.current.toFixed(3));
      stageRef.current?.style.setProperty("--in", smoothIn.current.toFixed(3));
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [connected, getOutputVolume, getInputVolume]);

  const isClient = speaker.kind === "client";
  const info = isClient ? CHARACTERS[speaker.voice] : undefined;
  const displayName = isClient
    ? (info && PERSONA_NAMES.has(info.name) ? info.name : characterName || info?.name || "Client")
    : "Clara";
  const subtitle = isClient
    ? `${info?.role ?? "Client"}${info ? ` · ${info.region}` : ""}`
    : "Communication coach";
  const talking = connected && isSpeaking;
  const status = !connected
    ? "Press start to begin"
    : talking
      ? (isClient ? "Speaking (in role-play)" : "Speaking…")
      : "Listening to you…";

  return (
    <div ref={stageRef} className={"stage" + (talking ? " talking" : "") + (connected && !talking ? " hearing" : "") + (isClient ? " client" : " coach")}>
      <div className="stage-visual">
        <span className="ring r1" />
        <span className="ring r2" />
        <span className="ring r3" />
        <span className="glow" />
        {isClient ? (
          imgFailed[speaker.voice] ? (
            <div key={speaker.voice} className="portrait initials" aria-label={`${displayName}, the client character`}>
              {displayName === "Client" ? "C" : displayName.split(" ").map((w) => w[0]).join("").slice(0, 2)}
            </div>
          ) : (
            <img
              key={speaker.voice}
              className="portrait"
              src={`/characters/${speaker.voice}.jpg`}
              alt={`${displayName}, the client character`}
              onError={() => setImgFailed((f) => ({ ...f, [speaker.voice]: true }))}
            />
          )
        ) : (
          <div className="clara-orb"><span className="blob b1" /><span className="blob b2" /><span className="blob b3" /></div>
        )}
      </div>
      <div className="stage-text">
        <div className="stage-name">{displayName}</div>
        <div className="stage-sub">{subtitle}</div>
        <div className="stage-status">
          {connected && !talking && <span className="mic-meter"><i /><i /><i /><i /><i /></span>}
          {status}
        </div>
      </div>
    </div>
  );
}
