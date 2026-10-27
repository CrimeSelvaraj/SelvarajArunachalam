export function LoopMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#0e6b66" />
      <path
        d="M11 16.5a5.2 5.2 0 1 1 1.7 3.8"
        fill="none"
        stroke="#f6f1e7"
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <path
        d="M10.2 19.2 11.2 15.6l3.5 1.2"
        fill="none"
        stroke="#f6f1e7"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
