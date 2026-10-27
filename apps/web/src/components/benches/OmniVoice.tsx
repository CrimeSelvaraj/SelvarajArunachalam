"use client";

import { useState } from "react";
import { Bench, Notice, ResultSlot, usePhase } from "@/components/ui";
import { groupLabel, mustFeature } from "@/features";
import { hashString, uid } from "@/lib/hash";
import { canSpeak, speak } from "@/lib/speech";
import { dispatch, useStore, type VoiceProfile } from "@/store";

const sampleSpeech = "I keep the good tools on the lower shelf, and I say so before I lend them.";

export function OmniVoice() {
  const feature = mustFeature("omnivoice");
  const { voices } = useStore();
  const [name, setName] = useState("Shelf voice");
  const [sample, setSample] = useState("");
  const [line, setLine] = useState("The bench is open until dusk.");
  const [selected, setSelected] = useState<string>("");
  const [spoken, setSpoken] = useState("");
  const { phase, message, run } = usePhase();
  const active = voices.find((voice) => voice.id === selected) ?? voices[0];

  async function saveProfile(event: React.FormEvent) {
    event.preventDefault();
    await run(async () => {
      const trimmedName = name.trim();
      const trimmedSample = sample.trim();
      if (trimmedName.length < 2) throw new Error("Name the voice so you can find it later.");
      if (trimmedSample.length < 24) throw new Error("Add a little more sample speech so the profile has a shape.");
      const hash = hashString(trimmedSample);
      const voice: VoiceProfile = {
        id: uid("voice"),
        name: trimmedName,
        sample: trimmedSample,
        pitch: 0.75 + (hash % 55) / 100,
        rate: 0.88 + ((hash >>> 8) % 28) / 100,
      };
      dispatch({ type: "add-voice", voice });
      setSelected(voice.id);
      setSpoken("");
    });
  }

  async function speakLine() {
    await run(async () => {
      if (!active) throw new Error("Save a voice profile first.");
      const text = line.trim();
      if (text.length < 2) throw new Error("Write the line you want spoken.");
      if (!canSpeak()) {
        setSpoken(text);
        throw new Error("This device has no speech engine. The line is saved on screen anyway.");
      }
      await speak(text, active.pitch, active.rate);
      setSpoken(text);
    });
  }

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        <ResultSlot
          phase={phase === "ready" || spoken || active ? "ready" : phase}
          message={message}
          emptyTitle="No voice yet"
          emptyBody="Save a profile, then speak a new line."
        >
          {active ? (
            <div className="readout">
              <p className="kicker">{active.name}</p>
              <p>Pitch {active.pitch.toFixed(2)} · pace {active.rate.toFixed(2)}</p>
              <p className="mono">{active.sample}</p>
              {spoken ? (
                <p>
                  <strong>Spoken:</strong> {spoken}
                </p>
              ) : (
                <p>Profile saved on this device. Speak a line when you are ready.</p>
              )}
              {phase === "error" ? <Notice tone="error" title="Needs a fix">{message}</Notice> : null}
              {phase === "loading" ? <Notice tone="loading" title="Working on it">This stays in the browser.</Notice> : null}
            </div>
          ) : null}
        </ResultSlot>
      }
    >
      <form onSubmit={(event) => void saveProfile(event)}>
        <label className="field">
          <span>Voice name</span>
          <input value={name} onChange={(event) => setName(event.target.value)} />
        </label>
        <label className="field">
          <span>Sample speech</span>
          <textarea value={sample} onChange={(event) => setSample(event.target.value)} rows={4} placeholder={sampleSpeech} />
        </label>
        <div className="form-actions">
          <button type="button" className="btn" onClick={() => setSample(sampleSpeech)}>
            Use sample speech
          </button>
          <button type="submit" className="btn">
            Save voice profile
          </button>
        </div>
      </form>
      {voices.length === 0 ? (
        <p className="hint">No profiles yet.</p>
      ) : (
        <div className="choice-row">
          {voices.map((voice) => (
            <button
              key={voice.id}
              type="button"
              className="choice"
              aria-pressed={(active?.id ?? "") === voice.id}
              onClick={() => setSelected(voice.id)}
            >
              {voice.name}
            </button>
          ))}
        </div>
      )}
      <label className="field">
        <span>New line</span>
        <input value={line} onChange={(event) => setLine(event.target.value)} />
      </label>
      <div className="form-actions">
        <button type="button" className="btn primary" onClick={() => void speakLine()} disabled={phase === "loading"}>
          {phase === "loading" ? "Working…" : "Speak the line"}
        </button>
        {active ? (
          <button type="button" className="btn quiet" onClick={() => dispatch({ type: "remove-voice", id: active.id })}>
            Remove profile
          </button>
        ) : null}
      </div>
    </Bench>
  );
}
