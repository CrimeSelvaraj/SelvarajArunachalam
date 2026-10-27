"use client";

import { useEffect, useRef, useState } from "react";
import { Bench, Choices, Notice, usePhase } from "@/components/ui";
import { groupLabel, mustFeature } from "@/features";
import { wait } from "@/lib/hash";
import { useIncomingPrompt } from "@/lib/prompt";
import { canSpeak, speak, stopSpeaking } from "@/lib/speech";

const faces = [
  { id: "mira", label: "Mira" },
  { id: "sol", label: "Sol" },
  { id: "nim", label: "Nim" },
] as const;

const tones = [
  { value: "calm", label: "Calm", pitch: 1 },
  { value: "bright", label: "Bright", pitch: 1.25 },
  { value: "low", label: "Low", pitch: 0.75 },
];

function Face({ who, talking }: { who: string; talking: boolean }) {
  const mouth = talking ? 9 : 2.5;
  if (who === "sol") {
    return (
      <svg className="portrait" viewBox="0 0 200 220" role="img" aria-label="Sol, an angular portrait">
        <polygon points="100,18 168,78 150,190 50,190 32,78" fill="#e7d3b8" stroke="#1c1612" strokeWidth="4" />
        <rect x="68" y="88" width="16" height="10" fill="#1c1612" />
        <rect x="116" y="88" width="16" height="10" fill="#1c1612" />
        <rect x="86" y={150 - mouth} width="28" height={mouth * 2} rx="4" fill="#9f2d1c" />
      </svg>
    );
  }
  if (who === "nim") {
    return (
      <svg className="portrait" viewBox="0 0 200 220" role="img" aria-label="Nim, a wide portrait">
        <ellipse cx="100" cy="112" rx="78" ry="64" fill="#d7e4dc" stroke="#1c1612" strokeWidth="4" />
        <circle cx="74" cy="104" r="6" fill="#1c1612" />
        <circle cx="126" cy="104" r="6" fill="#1c1612" />
        <ellipse cx="100" cy="142" rx="16" ry={mouth} fill="#1d6b5a" />
      </svg>
    );
  }
  return (
    <svg className="portrait" viewBox="0 0 200 220" role="img" aria-label="Mira, a round portrait">
      <circle cx="100" cy="108" r="72" fill="#f0c7a8" stroke="#1c1612" strokeWidth="4" />
      <circle cx="74" cy="100" r="7" fill="#1c1612" />
      <circle cx="126" cy="100" r="7" fill="#1c1612" />
      <path d="M78 136 Q100 156 122 136" fill="none" stroke="#1c1612" strokeWidth="4" />
      <ellipse cx="100" cy="148" rx="14" ry={mouth} fill="#9f2d1c" />
    </svg>
  );
}

export function HeyGem() {
  const feature = mustFeature("heygem");
  const [face, setFace] = useState("mira");
  const [tone, setTone] = useState("calm");
  const incoming = useIncomingPrompt();
  const [script, setScript] = useState<string | null>(null);
  const scriptText = script ?? (incoming || "Welcome in. The bench is open.\nBring what needs fixing.");
  const [active, setActive] = useState(-1);
  const [playing, setPlaying] = useState(false);
  const [note, setNote] = useState("");
  const [lines, setLines] = useState<string[]>([]);
  const token = useRef(0);
  const { phase, message, setPhase, setMessage } = usePhase();

  useEffect(() => () => {
    token.current += 1;
    stopSpeaking();
  }, []);

  function stop() {
    token.current += 1;
    stopSpeaking();
    setPlaying(false);
    setActive(-1);
  }

  async function play() {
    const nextLines = scriptText
      .split(/\n+/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (nextLines.length === 0) {
      setPhase("error");
      setMessage("Write at least one line to play.");
      return;
    }
    if (nextLines.length > 8) {
      setPhase("error");
      setMessage("Keep the read to 8 lines so it stays a preview.");
      return;
    }
    if (nextLines.some((line) => line.length > 280)) {
      setPhase("error");
      setMessage("Split long lines so each one can be spoken.");
      return;
    }
    const runId = token.current + 1;
    token.current = runId;
    setNote("");
    setLines(nextLines);
    setPhase("loading");
    setPlaying(true);
    await wait(320);
    if (token.current !== runId) return;
    setPhase("ready");
    const pitch = tones.find((item) => item.value === tone)?.pitch ?? 1;
    let engine = canSpeak();
    for (let index = 0; index < nextLines.length; index += 1) {
      if (token.current !== runId) return;
      setActive(index);
      if (engine) {
        try {
          await speak(nextLines[index], pitch, 1);
        } catch (error) {
          const reason = error instanceof Error ? error.message : "";
          engine = false;
          setNote(
            reason === "no-engine"
              ? "Showing the read on screen. This device has no speech engine."
              : "Speech stopped. The rest of the read stays on screen.",
          );
          await wait(Math.min(2600, 500 + nextLines[index].length * 28));
        }
      } else {
        await wait(Math.min(2600, 500 + nextLines[index].length * 28));
      }
    }
    if (token.current !== runId) return;
    setPlaying(false);
    setActive(-1);
    setNote((current) => current || "Read finished on this device.");
  }

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={<ResultBridge phase={phase} message={message} face={face} lines={lines} active={active} playing={playing} note={note} />}
    >
      <Choices label="Face" value={face} options={faces.map((item) => ({ value: item.id, label: item.label }))} onChange={setFace} />
      <Choices label="Tone" value={tone} options={tones.map((item) => ({ value: item.value, label: item.label }))} onChange={setTone} />
      <label className="field">
        <span>Script</span>
        <textarea value={scriptText} onChange={(event) => setScript(event.target.value)} rows={6} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void play()} disabled={phase === "loading"}>
          {playing ? "Playing…" : "Play the read"}
        </button>
        {playing ? (
          <button type="button" className="btn" onClick={stop}>
            Stop
          </button>
        ) : null}
      </div>
    </Bench>
  );
}

function ResultBridge({
  phase,
  message,
  face,
  lines,
  active,
  playing,
  note,
}: {
  phase: string;
  message: string;
  face: string;
  lines: string[];
  active: number;
  playing: boolean;
  note: string;
}) {
  if (phase === "loading") return <Notice tone="loading" title="Setting the read">The portrait is about to start.</Notice>;
  if (phase === "error") return <Notice tone="error" title="Needs a fix">{message}</Notice>;
  if (phase === "empty") return <Notice tone="empty" title="The portrait waits here">Write a line, then play the read.</Notice>;
  return (
    <div className="readout">
      <Face who={face} talking={playing && active >= 0} />
      <ol className="caption">
        {lines.map((line, index) => (
          <li key={`${index}-${line}`} className={index === active ? "line-on" : undefined}>
            {line}
          </li>
        ))}
      </ol>
      {note ? <p>{note}</p> : null}
    </div>
  );
}
