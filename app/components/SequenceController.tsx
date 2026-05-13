"use client";

import { useEffect } from "react";
import { mainSheet, project } from "./TheatreSetup";

interface SequenceControllerProps {
  /** If true, the sequence will play. Used to trigger playback externally. */
  isPlaying?: boolean;
  /** Playback rate (e.g., 1 for normal speed, 1/1.5 for 1.5x slower) */
  playbackRate?: number;
}

export default function SequenceController({
  isPlaying = false,
  playbackRate = 1,
}: SequenceControllerProps) {
  useEffect(() => {
    if (isPlaying) {
      project.ready.then(() => {
        mainSheet.sequence.play({ iterationCount: 1, rate: playbackRate });
      });
    }
  }, [isPlaying, playbackRate]);

  // Handle spacebar to pause/play
  useEffect(() => {
    let playing = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (playing) {
        mainSheet.sequence.pause();
        playing = false;
      } else {
        mainSheet.sequence.play({ iterationCount: 1, rate: playbackRate });
        playing = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playbackRate]);

  return null;
}
