"use client";

import { useRef, useState } from "react";
import { Bench, Slider } from "@/components/ui";
import { groupLabel, mustFeature } from "@/features";
import { wait } from "@/lib/hash";

type Angles = { upper: number; fore: number; thigh: number; shin: number };

const stand: Angles = { upper: 80, fore: 100, thigh: 100, shin: 95 };
const presets: Record<string, Angles> = {
  Stand: stand,
  Wave: { upper: -30, fore: -10, thigh: 100, shin: 95 },
  Reach: { upper: 10, fore: 20, thigh: 92, shin: 88 },
  Crouch: { upper: 110, fore: 140, thigh: 40, shin: 120 },
};

function polar(cx: number, cy: number, deg: number, len: number) {
  const rad = (deg * Math.PI) / 180;
  return { x: cx + Math.cos(rad) * len, y: cy + Math.sin(rad) * len };
}

function Rig({ angles }: { angles: Angles }) {
  const shoulder = { x: 170, y: 118 };
  const elbow = polar(shoulder.x, shoulder.y, angles.upper, 70);
  const hand = polar(elbow.x, elbow.y, angles.fore, 58);
  const hip = { x: 170, y: 210 };
  const knee = polar(hip.x, hip.y, angles.thigh, 72);
  const foot = polar(knee.x, knee.y, angles.shin, 64);
  return (
    <svg className="rig" viewBox="0 0 340 420" role="img" aria-label="Rigid pose preview">
      <line x1="40" y1="360" x2="300" y2="360" stroke="#1c1612" strokeWidth="3" />
      <line x1={shoulder.x} y1={shoulder.y} x2={hip.x} y2={hip.y} stroke="#1c1612" strokeWidth="16" strokeLinecap="round" />
      <circle cx="170" cy="78" r="28" fill="#f3ecdf" stroke="#1c1612" strokeWidth="4" />
      <rect x="156" y="100" width="28" height="18" fill="#1d6b5a" />
      <line x1={shoulder.x - 18} y1={shoulder.y} x2={elbow.x - 18} y2={elbow.y} stroke="#8d6a4a" strokeWidth="12" strokeLinecap="round" />
      <line x1={elbow.x - 18} y1={elbow.y} x2={hand.x - 18} y2={hand.y} stroke="#8d6a4a" strokeWidth="12" strokeLinecap="round" />
      <line x1={shoulder.x} y1={shoulder.y} x2={elbow.x} y2={elbow.y} stroke="#1c1612" strokeWidth="14" strokeLinecap="round" />
      <line x1={elbow.x} y1={elbow.y} x2={hand.x} y2={hand.y} stroke="#1c1612" strokeWidth="14" strokeLinecap="round" />
      <line x1={hip.x - 16} y1={hip.y} x2={knee.x - 16} y2={knee.y} stroke="#8d6a4a" strokeWidth="12" strokeLinecap="round" />
      <line x1={knee.x - 16} y1={knee.y} x2={foot.x - 16} y2={foot.y} stroke="#8d6a4a" strokeWidth="12" strokeLinecap="round" />
      <line x1={hip.x} y1={hip.y} x2={knee.x} y2={knee.y} stroke="#1c1612" strokeWidth="14" strokeLinecap="round" />
      <line x1={knee.x} y1={knee.y} x2={foot.x} y2={foot.y} stroke="#1c1612" strokeWidth="14" strokeLinecap="round" />
      {[shoulder, elbow, hand, hip, knee, foot].map((joint) => (
        <circle key={`${joint.x}-${joint.y}`} cx={joint.x} cy={joint.y} r="6" fill="#e24b2d" stroke="#1c1612" />
      ))}
    </svg>
  );
}

export function Pinocchio() {
  const feature = mustFeature("pinocchio");
  const [angles, setAngles] = useState<Angles>(stand);
  const [status, setStatus] = useState("Stand pose is loaded. Move a joint or play the wave.");
  const [playing, setPlaying] = useState(false);
  const stop = useRef(false);

  function setKey<K extends keyof Angles>(key: K, value: number) {
    setAngles((current) => ({ ...current, [key]: value }));
    setStatus("Joints updated.");
  }

  async function tween(from: Angles, to: Angles, ms: number) {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce) {
      setAngles(to);
      return;
    }
    const start = performance.now();
    await new Promise<void>((resolve) => {
      const step = (now: number) => {
        if (stop.current) {
          resolve();
          return;
        }
        const t = Math.min(1, (now - start) / ms);
        const eased = t * t * (3 - 2 * t);
        setAngles({
          upper: from.upper + (to.upper - from.upper) * eased,
          fore: from.fore + (to.fore - from.fore) * eased,
          thigh: from.thigh + (to.thigh - from.thigh) * eased,
          shin: from.shin + (to.shin - from.shin) * eased,
        });
        if (t < 1) requestAnimationFrame(step);
        else resolve();
      };
      requestAnimationFrame(step);
    });
  }

  async function play() {
    stop.current = false;
    setPlaying(true);
    setStatus("Playing the wave.");
    const start = { ...angles };
    await tween(start, presets.Wave, 420);
    await wait(120);
    await tween(presets.Wave, presets.Stand, 420);
    await tween(presets.Stand, presets.Wave, 420);
    await tween(presets.Wave, presets.Stand, 420);
    if (!stop.current) setStatus("Wave finished. The rig is back at stand.");
    setPlaying(false);
  }

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <div className="readout">
          {playing ? <p className="kicker">Playing</p> : null}
          <Rig angles={angles} />
          <p>{status}</p>
        </div>
      }
    >
      <Slider label="Shoulder" min={-40} max={160} value={angles.upper} onChange={(value) => setKey("upper", value)} unit="°" />
      <Slider label="Elbow" min={-40} max={180} value={angles.fore} onChange={(value) => setKey("fore", value)} unit="°" />
      <Slider label="Hip" min={10} max={160} value={angles.thigh} onChange={(value) => setKey("thigh", value)} unit="°" />
      <Slider label="Knee" min={0} max={170} value={angles.shin} onChange={(value) => setKey("shin", value)} unit="°" />
      <div className="choice-row">
        {Object.entries(presets).map(([label, pose]) => (
          <button
            key={label}
            type="button"
            className="choice"
            onClick={() => {
              setAngles(pose);
              setStatus(`${label} pose set.`);
            }}
            disabled={playing}
          >
            {label}
          </button>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void play()} disabled={playing}>
          {playing ? "Playing…" : "Play pose"}
        </button>
      </div>
    </Bench>
  );
}
