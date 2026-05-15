"use client";

import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { mainSheet, project } from "../TheatreSetup";

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
  const isPlayingRef = useRef(false);
  const isReadyRef = useRef(false);
  const pendingStartRef = useRef(false);
  const isManuallyPausedRef = useRef(false);
  const playbackRateRef = useRef(playbackRate);

  useEffect(() => {
    playbackRateRef.current = playbackRate;
  }, [playbackRate]);

  useEffect(() => {
    project.ready.then(() => {
      isReadyRef.current = true;
      if (pendingStartRef.current && isPlayingRef.current) {
        mainSheet.sequence.position = 0;
        pendingStartRef.current = false;
      }
    });
  }, []);

  useEffect(() => {
    if (isPlaying && !isPlayingRef.current) {
      if (isReadyRef.current) {
        mainSheet.sequence.position = 0;
      } else {
        pendingStartRef.current = true;
      }
      isManuallyPausedRef.current = false;
    }

    isPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useFrame((_state, delta) => {
    if (!isPlayingRef.current || isManuallyPausedRef.current) return;
    if (!isReadyRef.current) return;

    mainSheet.sequence.position += delta * playbackRateRef.current;
  });

  // Handle spacebar to pause/play (manual override while the scene is playing)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (!isPlayingRef.current) return;
      isManuallyPausedRef.current = !isManuallyPausedRef.current;
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return null;
}
