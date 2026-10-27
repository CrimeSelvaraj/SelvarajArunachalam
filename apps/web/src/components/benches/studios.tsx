"use client";

import { useEffect, useState, type ReactElement } from "react";
import { ArtSvg, IsoBlock, StillLife, palettes, type PaletteName } from "@/components/draw";
import { Bench, Choices, ResultSlot, Slider, usePhase } from "@/components/ui";
import { groupLabel, mustFeature } from "@/features";
import { uid } from "@/lib/hash";
import { useIncomingPrompt } from "@/lib/prompt";

export function Artcraft() {
  const feature = mustFeature("artcraft");
  const incoming = useIncomingPrompt();
  const [brief, setBrief] = useState<string | null>(null);
  const briefText = brief ?? incoming;
  const [palette, setPalette] = useState<PaletteName>("clay");
  const [density, setDensity] = useState(2);
  const [salt, setSalt] = useState(0);
  const [made, setMade] = useState<{ brief: string; palette: PaletteName; density: number; salt: number } | null>(null);
  const { phase, message, run } = usePhase();
  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={phase} message={message} emptyTitle="No image yet" emptyBody="Write a brief and compose.">
          {made ? (
            <div className="readout">
              <ArtSvg seed={`${made.brief}:${made.salt}`} palette={made.palette} density={made.density} />
              <p>{made.brief}</p>
              <p className="hint">Palette {made.palette} · pass {made.salt}</p>
            </div>
          ) : null}
        </ResultSlot>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (briefText.trim().length < 3) throw new Error("Add a brief so there is something to compose.");
            const nextSalt = salt + 1;
            setSalt(nextSalt);
            setMade({ brief: briefText.trim(), palette, density, salt: nextSalt });
          });
        }}
      >
        <label className="field">
          <span>Brief</span>
          <textarea value={briefText} onChange={(event) => setBrief(event.target.value)} rows={4} />
        </label>
        <Choices
          label="Palette"
          value={palette}
          options={(Object.keys(palettes) as PaletteName[]).map((name) => ({ value: name, label: name }))}
          onChange={(value) => setPalette(value as PaletteName)}
        />
        <Slider label="Density" min={1} max={3} value={density} onChange={setDensity} />
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={phase === "loading"}>
            {phase === "loading" ? "Working…" : "Compose image"}
          </button>
        </div>
      </form>
    </Bench>
  );
}

export function Photocraft() {
  const feature = mustFeature("photocraft");
  const [exposure, setExposure] = useState(0);
  const [contrast, setContrast] = useState(0);
  const [warmth, setWarmth] = useState(20);
  const [live, setLive] = useState(false);
  const { phase, message, run, clear } = usePhase();
  const filter = `brightness(${1 + exposure / 100}) contrast(${1 + contrast / 100}) sepia(${warmth / 220}) saturate(${1 + warmth / 140})`;

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={live ? phase : phase === "error" ? "error" : "empty"} message={message} emptyTitle="No grade applied" emptyBody="Move the sliders, then apply the grade.">
          <div className="readout">
            <div className="frame">
              <StillLife filter={filter} />
            </div>
            <p>
              Exposure {exposure} · contrast {contrast} · warmth {warmth}
            </p>
          </div>
        </ResultSlot>
      }
    >
      <Slider label="Exposure" min={-40} max={40} value={exposure} onChange={setExposure} />
      <Slider label="Contrast" min={-30} max={40} value={contrast} onChange={setContrast} />
      <Slider label="Warmth" min={0} max={80} value={warmth} onChange={setWarmth} />
      <div className="form-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            void run(async () => {
              setLive(true);
            })
          }
        >
          Apply grade
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setLive(false);
            setExposure(0);
            setContrast(0);
            setWarmth(20);
            clear();
          }}
        >
          Clear grade
        </button>
      </div>
    </Bench>
  );
}

export function Lightcraft() {
  const feature = mustFeature("lightcraft");
  const [azimuth, setAzimuth] = useState(20);
  const [warmth, setWarmth] = useState(40);
  const [fill, setFill] = useState(20);
  const [live, setLive] = useState(false);
  const { phase, message, run, clear } = usePhase();
  const rad = ((azimuth - 90) * Math.PI) / 180;
  const lx = 160 + Math.cos(rad) * 110;
  const ly = 118 + Math.sin(rad) * 48;
  const body = `color-mix(in srgb, #d7e4ff ${100 - warmth}%, #ffb15a)`;

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={live ? "ready" : phase === "error" ? "error" : "empty"} message={message} emptyTitle="No key light yet" emptyBody="Set the key to see the stage.">
          <div className="readout">
            <svg className="iso" viewBox="0 0 320 240" role="img" aria-label="Lit stage">
              <rect width="320" height="240" fill="#f7f1e6" />
              <ellipse cx={160 + azimuth * 0.7} cy="188" rx={70 + fill * 0.3} ry="14" fill={`rgba(28,22,18,${0.28 - fill / 400})`} />
              <rect x="130" y="108" width="60" height="72" rx="6" fill={body} stroke="#1c1612" strokeWidth="3" />
              <circle cx={lx} cy={ly} r={10 + fill / 10} fill="#f0b429" stroke="#1c1612" strokeWidth="3" />
            </svg>
            <p>
              Key at {azimuth}°, warmth {warmth}, fill {fill}.
            </p>
          </div>
        </ResultSlot>
      }
    >
      <Slider label="Azimuth" min={-70} max={70} value={azimuth} onChange={setAzimuth} unit="°" />
      <Slider label="Warmth" min={0} max={100} value={warmth} onChange={setWarmth} />
      <Slider label="Fill" min={0} max={80} value={fill} onChange={setFill} />
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void run(async () => setLive(true))}>
          Set the key
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setLive(false);
            clear();
          }}
        >
          Clear
        </button>
      </div>
    </Bench>
  );
}

type Shot = { id: string; size: string; seconds: number; note: string };

export function Filmcraft() {
  const feature = mustFeature("filmcraft");
  const [size, setSize] = useState("MS");
  const [seconds, setSeconds] = useState(3);
  const [note, setNote] = useState("");
  const [shots, setShots] = useState<Shot[]>([]);
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const { phase, message, run } = usePhase();

  useEffect(() => {
    if (!playing) return undefined;
    const shot = shots[cursor];
    if (!shot) return undefined;
    const timer = window.setTimeout(() => {
      if (cursor + 1 >= shots.length) setPlaying(false);
      else setCursor(cursor + 1);
    }, Math.max(450, shot.seconds * 320));
    return () => window.clearTimeout(timer);
  }, [playing, cursor, shots]);

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={shots.length === 0 ? (phase === "error" ? "error" : "empty") : "ready"} message={message} emptyTitle="No shots yet" emptyBody="Add the first frame.">
          <div className="readout">
            <div className="timeline">
              {shots.map((shot, index) => (
                <button
                  key={shot.id}
                  type="button"
                  className={index === cursor && playing ? "shot shot-on" : "shot"}
                  style={{ flexGrow: shot.seconds }}
                  onClick={() => setCursor(index)}
                >
                  {shot.size} · {shot.seconds}s
                </button>
              ))}
            </div>
            {shots[cursor] ? (
              <p>
                Now: {shots[cursor].size} · {shots[cursor].seconds}s {shots[cursor].note ? `· ${shots[cursor].note}` : ""}
              </p>
            ) : null}
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setCursor(0);
                  setPlaying(true);
                }}
                disabled={shots.length === 0}
              >
                {playing ? "Playing…" : "Play timeline"}
              </button>
              <button type="button" className="btn quiet" onClick={() => setPlaying(false)} disabled={!playing}>
                Stop
              </button>
            </div>
          </div>
        </ResultSlot>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (seconds < 1) throw new Error("Give the shot at least one second.");
            setShots((current) => [...current, { id: uid("shot"), size, seconds, note: note.trim() }]);
            setNote("");
          });
        }}
      >
        <Choices
          label="Shot size"
          value={size}
          options={[
            { value: "WS", label: "WS" },
            { value: "MS", label: "MS" },
            { value: "CU", label: "CU" },
          ]}
          onChange={setSize}
        />
        <Slider label="Seconds" min={1} max={8} value={seconds} onChange={setSeconds} unit="s" />
        <label className="field">
          <span>Note</span>
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="Hands on the hinge" />
        </label>
        <div className="form-actions">
          <button className="btn primary" type="submit">
            Add shot
          </button>
        </div>
      </form>
    </Bench>
  );
}

function draftPage(subject: string, mood: string, words: string, variant: number): string {
  const keeps = words
    .split(",")
    .map((word) => word.trim())
    .filter(Boolean);
  const anchors = keeps.length > 0 ? keeps : ["a pencil", "a window", "a second draft"];
  const tone = mood || "quiet";
  const versions = [
    [
      `${subject} begins in a ${tone} register.`,
      `The first paragraph makes room for ${anchors[0]}, then refuses to explain it too quickly.`,
      anchors[1] ? `By the middle, ${anchors[1]} shows up as a thing you could pick up.` : "The middle stays with objects.",
      anchors[2] ? `Near the end, ${anchors[2]} is the detail that makes the page feel finished.` : "The last line is shorter than the others.",
      `Read aloud, it should sound like a person talking, not like a brochure.`,
    ],
    [
      `Start with ${subject}, and keep the mood ${tone}.`,
      `${anchors[0]} is the first concrete thing on the page.`,
      anchors[1] ? `Do not decorate ${anchors[1]}. Let it sit in one sentence.` : "Leave one sentence almost bare.",
      `End before you explain the moral. ${subject} can carry it.`,
    ],
  ];
  return versions[variant % versions.length].join("\n\n");
}

export function Wordcraft() {
  const feature = mustFeature("wordcraft");
  const incoming = useIncomingPrompt();
  const [subject, setSubject] = useState<string | null>(null);
  const subjectText = subject ?? incoming;
  const [mood, setMood] = useState("plain");
  const [words, setWords] = useState("");
  const [page, setPage] = useState("");
  const [copied, setCopied] = useState("");
  const { phase, message, run } = usePhase();
  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={phase} message={message} emptyTitle="No page yet" emptyBody="Name a subject, then draft.">
          <div className="readout">
            <textarea value={page} onChange={(event) => setPage(event.target.value)} rows={10} />
            <div className="form-actions">
              <button
                type="button"
                className="btn"
                onClick={() => {
                  void navigator.clipboard.writeText(page).then(
                    () => setCopied("Copied."),
                    () => setCopied("Clipboard is blocked. Select the text and copy it."),
                  );
                }}
              >
                Copy page
              </button>
            </div>
            {copied ? <p>{copied}</p> : null}
          </div>
        </ResultSlot>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (subjectText.trim().length < 2) throw new Error("Name the subject of the page.");
            setCopied("");
            setPage(draftPage(subjectText.trim(), mood, words, page.length));
          });
        }}
      >
        <label className="field">
          <span>Subject</span>
          <input value={subjectText} onChange={(event) => setSubject(event.target.value)} />
        </label>
        <Choices
          label="Mood"
          value={mood}
          options={["plain", "warm", "wry", "spare"].map((item) => ({ value: item, label: item }))}
          onChange={setMood}
        />
        <label className="field">
          <span>Words to keep</span>
          <input value={words} onChange={(event) => setWords(event.target.value)} placeholder="lamp, hinge, Saturday" />
        </label>
        <div className="form-actions">
          <button className="btn primary" type="submit" disabled={phase === "loading"}>
            Draft page
          </button>
        </div>
      </form>
    </Bench>
  );
}

type Shape = { id: string; kind: "rect" | "circle"; x: number; y: number; w: number; h: number; fill: string };

function shapeMarkup(shapes: Shape[]): string {
  const body = shapes
    .map((shape) =>
      shape.kind === "circle"
        ? `<circle cx="${shape.x + shape.w / 2}" cy="${shape.y + shape.h / 2}" r="${Math.min(shape.w, shape.h) / 2}" fill="${shape.fill}" />`
        : `<rect x="${shape.x}" y="${shape.y}" width="${shape.w}" height="${shape.h}" fill="${shape.fill}" />`,
    )
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 320 220">${body}</svg>`;
}

export function Vectorcraft() {
  const feature = mustFeature("vectorcraft");
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [selected, setSelected] = useState("");
  const [fill, setFill] = useState("#e24b2d");
  const { phase, message, run, clear } = usePhase();
  const markup = shapeMarkup(shapes);

  function addShape(kind: "rect" | "circle") {
    void run(async () => {
      const index = shapes.length;
      const shape: Shape = {
        id: uid(kind),
        kind,
        x: 24 + (index % 4) * 36,
        y: 24 + (index % 3) * 28,
        w: kind === "circle" ? 64 : 84,
        h: kind === "circle" ? 64 : 52,
        fill,
      };
      setShapes((current) => [...current, shape]);
      setSelected(shape.id);
    });
  }

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={shapes.length === 0 ? (phase === "error" ? "error" : "empty") : "ready"} message={message} emptyTitle="No shapes yet" emptyBody="Add a rectangle to start the SVG.">
          <div className="readout">
            <svg className="vector-svg" viewBox="0 0 320 220" role="img" aria-label="Vector canvas">
              <rect width="320" height="220" fill="#fffaf3" />
              {shapes.map((shape) =>
                shape.kind === "circle" ? (
                  <circle
                    key={shape.id}
                    cx={shape.x + shape.w / 2}
                    cy={shape.y + shape.h / 2}
                    r={Math.min(shape.w, shape.h) / 2}
                    fill={shape.fill}
                    stroke={shape.id === selected ? "#1c1612" : "none"}
                    strokeWidth="3"
                    onClick={() => setSelected(shape.id)}
                  />
                ) : (
                  <rect
                    key={shape.id}
                    x={shape.x}
                    y={shape.y}
                    width={shape.w}
                    height={shape.h}
                    fill={shape.fill}
                    stroke={shape.id === selected ? "#1c1612" : "none"}
                    strokeWidth="3"
                    onClick={() => setSelected(shape.id)}
                  />
                ),
              )}
            </svg>
            <pre className="mono">{markup}</pre>
          </div>
        </ResultSlot>
      }
    >
      <label className="field">
        <span>Fill</span>
        <input type="color" value={fill} onChange={(event) => {
          const next = event.target.value;
          setFill(next);
          if (selected) setShapes((current) => current.map((shape) => (shape.id === selected ? { ...shape, fill: next } : shape)));
        }} />
      </label>
      <div className="choice-row">
        {["#e24b2d", "#1d6b5a", "#1c1612", "#e3a008", "#f3ecdf"].map((swatch) => (
          <button
            key={swatch}
            type="button"
            className="choice"
            style={{ background: swatch }}
            aria-label={swatch}
            onClick={() => {
              setFill(swatch);
              if (selected) setShapes((current) => current.map((shape) => (shape.id === selected ? { ...shape, fill: swatch } : shape)));
            }}
          >
            {swatch}
          </button>
        ))}
      </div>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => addShape("rect")}>
          Add rectangle
        </button>
        <button type="button" className="btn" onClick={() => addShape("circle")}>
          Add circle
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setShapes([]);
            setSelected("");
            clear();
          }}
        >
          Clear
        </button>
      </div>
    </Bench>
  );
}

const effectIds = ["grain", "duotone", "scan", "bloom", "shift"] as const;

export function Effectcraft() {
  const feature = mustFeature("effectcraft");
  const [picked, setPicked] = useState<string[]>([]);
  const [applied, setApplied] = useState<string[]>([]);
  const { phase, message, run, clear } = usePhase();
  const filter = [
    applied.includes("duotone") ? "sepia(0.55) contrast(1.15) hue-rotate(340deg)" : "",
    applied.includes("bloom") ? "saturate(1.35) brightness(1.06)" : "",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={applied.length === 0 ? (phase === "error" ? "error" : "empty") : "ready"} message={message} emptyTitle="No stack yet" emptyBody="Pick at least one effect, then render.">
          <div className={`frame ${applied.includes("grain") ? "grain" : ""} ${applied.includes("scan") ? "scan" : ""} ${applied.includes("shift") ? "shift" : ""}`}>
            <StillLife filter={filter || undefined} />
          </div>
          <p>{applied.join(", ")}</p>
        </ResultSlot>
      }
    >
      <fieldset className="field">
        <legend>Effects</legend>
        <div className="choice-row">
          {effectIds.map((id) => (
            <button
              key={id}
              type="button"
              className="choice"
              aria-pressed={picked.includes(id)}
              onClick={() => setPicked((current) => (current.includes(id) ? current.filter((item) => item !== id) : [...current, id]))}
            >
              {id}
            </button>
          ))}
        </div>
      </fieldset>
      <div className="form-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            void run(async () => {
              if (picked.length === 0) throw new Error("Pick at least one effect.");
              setApplied([...picked]);
            })
          }
        >
          Render stack
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setApplied([]);
            setPicked([]);
            clear();
          }}
        >
          Clear
        </button>
      </div>
    </Bench>
  );
}

export function Cadcraft() {
  const feature = mustFeature("cadcraft");
  const [width, setWidth] = useState(120);
  const [depth, setDepth] = useState(80);
  const [height, setHeight] = useState(48);
  const [live, setLive] = useState(false);
  const { phase, message, run, clear } = usePhase();
  const volume = width * depth * height;

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={live ? "ready" : "empty"} message={message} emptyTitle="No block stamped" emptyBody="Set the size, then stamp the block.">
          <div className="readout">
            <IsoBlock w={width} d={depth} h={height} />
            <pre className="mono">{`Block\nWidth ${width} mm\nDepth ${depth} mm\nHeight ${height} mm\nVolume ${volume} mm3`}</pre>
          </div>
        </ResultSlot>
      }
    >
      <Slider label="Width" min={40} max={200} value={width} onChange={setWidth} unit=" mm" />
      <Slider label="Depth" min={40} max={200} value={depth} onChange={setDepth} unit=" mm" />
      <Slider label="Height" min={20} max={160} value={height} onChange={setHeight} unit=" mm" />
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void run(async () => setLive(true))}>
          Stamp block
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setLive(false);
            clear();
          }}
        >
          Clear
        </button>
      </div>
      {phase === "error" ? <p>{message}</p> : null}
    </Bench>
  );
}

export function Gridcraft() {
  const feature = mustFeature("gridcraft");
  const [columns, setColumns] = useState(3);
  const [rows, setRows] = useState(2);
  const [gap, setGap] = useState(8);
  const [built, setBuilt] = useState(false);
  const [filled, setFilled] = useState<number[]>([]);
  const { phase, message, run, clear } = usePhase();
  const count = columns * rows;

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={built ? "ready" : phase === "error" ? "error" : "empty"} message={message} emptyTitle="No grid yet" emptyBody="Set columns and lay the grid out.">
          <div
            className="layout-grid"
            style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`, gap }}
          >
            {Array.from({ length: count }, (_, index) => (
              <button
                key={index}
                type="button"
                className={filled.includes(index) ? "cell filled" : "cell"}
                aria-pressed={filled.includes(index)}
                onClick={() =>
                  setFilled((current) => (current.includes(index) ? current.filter((item) => item !== index) : [...current, index]))
                }
              >
                {index + 1}
              </button>
            ))}
          </div>
        </ResultSlot>
      }
    >
      <Slider label="Columns" min={2} max={4} value={columns} onChange={setColumns} />
      <Slider label="Rows" min={2} max={4} value={rows} onChange={setRows} />
      <Slider label="Gap" min={4} max={24} value={gap} onChange={setGap} unit=" px" />
      <div className="form-actions">
        <button
          type="button"
          className="btn primary"
          onClick={() =>
            void run(async () => {
              setBuilt(true);
              setFilled([]);
            })
          }
        >
          Lay out
        </button>
        <button
          type="button"
          className="btn quiet"
          onClick={() => {
            setBuilt(false);
            setFilled([]);
            clear();
          }}
        >
          Clear
        </button>
      </div>
    </Bench>
  );
}

type Slide = { id: string; title: string; body: string };

export function Deckcraft() {
  const feature = mustFeature("deckcraft");
  const incoming = useIncomingPrompt();
  const [title, setTitle] = useState<string | null>(null);
  const titleText = title ?? incoming.slice(0, 80);
  const [body, setBody] = useState("");
  const [slides, setSlides] = useState<Slide[]>([]);
  const [index, setIndex] = useState(0);
  const { phase, message, run } = usePhase();
  const slide = slides[index];

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={slides.length === 0 ? (phase === "error" ? "error" : "empty") : "ready"} message={message} emptyTitle="This deck has no slides" emptyBody="Add a title to make the first slide.">
          {slide ? (
            <div className="slide-stage" tabIndex={0} onKeyDown={(event) => {
              if (event.key === "ArrowRight") setIndex((current) => (current + 1) % slides.length);
              if (event.key === "ArrowLeft") setIndex((current) => (current - 1 + slides.length) % slides.length);
            }}>
              <p className="kicker">
                Slide {index + 1} / {slides.length}
              </p>
              <h3>{slide.title}</h3>
              <p>{slide.body || " "}</p>
              <div className="form-actions">
                <button type="button" className="btn" onClick={() => setIndex((current) => (current - 1 + slides.length) % slides.length)}>
                  Previous
                </button>
                <button type="button" className="btn" onClick={() => setIndex((current) => (current + 1) % slides.length)}>
                  Next
                </button>
              </div>
            </div>
          ) : null}
        </ResultSlot>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void run(async () => {
            if (titleText.trim().length < 2) throw new Error("Add a title for the slide.");
            const next = { id: uid("slide"), title: titleText.trim(), body: body.trim() };
            setSlides((current) => [...current, next]);
            setIndex(slides.length);
            setTitle("");
            setBody("");
          });
        }}
      >
        <label className="field">
          <span>Title</span>
          <input value={titleText} onChange={(event) => setTitle(event.target.value)} />
        </label>
        <label className="field">
          <span>Body</span>
          <textarea value={body} onChange={(event) => setBody(event.target.value)} rows={3} />
        </label>
        <div className="form-actions">
          <button className="btn primary" type="submit">
            Add slide
          </button>
        </div>
      </form>
    </Bench>
  );
}

export const studioDemos: Record<string, () => ReactElement> = {
  artcraft: Artcraft,
  photocraft: Photocraft,
  lightcraft: Lightcraft,
  filmcraft: Filmcraft,
  wordcraft: Wordcraft,
  vectorcraft: Vectorcraft,
  effectcraft: Effectcraft,
  cadcraft: Cadcraft,
  gridcraft: Gridcraft,
  deckcraft: Deckcraft,
};
