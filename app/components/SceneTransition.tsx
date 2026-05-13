"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import CloudTunnel from "./CloudTunnel";
import { mainSheet, project } from "./TheatreSetup";

interface SceneTransitionProps {
  children: ReactNode;
  /** Total Theatre sequence length in seconds */
  sequenceLength?: number;
  /** Ms to travel in the intro tunnel before starting the camera sequence (default 6500) */
  holdMs?: number;
  /** Seconds AFTER sequence starts to begin the tunnel fade out */
  startAfterSec?: number;
  /** Seconds before sequence end to trigger exit tunnel (default 2) */
  exitBeforeSec?: number;
  /** Speed at which the entire cloud and light system moves towards the camera */
  systemMovementSpeed?: number;
}

export default function SceneTransition({
  children,
  sequenceLength = 29.35,
  holdMs = 6500,
  startAfterSec = 3.5, // Tweak this so you see the light source before it fades!
  exitBeforeSec = 2,
  systemMovementSpeed = 80, // Tweak this to control the global ocean speed towards the camera
}: SceneTransitionProps) {
  const [isTunnelActive, setIsTunnelActive] = useState(true);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;

    // Wait for the Theatre.js project to be fully ready
    project.ready.then(() => {
      // Hold in the cloud tunnel initially
      timeoutId = setTimeout(() => {
        mainSheet.sequence.play({ iterationCount: 1 });

        // Constantly monitor the timeline position to toggle the tunnel
        const syncTimeline = () => {
          const pos = mainSheet.sequence.position;

          // If we are in the middle part of the sequence, turn off the tunnel
          if (pos >= startAfterSec && pos < sequenceLength - exitBeforeSec) {
            setIsTunnelActive(false);
          } else {
            // Either at the very beginning or the very end
            setIsTunnelActive(true);
          }

          rafRef.current = requestAnimationFrame(syncTimeline);
        };

        rafRef.current = requestAnimationFrame(syncTimeline);
      }, holdMs);
    });

    return () => {
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafRef.current);
    };
  }, [holdMs, startAfterSec, sequenceLength, exitBeforeSec]);

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
        mainSheet.sequence.play({ iterationCount: 1 });
        playing = true;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      {children}
      <CloudTunnel
        isActive={isTunnelActive}
        systemSpeed={systemMovementSpeed}
      />
    </>
  );
}
