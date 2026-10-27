"use client";

import { useState } from "react";
import { ArtSvg, type PaletteName } from "@/components/draw";
import { Bench, Notice, usePhase } from "@/components/ui";
import { arenaBriefs, models } from "@/data";
import { groupLabel, mustFeature } from "@/features";
import { hashString, mulberry32, uid } from "@/lib/hash";
import { useIncomingPrompt } from "@/lib/prompt";
import { dispatch, useStore, type VoteChoice } from "@/store";

const palettes: PaletteName[] = ["clay", "tide", "night", "citrus"];

function makeMatch(prompt: string, salt: number) {
  const rand = mulberry32(hashString(`${prompt}:${salt}`));
  const left = models[Math.floor(rand() * models.length)];
  let right = models[Math.floor(rand() * models.length)];
  if (right === left) right = models[(models.indexOf(left) + 1) % models.length];
  return { prompt, left, right, salt };
}

function treatment(model: string, prompt: string): string {
  const clip = prompt.length > 90 ? `${prompt.slice(0, 89).trim()}…` : prompt;
  const lines: Record<string, string> = {
    Northline: `A cool, wide layout. The brief “${clip}” sits in a quiet margin.`,
    Kiln: `A warm, heavy treatment. “${clip}” is set like a stamped title.`,
    Harbor: `A calm grid. “${clip}” is broken into short lines you can scan.`,
    Quill: `A written take. “${clip}” opens like the first sentence of a page.`,
    Paperplane: `A light, fast take. “${clip}” is reduced to one gesture.`,
    Lumen: `A bright field. “${clip}” is the only dark mark on the card.`,
  };
  return lines[model] ?? clip;
}

export function Arena() {
  const feature = mustFeature("arena");
  const { votes, scores } = useStore();
  const incoming = useIncomingPrompt();
  const [brief, setBrief] = useState<string | null>(null);
  const briefText = brief ?? (incoming || arenaBriefs[0].text);
  const [salt, setSalt] = useState(1);
  const [note, setNote] = useState("");
  const { phase, message, run } = usePhase();
  const match = makeMatch(briefText, salt);

  async function vote(choice: VoteChoice) {
    await run(async () => {
      const kept = choice === "tie" ? "Tie" : choice === "left" ? match.left : match.right;
      dispatch({
        type: "add-vote",
        vote: {
          id: uid("vote"),
          prompt: match.prompt,
          left: match.left,
          right: match.right,
          choice,
          createdAt: Date.now(),
        },
      });
      setNote(choice === "tie" ? "Called a tie." : `Kept ${kept}.`);
      setSalt((value) => value + 1);
    });
  }

  async function refresh(nextBrief: string) {
    const text = nextBrief.trim();
    if (text.length < 8) {
      await run(async () => {
        throw new Error("Add a brief to judge.");
      });
      return;
    }
    await run(async () => {
      setBrief(text);
      setSalt((value) => value + 1);
      setNote("New pair is up.");
    });
  }

  const board = Object.entries(scores).sort((a, b) => b[1].wins - a[1].wins || b[1].shows - a[1].shows || a[0].localeCompare(b[0]));

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      layout="stack"
      result={
        <div className="stack-gap">
          {note ? <p className="kicker">{note}</p> : null}
          {phase === "error" ? <Notice tone="error" title="Needs a fix">{message}</Notice> : null}
          <h3>Board</h3>
          {board.length === 0 ? (
            <Notice tone="empty" title="No votes yet">The board fills in when you pick a take.</Notice>
          ) : (
            <ul className="leader">
              {board.map(([name, score]) => (
                <li key={name}>
                  <span>{name}</span>
                  <span>
                    {score.wins} wins · {score.ties} ties · {score.shows} shown
                  </span>
                  <span className="bar" aria-hidden="true">
                    <span style={{ width: `${Math.min(100, score.wins * 20 + 8)}%` }} />
                  </span>
                </li>
              ))}
            </ul>
          )}
          <h3>Gallery</h3>
          {votes.length === 0 ? (
            <Notice tone="empty" title="No saved votes">Votes you cast show up here.</Notice>
          ) : (
            <ul className="gallery">
              {votes.map((voteItem) => (
                <li key={voteItem.id}>
                  <strong>{voteItem.choice === "tie" ? "Tie" : voteItem.choice === "left" ? voteItem.left : voteItem.right}</strong>
                  <p>{voteItem.prompt}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      }
    >
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void refresh(briefText);
        }}
      >
        <label className="field">
          <span>Brief</span>
          <textarea value={briefText} onChange={(event) => setBrief(event.target.value)} rows={3} />
        </label>
        <div className="choice-row">
          {arenaBriefs.map((item) => (
            <button key={item.label} type="button" className="choice" onClick={() => void refresh(item.text)}>
              {item.label}
            </button>
          ))}
        </div>
        <div className="form-actions">
          <button type="submit" className="btn" disabled={phase === "loading"}>
            New matchup
          </button>
        </div>
      </form>
      {phase === "loading" ? <Notice tone="loading" title="Setting the next pair">Both takes use the same brief.</Notice> : null}
      <div className="pair">
        {([
          ["left", match.left],
          ["right", match.right],
        ] as const).map(([side, model], index) => (
          <article className="take" key={side}>
            <p className="kicker">{model}</p>
            <ArtSvg seed={`${match.prompt}:${model}:${match.salt}`} palette={palettes[(match.salt + index) % palettes.length]} density={index + 1} />
            <p>{treatment(model, match.prompt)}</p>
            <button type="button" className="btn primary" onClick={() => void vote(side)} disabled={phase === "loading"}>
              Keep {side}
            </button>
          </article>
        ))}
        <div className="pair-actions">
          <button type="button" className="btn" onClick={() => void vote("tie")} disabled={phase === "loading"}>
            Call it a tie
          </button>
        </div>
      </div>
    </Bench>
  );
}
