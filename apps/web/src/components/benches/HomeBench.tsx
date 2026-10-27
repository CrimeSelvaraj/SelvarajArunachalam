"use client";

import Link from "next/link";
import { useState } from "react";
import { Notice, ResultSlot, usePhase } from "@/components/ui";
import { features, featureById } from "@/features";
import { formatDay, uid, wait } from "@/lib/hash";
import { stashPrompt } from "@/lib/prompt";
import { suggestBench } from "@/lib/suggest";
import { dispatch, useStore } from "@/store";

const examples = [
  "A talking welcome for a neighborhood library, warm and short",
  "Compare two posters for a Saturday repair cafe",
  "A five-slide deck about sharing tools on our street",
];

export function HomeBench() {
  const { drafts } = useStore();
  const [prompt, setPrompt] = useState("");
  const [plan, setPlan] = useState<{ featureId: string; steps: string[]; prompt: string } | null>(null);
  const { phase, message, run } = usePhase();

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const text = prompt.trim();
    if (text.length < 8) {
      setPlan(null);
      await run(async () => {
        throw new Error("Give the bench a little more to go on.");
      });
      return;
    }
    await run(async () => {
      await wait(480);
      const suggestion = suggestBench(text);
      const next = { ...suggestion, prompt: text };
      setPlan(next);
      dispatch({
        type: "add-draft",
        draft: {
          id: uid("draft"),
          prompt: text,
          featureId: suggestion.featureId,
          steps: suggestion.steps,
          createdAt: Date.now(),
        },
      });
    });
  }

  const feature = plan ? featureById(plan.featureId) : undefined;

  return (
    <article className="page">
      <header className="hero">
        <p className="kicker">Workshop</p>
        <h1>ATOZ</h1>
        <p className="tagline">The whole alphabet of making, on one bench.</p>
        <p className="alpha" aria-hidden="true">
          A B C D E F G H I J K L M N O P Q R S T U V W X Y Z
        </p>
      </header>
      <div className="split">
        <form className="panel form-panel" onSubmit={onSubmit}>
          <label className="field">
            <span>Work order</span>
            <textarea
              value={prompt}
              onChange={(event) => setPrompt(event.target.value)}
              placeholder="A three-slide deck for a neighborhood tool library, warm and plainspoken."
              rows={5}
            />
          </label>
          <div className="choice-row">
            {examples.map((example) => (
              <button key={example} type="button" className="choice" onClick={() => setPrompt(example)}>
                {example}
              </button>
            ))}
          </div>
          <div className="form-actions">
            <button className="btn primary" type="submit" disabled={phase === "loading"}>
              {phase === "loading" ? "Working…" : "Draft a build"}
            </button>
          </div>
        </form>
        <section className="panel result-panel">
          <h2>Result</h2>
          <ResultSlot
            phase={phase}
            message={message}
            emptyTitle="No draft yet"
            emptyBody="Describe something above. A short plan will land here."
          >
            {feature && plan ? (
              <div className="ticket">
                <p className="kicker">Open this bench</p>
                <h3>{feature.name}</h3>
                <p>{plan.prompt}</p>
                <ol>
                  {plan.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
                <Link className="btn primary" href={feature.path} onClick={() => stashPrompt(plan.prompt)}>
                  Open {feature.name}
                </Link>
              </div>
            ) : null}
          </ResultSlot>
        </section>
      </div>

      <section className="directory">
        <h2>Recent drafts</h2>
        {drafts.length === 0 ? (
          <Notice tone="empty" title="Nothing saved yet">
            Drafts you start on this device show up here.
          </Notice>
        ) : (
          <ul className="draft-list">
            {drafts.map((draft) => {
              const bench = featureById(draft.featureId);
              return (
                <li key={draft.id}>
                  <div>
                    <strong>{bench?.name ?? draft.featureId}</strong>
                    <p>{draft.prompt}</p>
                    <small>{formatDay(draft.createdAt)}</small>
                  </div>
                  <div className="form-actions">
                    {bench ? (
                      <Link className="btn" href={bench.path} onClick={() => stashPrompt(draft.prompt)}>
                        Open
                      </Link>
                    ) : null}
                    <button type="button" className="btn quiet" onClick={() => dispatch({ type: "remove-draft", id: draft.id })}>
                      Remove
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <section className="directory">
        <h2>Benches</h2>
        <div className="bench-grid">
          {features
            .filter((featureItem) => featureItem.id !== "start")
            .map((featureItem) => (
              <Link key={featureItem.id} href={featureItem.path} className="bench-card">
                <strong>{featureItem.name}</strong>
                <span>{featureItem.summary}</span>
              </Link>
            ))}
        </div>
      </section>
    </article>
  );
}
