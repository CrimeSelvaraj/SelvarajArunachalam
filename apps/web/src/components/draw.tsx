import { hashString, mulberry32 } from "@/lib/hash";

export const palettes = {
  clay: ["#f3ecdf", "#e24b2d", "#1c1612", "#e3a008", "#1d6b5a"],
  tide: ["#e7f2ef", "#143f44", "#1d6b5a", "#f4d35e", "#f7f3ea"],
  night: ["#241c17", "#f3ecdf", "#e24b2d", "#c4a484", "#8d6a4a"],
  citrus: ["#fff6d8", "#ef9f1a", "#e24b2d", "#1d6b5a", "#1c1612"],
} as const;

export type PaletteName = keyof typeof palettes;

export function ArtSvg({ seed, palette, density }: { seed: string; palette: PaletteName; density: number }) {
  const rand = mulberry32(hashString(`${seed}:${palette}:${density}`));
  const colors = palettes[palette];
  const count = 5 + density * 3;
  const shapes = Array.from({ length: count }, (_, index) => ({
    index,
    kind: rand() > 0.45 ? "circle" : "rect",
    x: 16 + rand() * 300,
    y: 16 + rand() * 190,
    size: 28 + rand() * 96,
    fill: colors[1 + Math.floor(rand() * (colors.length - 1))],
    rot: Math.floor(rand() * 70) - 35,
    opacity: 0.78 + rand() * 0.22,
  }));

  return (
    <svg className="art-svg" viewBox="0 0 400 280" role="img" aria-label="Composed studio image">
      <rect width="400" height="280" fill={colors[0]} />
      {shapes.map((shape) =>
        shape.kind === "circle" ? (
          <circle key={shape.index} cx={shape.x} cy={shape.y} r={shape.size / 2} fill={shape.fill} opacity={shape.opacity} />
        ) : (
          <rect
            key={shape.index}
            x={shape.x}
            y={shape.y}
            width={shape.size}
            height={shape.size * 0.62}
            fill={shape.fill}
            opacity={shape.opacity}
            transform={`rotate(${shape.rot} ${shape.x} ${shape.y})`}
          />
        ),
      )}
    </svg>
  );
}

export function StillLife({ filter }: { filter?: string }) {
  return (
    <svg className="still" viewBox="0 0 400 280" role="img" aria-label="Studio still life of a window, a cup, and a sprig" style={{ filter }}>
      <rect width="400" height="280" fill="#d7c4a8" />
      <rect x="28" y="22" width="128" height="156" fill="#f7f1e6" stroke="#1c1612" strokeWidth="3" />
      <line x1="92" y1="22" x2="92" y2="178" stroke="#1c1612" strokeWidth="3" />
      <line x1="28" y1="100" x2="156" y2="100" stroke="#1c1612" strokeWidth="3" />
      <rect x="36" y="30" width="48" height="62" fill="#8ec9bc" />
      <rect x="100" y="30" width="48" height="62" fill="#f0d56a" />
      <rect x="36" y="108" width="48" height="62" fill="#e7a08c" />
      <rect x="100" y="108" width="48" height="62" fill="#6ea391" />
      <rect y="196" width="400" height="84" fill="#c4a484" />
      <ellipse cx="262" cy="196" rx="74" ry="12" fill="#a98462" />
      <path d="M236 196c6-62 22-84 34-112" fill="none" stroke="#1d6b5a" strokeWidth="4" />
      <ellipse cx="262" cy="82" rx="18" ry="9" fill="#1d6b5a" transform="rotate(-18 262 82)" />
      <ellipse cx="284" cy="102" rx="16" ry="8" fill="#2f8f78" transform="rotate(16 284 102)" />
      <path d="M240 196v-46h40v46" fill="#f4efe6" stroke="#1c1612" strokeWidth="3" />
      <ellipse cx="260" cy="150" rx="16" ry="6" fill="#1c1612" />
      <path d="M280 158h18v8h-8v14" fill="none" stroke="#1c1612" strokeWidth="3" />
    </svg>
  );
}

function project(x: number, y: number, z: number): [number, number] {
  const cos = Math.cos(Math.PI / 6);
  const sin = Math.sin(Math.PI / 6);
  return [(x - y) * cos + 160, (x + y) * sin - z + 168];
}

function points(coords: Array<[number, number, number]>): string {
  return coords.map(([x, y, z]) => project(x, y, z).join(",")).join(" ");
}

export function IsoBlock({ w, d, h }: { w: number; d: number; h: number }) {
  const scale = 90 / Math.max(w, d, h, 1);
  const width = w * scale;
  const depth = d * scale;
  const height = h * scale;
  const left: Array<[number, number, number]> = [
    [0, 0, 0],
    [0, depth, 0],
    [0, depth, height],
    [0, 0, height],
  ];
  const right: Array<[number, number, number]> = [
    [0, depth, 0],
    [width, depth, 0],
    [width, depth, height],
    [0, depth, height],
  ];
  const top: Array<[number, number, number]> = [
    [0, 0, height],
    [width, 0, height],
    [width, depth, height],
    [0, depth, height],
  ];
  return (
    <svg className="iso" viewBox="0 0 320 240" role="img" aria-label={`Block ${w} by ${d} by ${h}`}>
      <polygon points={points(left)} fill="#c4a484" stroke="#1c1612" strokeWidth="2" />
      <polygon points={points(right)} fill="#ead7be" stroke="#1c1612" strokeWidth="2" />
      <polygon points={points(top)} fill="#f6e7d2" stroke="#1c1612" strokeWidth="2" />
    </svg>
  );
}
