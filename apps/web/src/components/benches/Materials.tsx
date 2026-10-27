"use client";

import Link from "next/link";
import { useState } from "react";
import { Bench, Notice } from "@/components/ui";
import { tracks } from "@/data";
import { featureById, groupLabel, mustFeature } from "@/features";
import { dispatch, useStore } from "@/store";

export function Materials() {
  const feature = mustFeature("materials");
  const { progress } = useStore();
  const [trackId, setTrackId] = useState(tracks[0].id);
  const [lessonId, setLessonId] = useState("");
  const track = tracks.find((item) => item.id === trackId) ?? tracks[0];
  const lesson = track.lessons.find((item) => item.id === lessonId);
  const doneInTrack = track.lessons.filter((item) => progress[item.id]).length;
  const total = tracks.reduce((sum, item) => sum + item.lessons.length, 0);
  const done = tracks.reduce((sum, item) => sum + item.lessons.filter((lessonItem) => progress[lessonItem.id]).length, 0);
  const bench = featureById(track.benchId);

  return (
    <Bench
      kicker={groupLabel(feature.group)}
      title={feature.name}
      lede={feature.summary}
      result={
        lesson ? (
          <div className="readout">
            <p className="kicker">{track.title}</p>
            <h3>{lesson.title}</h3>
            <p>{lesson.body}</p>
            <p>
              {doneInTrack} of {track.lessons.length} lessons marked on this track. {done} of {total} overall.
            </p>
            <div className="bar" aria-hidden="true">
              <span style={{ width: `${(done / total) * 100}%` }} />
            </div>
            {doneInTrack === track.lessons.length ? <Notice tone="empty" title="Track finished">You can still reread any lesson.</Notice> : null}
            <div className="form-actions">
              <button type="button" className="btn primary" onClick={() => dispatch({ type: "toggle-lesson", id: lesson.id })}>
                {progress[lesson.id] ? "Mark as not done" : "Mark complete"}
              </button>
              {bench ? (
                <Link className="btn" href={bench.path}>
                  Open {bench.name}
                </Link>
              ) : null}
            </div>
          </div>
        ) : (
          <Notice tone="empty" title="Choose a lesson">The reading shows up here.</Notice>
        )
      }
    >
      <div className="choice-row">
        {tracks.map((item) => (
          <button
            key={item.id}
            type="button"
            className="choice"
            aria-pressed={item.id === track.id}
            onClick={() => {
              setTrackId(item.id);
              setLessonId("");
            }}
          >
            {item.title}
          </button>
        ))}
      </div>
      <div className="bar" aria-label={`${doneInTrack} of ${track.lessons.length} complete`}>
        <span style={{ width: `${(doneInTrack / track.lessons.length) * 100}%` }} />
      </div>
      <div className="lesson-list">
        {track.lessons.map((item) => (
          <button
            key={item.id}
            type="button"
            className="choice lesson"
            aria-pressed={item.id === lessonId}
            onClick={() => setLessonId(item.id)}
          >
            <span>{item.title}</span>
            <small>{progress[item.id] ? "Done" : "Open"}</small>
          </button>
        ))}
      </div>
    </Bench>
  );
}
