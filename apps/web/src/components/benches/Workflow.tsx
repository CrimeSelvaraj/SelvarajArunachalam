"use client";

import { useState } from "react";
import { ArtSvg } from "@/components/draw";
import { Bench, ResultSlot, usePhase } from "@/components/ui";
import { groupLabel, mustFeature } from "@/features";
import { uid } from "@/lib/hash";
import { useIncomingPrompt } from "@/lib/prompt";

type Kind = "prompt" | "model" | "sampler" | "preview";
type WNode = { id: string; kind: Kind; x: number; y: number; text: string };
type WEdge = { id: string; from: string; to: string };

const NODE_W = 210;
const models = ["Northline", "Kiln", "Harbor", "Quill"];
const steps = ["4", "8", "12", "20"];

function initialNodes(prompt: string): WNode[] {
  return [
    { id: "n-prompt", kind: "prompt", x: 24, y: 24, text: prompt || "A ceramic lamp on a wooden bench" },
    { id: "n-model", kind: "model", x: 280, y: 24, text: "Northline" },
    { id: "n-sampler", kind: "sampler", x: 24, y: 210, text: "8" },
    { id: "n-preview", kind: "preview", x: 280, y: 210, text: "Output" },
  ];
}

const initialEdges: WEdge[] = [
  { id: "e1", from: "n-prompt", to: "n-model" },
  { id: "e2", from: "n-model", to: "n-sampler" },
  { id: "e3", from: "n-sampler", to: "n-preview" },
];

function readGraph(nodes: WNode[], edges: WEdge[]): { prompt: string; model: string; steps: string } {
  const preview = nodes.find((node) => node.kind === "preview");
  if (!preview) throw new Error("Add a preview node so the graph has a place to land.");
  const seen = new Set<string>();
  const queue = [preview.id];
  let prompt = "";
  let model = "";
  let step = "";
  while (queue.length > 0) {
    const id = queue.shift();
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const node = nodes.find((item) => item.id === id);
    if (!node) continue;
    if (node.kind === "prompt" && !prompt) prompt = node.text.trim();
    if (node.kind === "model" && !model) model = node.text;
    if (node.kind === "sampler" && !step) step = node.text;
    edges.filter((edge) => edge.to === id).forEach((edge) => queue.push(edge.from));
  }
  if (!prompt) throw new Error("Connect a prompt with some words to the preview.");
  return { prompt, model: model || "Northline", steps: step || "8" };
}

export function Workflow() {
  const feature = mustFeature("workflow");
  const incoming = useIncomingPrompt();
  const [nodes, setNodes] = useState<WNode[]>(() => initialNodes(""));
  const [edges, setEdges] = useState<WEdge[]>(initialEdges);
  const [arm, setArm] = useState<string | null>(null);
  const [selected, setSelected] = useState<string>("n-prompt");
  const [promptTouched, setPromptTouched] = useState(false);
  const [output, setOutput] = useState<{ prompt: string; model: string; steps: string } | null>(null);
  const { phase, message, run, clear } = usePhase();
  const graphNodes = nodes.map((node) =>
    node.kind === "prompt" && !promptTouched && incoming ? { ...node, text: incoming } : node,
  );

  function update(id: string, text: string) {
    setNodes((current) => current.map((node) => (node.id === id ? { ...node, text } : node)));
  }

  function add(kind: Kind) {
    const id = uid(kind);
    setNodes((current) => [
      ...current,
      {
        id,
        kind,
        x: 24 + (current.length % 3) * 230,
        y: 24 + Math.floor(current.length / 3) * 170,
        text: kind === "prompt" ? "" : kind === "model" ? "Kiln" : kind === "sampler" ? "8" : "Output",
      },
    ]);
    setSelected(id);
  }

  function removeSelected() {
    setNodes((current) => current.filter((node) => node.id !== selected));
    setEdges((current) => current.filter((edge) => edge.from !== selected && edge.to !== selected));
    setSelected("");
    setOutput(null);
    clear();
  }

  function connectIn(id: string) {
    if (!arm || arm === id) return;
    setEdges((current) => {
      if (current.some((edge) => edge.from === arm && edge.to === id)) return current;
      return [...current, { id: uid("edge"), from: arm, to: id }];
    });
    setArm(null);
  }

  function startDrag(event: React.PointerEvent, id: string) {
    if (event.button !== 0) return;
    const node = nodes.find((item) => item.id === id);
    if (!node) return;
    const originX = node.x;
    const originY = node.y;
    const startX = event.clientX;
    const startY = event.clientY;
    const move = (ev: PointerEvent) => {
      const x = Math.max(8, originX + ev.clientX - startX);
      const y = Math.max(8, originY + ev.clientY - startY);
      setNodes((current) => current.map((item) => (item.id === id ? { ...item, x, y } : item)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }

  async function runGraph() {
    await run(async () => {
      const graph = readGraph(graphNodes, edges);
      setOutput(graph);
    });
  }

  const width = Math.max(680, ...nodes.map((node) => node.x + NODE_W + 40), 680);
  const height = Math.max(460, ...nodes.map((node) => node.y + 180), 460);

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      layout="stack"
      result={
        <ResultSlot phase={phase} message={message} emptyTitle="Graph has not run" emptyBody="Connect a prompt to the preview, then run the graph.">
          {output ? (
            <div className="readout">
              <ArtSvg seed={`${output.prompt}|${output.model}|${output.steps}`} palette="tide" density={2} />
              <p>
                <strong>{output.model}</strong> · {output.steps} steps
              </p>
              <p>{output.prompt}</p>
            </div>
          ) : null}
        </ResultSlot>
      }
    >
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void runGraph()} disabled={phase === "loading"}>
          {phase === "loading" ? "Working…" : "Run graph"}
        </button>
        {(["prompt", "model", "sampler", "preview"] as Kind[]).map((kind) => (
          <button key={kind} type="button" className="btn" onClick={() => add(kind)}>
            Add {kind}
          </button>
        ))}
        <button type="button" className="btn" onClick={() => setEdges([])}>
          Clear wires
        </button>
        <button type="button" className="btn quiet" onClick={removeSelected} disabled={!selected}>
          Remove node
        </button>
      </div>
      <p className="hint">{arm ? "Now tap an in port." : "Tap an out port, then an in port, to connect."}</p>
      {nodes.length === 0 ? (
        <p className="hint">The canvas is empty. Add a prompt node to begin.</p>
      ) : (
        <div className="canvas">
          <div className="canvas-inner" style={{ width, height }}>
            <svg className="wires" width={width} height={height} aria-hidden="true">
              {edges.map((edge) => {
                const from = nodes.find((node) => node.id === edge.from);
                const to = nodes.find((node) => node.id === edge.to);
                if (!from || !to) return null;
                const x1 = from.x + NODE_W;
                const y1 = from.y + 36;
                const x2 = to.x;
                const y2 = to.y + 36;
                const bend = Math.max(40, Math.abs(x2 - x1) / 2);
                return (
                  <path
                    key={edge.id}
                    d={`M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`}
                    fill="none"
                    stroke="#1d6b5a"
                    strokeWidth="2.5"
                  />
                );
              })}
            </svg>
            {nodes.map((node) => (
              <article
                key={node.id}
                className={selected === node.id ? "node selected" : "node"}
                style={{ left: node.x, top: node.y, width: NODE_W }}
                onClick={() => setSelected(node.id)}
              >
                <header className="node-handle" onPointerDown={(event) => startDrag(event, node.id)}>
                  {node.kind}
                </header>
                <button
                  type="button"
                  className={arm ? "port in hot" : "port in"}
                  aria-label={`Connect into ${node.kind}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => connectIn(node.id)}
                />
                <button
                  type="button"
                  className={arm === node.id ? "port out armed" : "port out"}
                  aria-label={`Connect from ${node.kind}`}
                  onPointerDown={(event) => event.stopPropagation()}
                  onClick={() => setArm((current) => (current === node.id ? null : node.id))}
                />
                {node.kind === "prompt" ? (
                  <textarea
                    value={graphNodes.find((item) => item.id === node.id)?.text ?? node.text}
                    onPointerDown={(event) => event.stopPropagation()}
                    onChange={(event) => {
                      setPromptTouched(true);
                      update(node.id, event.target.value);
                    }}
                    rows={3}
                  />
                ) : null}
                {node.kind === "model" ? (
                  <select value={node.text} onChange={(event) => update(node.id, event.target.value)}>
                    {models.map((model) => (
                      <option key={model}>{model}</option>
                    ))}
                  </select>
                ) : null}
                {node.kind === "sampler" ? (
                  <select value={node.text} onChange={(event) => update(node.id, event.target.value)}>
                    {steps.map((step) => (
                      <option key={step}>{step}</option>
                    ))}
                  </select>
                ) : null}
                {node.kind === "preview" ? <p className="hint">Preview</p> : null}
              </article>
            ))}
          </div>
        </div>
      )}
    </Bench>
  );
}
