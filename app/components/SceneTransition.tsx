"use client";

import { useEffect, useRef, useState, ReactNode } from "react";
import CloudTunnel from "./CloudTunnel";
import { mainSheet, project } from "./TheatreSetup";

interface SceneTransitionProps {
  children: ReactNode;
  /** Total Theatre sequence length in seconds */
  sequenceLength?: number;
  /** Ms to travel in the intro tunnel before starting the camera sequence (default 4800) */
  holdMs?: number;
  /** Callback fired when holdMs finishes */
  onHoldComplete?: () => void;
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
  holdMs = 4800,
  onHoldComplete,
  startAfterSec = 3.5, // Tweak this so you see the light source before it fades!
  exitBeforeSec = 2,
  systemMovementSpeed = 80, // Tweak this to control the global ocean speed towards the camera
}: SceneTransitionProps) {
  const [isTunnelActive, setIsTunnelActive] = useState(true);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout;
    let isCancelled = false;

    // Wait for the Theatre.js project to be fully ready
    project.ready.then(() => {
      if (isCancelled) return;

      if (onHoldComplete) {
        timeoutId = setTimeout(() => {
          if (!isCancelled) onHoldComplete();
        }, holdMs);
      }

      // Constantly monitor the timeline position to toggle the tunnel
      const syncTimeline = () => {
        if (isCancelled) return;

        const pos = mainSheet.sequence.position;

        // DEVELOPMENT: Prevent reaching the end transition since the next scene isn't built yet.
        // This avoids crashing or transitioning to a non-existent scene.
        if (pos >= sequenceLength - exitBeforeSec - 0.05) {
          mainSheet.sequence.pause();
        }

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
    });

    return () => {
      isCancelled = true;
      clearTimeout(timeoutId);
      cancelAnimationFrame(rafRef.current);
    };
  }, [holdMs, onHoldComplete, startAfterSec, sequenceLength, exitBeforeSec]);

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
