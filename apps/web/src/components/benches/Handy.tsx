"use client";

import { useRef, useState } from "react";
import { Bench, Notice, ResultSlot, usePhase } from "@/components/ui";
import { sampleTake } from "@/data";
import { groupLabel, mustFeature } from "@/features";
import { uid, wait } from "@/lib/hash";
import { startRecognition } from "@/lib/speech";
import { dispatch, useStore } from "@/store";

function stamp(seconds: number): string {
  const whole = Math.max(0, Math.floor(seconds));
  const minutes = Math.floor(whole / 60);
  const remain = whole % 60;
  return `${minutes}:${remain.toString().padStart(2, "0")}`;
}

export function Handy() {
  const feature = mustFeature("handy");
  const { transcripts } = useStore();
  const [words, setWords] = useState<string[]>([]);
  const [live, setLive] = useState("");
  const [listening, setListening] = useState(false);
  const stopRef = useRef<{ stop: () => void } | null>(null);
  const cancel = useRef(false);
  const { phase, message, run, setPhase, setMessage } = usePhase();

  async function transcribeSample() {
    cancel.current = false;
    const parts = sampleTake.split(/\s+/);
    await run(async () => {
      setWords([]);
      setLive("");
      await wait(280);
      for (let index = 0; index < parts.length; index += 1) {
        if (cancel.current) return;
        await wait(70);
        setWords(parts.slice(0, index + 1));
      }
      dispatch({
        type: "add-transcript",
        transcript: { id: uid("take"), title: "Sample take", text: sampleTake, createdAt: Date.now() },
      });
    });
  }

  function listen() {
    const handle = startRecognition({
      onText: (text) => {
        setLive(text);
        setPhase("ready");
      },
      onError: () => {
        setListening(false);
        setPhase("error");
        setMessage("The microphone did not come through. You can still transcribe the sample take.");
      },
      onEnd: () => {
        setListening(false);
        setLive((current) => {
          if (current) {
            dispatch({
              type: "add-transcript",
              transcript: { id: uid("take"), title: "Microphone", text: current, createdAt: Date.now() },
            });
          }
          return current;
        });
      },
    });
    if (!handle) {
      setPhase("error");
      setMessage("This browser has no speech recognizer. Use the sample take.");
      return;
    }
    stopRef.current = handle;
    setListening(true);
    setPhase("loading");
    setMessage("");
  }

  function stop() {
    cancel.current = true;
    stopRef.current?.stop();
    setListening(false);
  }

  const shown = words.length > 0 ? words : live ? live.split(/\s+/) : [];

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot phase={phase === "ready" && shown.length === 0 ? "empty" : phase} message={message} emptyTitle="No transcript yet" emptyBody="Transcribe the sample take, or listen with the microphone.">
          <div className="readout">
            <p className="mono transcript">
              {shown.map((word, index) => (
                <span key={`${word}-${index}`}>
                  <small>{stamp(index * 0.35)} </small>
                  {word}{" "}
                </span>
              ))}
            </p>
            {phase === "loading" && listening ? <Notice tone="loading" title="Listening">Speak, then pause. The words land here.</Notice> : null}
          </div>
        </ResultSlot>
      }
    >
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void transcribeSample()} disabled={phase === "loading" && !listening}>
          {phase === "loading" && !listening ? "Working…" : "Transcribe sample"}
        </button>
        <button type="button" className="btn" onClick={listening ? stop : listen}>
          {listening ? "Stop listening" : "Listen"}
        </button>
      </div>
      {transcripts.length === 0 ? (
        <p className="hint">Saved transcripts show up after a take.</p>
      ) : (
        <ul className="draft-list">
          {transcripts.map((item) => (
            <li key={item.id}>
              <div>
                <strong>{item.title}</strong>
                <p>{item.text}</p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Bench>
  );
}
