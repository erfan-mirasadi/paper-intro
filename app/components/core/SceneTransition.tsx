"use client";

import { useEffect, useRef, ReactNode, Suspense } from "react";
import { useFrame } from "@react-three/fiber";
import { useTransitionController } from "./TransitionController";

interface SceneTransitionProps {
  children: ReactNode;
  /** Pass true when the scene is ready to transition out */
  isExiting?: boolean;
  /** Pass true when all scene content is ready to reveal */
  isReady?: boolean;
  /** Callback fired when the intro tunnel fade finishes */
  onIntroComplete?: () => void;
  /** Callback fired AFTER the exit tunnel has covered the screen */
  onExitComplete?: () => void;
  /** Ms to travel in the intro tunnel before starting to reveal the scene (default 4800) */
  introHoldMs?: number;
  /** Ms to keep the tunnel on screen AFTER isExiting becomes true, before unmounting the scene */
  exitHoldMs?: number;
  /** Speed at which the entire cloud and light system moves towards the camera */
  systemMovementSpeed?: number;
}

export default function SceneTransition({
  children,
  isExiting = false,
  isReady = true,
  onIntroComplete,
  onExitComplete,
  introHoldMs = 4800,
  exitHoldMs = 5000,
  systemMovementSpeed = 80,
}: SceneTransitionProps) {
  const hasIntroFired = useRef(false);
  const hasExitFired = useRef(false);
  const hasResetFired = useRef(false);

  // Use refs to track if timers have started
  const introStartedRef = useRef(false);
  const exitStartedRef = useRef(false);
  const introTimerAccumulator = useRef(0);
  const exitTimerAccumulator = useRef(0);

  const { showTunnel, hideTunnel, setSystemSpeed, resetTunnel } =
    useTransitionController();

  useEffect(() => {
    setSystemSpeed(systemMovementSpeed);
  }, [setSystemSpeed, systemMovementSpeed]);

  useEffect(() => {
    if (hasResetFired.current) return;
    resetTunnel();
    hasResetFired.current = true;
  }, [resetTunnel]);

  // ── 1. Intro Logic ──
  useEffect(() => {
    if (!isReady || hasIntroFired.current || isExiting) return;

    if (!introStartedRef.current) {
      resetTunnel();
      showTunnel();
      introStartedRef.current = true;
      introTimerAccumulator.current = 0;
    }
  }, [isReady, isExiting, resetTunnel, showTunnel]);

  useEffect(() => {
    if (!isReady && !hasIntroFired.current) {
      showTunnel();
    }
  }, [isReady, showTunnel]);

  // ── 2. Exit Logic ──
  useEffect(() => {
    if (isExiting && !hasExitFired.current) {
      if (!exitStartedRef.current) {
        resetTunnel();
        showTunnel();
        exitStartedRef.current = true;
        exitTimerAccumulator.current = 0;
      }
    }
  }, [isExiting, showTunnel, resetTunnel]);

  // ── 3. WebGL-Synced Animation Timer ──
  useFrame((_, delta) => {
    // Clamp delta to prevent massive jumps when framerate drops or browser freezes
    const safeDelta = Math.min(delta, 0.1);

    if (introStartedRef.current && !hasIntroFired.current && !isExiting) {
      introTimerAccumulator.current += safeDelta * 1000;
      if (introTimerAccumulator.current >= introHoldMs) {
        hideTunnel();
        hasIntroFired.current = true;
        if (onIntroComplete) onIntroComplete();
      }
    }

    if (exitStartedRef.current && !hasExitFired.current) {
      exitTimerAccumulator.current += safeDelta * 1000;
      if (exitTimerAccumulator.current >= exitHoldMs) {
        hasExitFired.current = true;
        if (onExitComplete) onExitComplete();
      }
    }
  });

  return (
    <>
      <Suspense fallback={null}>{children}</Suspense>
    </>
  );
}
