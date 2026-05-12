// SceneTransition.tsx
// ─────────────────────────────────────────────────────────────────────────────
// Central controller for scene entry/exit transitions via CloudTunnel.
//
// Flow:
//   [enter]         → tunnel visible, hold for `holdMs`
//   [sequenceStart] → start camera sequence
//   [fadeOut]       → wait `fadeDelayMs` after sequence starts, then fade out tunnel.
//                     This allows the camera to be already moving when the fade happens.
//   [playing]       → RAF polls sequence position
//   [exit]          → `exitBeforeSec` before end, tunnel fades back in
//
// Usage (drop inside Canvas > TheatreSetup > Suspense):
//   <SceneTransition sequenceLength={29.35}>
//     {/* scene content */}
//   </SceneTransition>
// ─────────────────────────────────────────────────────────────────────────────
"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import CloudTunnel from "./CloudTunnel";
import { mainSheet, project } from "./TheatreSetup";

type Phase = "enter" | "sequenceStart" | "fadeOut" | "playing" | "exit";

interface SceneTransitionProps {
  children: ReactNode;
  /** Total Theatre sequence length in seconds */
  sequenceLength?: number;
  /** Ms to travel in the intro tunnel before starting the camera sequence (default 3500) */
  holdMs?: number;
  /**
   * Ms AFTER sequence starts to begin the tunnel fade out.
   * 500 = camera moves for 0.5s inside the fully visible tunnel before it starts fading.
   */
  fadeDelayMs?: number;
  /** Seconds before sequence end to trigger exit tunnel (default 2) */
  exitBeforeSec?: number;
}

export default function SceneTransition({
  children,
  sequenceLength = 29.35,
  holdMs         = 6500,  // Travel in clouds much longer initially
  fadeDelayMs    = 500,   // Camera moves for 0.5s before fade out
  exitBeforeSec  = 2,     // Bring clouds back 2s before end
}: SceneTransitionProps) {
  const [phase, setPhase] = useState<Phase>("enter");
  const rafRef = useRef<number>(0);

  const isTunnelActive = phase === "enter" || phase === "sequenceStart" || phase === "exit";

  // ── Phase 1: ENTER → SEQUENCE START after holdMs ──────────────────────────
  useEffect(() => {
    if (phase !== "enter") return;
    const t = setTimeout(() => setPhase("sequenceStart"), holdMs);
    return () => clearTimeout(t);
  }, [phase, holdMs]);

  // ── Phase 2: SEQUENCE START → play sequence, then FADE OUT ────────────────
  useEffect(() => {
    if (phase !== "sequenceStart") return;

    project.ready.then(() => {
      mainSheet.sequence.play({ iterationCount: 1 });
      
      const t = setTimeout(() => {
        setPhase("fadeOut");
      }, fadeDelayMs);

      return () => clearTimeout(t);
    });
  }, [phase, fadeDelayMs]);

  // ── Phase 3: FADE OUT to PLAYING ──────────────────────────────────────────
  // Transition smoothly from fadeOut to playing state
  useEffect(() => {
    if (phase !== "fadeOut") return;
    // We don't need a strict timer here, just move to playing state 
    // so the RAF can start monitoring for the exit.
    setPhase("playing");
  }, [phase]);

  // ── Phase 4: PLAYING → poll position, trigger exit ────────────────────────
  useEffect(() => {
    if (phase !== "playing") return;

    const threshold = sequenceLength - exitBeforeSec;

    const check = () => {
      if (mainSheet.sequence.position >= threshold) {
        setPhase("exit");
        return; // stop polling
      }
      rafRef.current = requestAnimationFrame(check);
    };

    rafRef.current = requestAnimationFrame(check);

    return () => {
      cancelAnimationFrame(rafRef.current);
    };
  }, [phase, sequenceLength, exitBeforeSec]);

  // ── Dev: Space = pause / resume ───────────────────────────────────────────
  useEffect(() => {
    let playing = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space") return;
      e.preventDefault();
      if (playing) { mainSheet.sequence.pause(); playing = false; }
      else         { mainSheet.sequence.play({ iterationCount: 1 }); playing = true; }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {children}
      <CloudTunnel isActive={isTunnelActive} />
    </>
  );
}
