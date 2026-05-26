"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { SheetProvider } from "@theatre/r3f";
import { getProject } from "@theatre/core";
import CaveModel from "./CaveModel";
import SandDunes from "./SandDunes";
import AnimatedFog from "../environment/AnimatedFog";
import SweepRevealWrapper from "../environment/SweepRevealWrapper";
import DesertDust from "./DesertDust";
import CenterDust from "./CenterDust";
import CaveParticles from "./CaveParticles";
import CaveGradientSky from "../environment/CaveGradientSky";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";
import caveProjectState from "../../data/CaveProject.theatre-project-state.json";

const caveProject = getProject("CaveProject", {
  state: caveProjectState as any,
});
const caveSheet = caveProject.sheet("CaveScene");

export const CAMERA_DURATION_SECONDS = 25;

// Derived speeds so everything stays perfectly in sync automatically
const PROGRESS_SPEED = 1 / CAMERA_DURATION_SECONDS;
const THEATRE_RATE = 11.2 / CAMERA_DURATION_SECONDS;

interface CaveSceneProps {
  isActive: boolean;
  isVisible: boolean;
  hasEntered?: boolean;
}

function CaveCamera({
  isActive,
  isPlaying,
}: {
  isActive: boolean;
  isPlaying: boolean;
}) {
  const { get } = useThree();
  const startPos = useRef(new THREE.Vector3());
  const endPos = useMemo(() => new THREE.Vector3(-35.448, 20.836, 36.732), []);
  const endRot = useMemo(
    () => new THREE.Euler(-2.589, -1.396, -2.596, "XYZ"),
    [],
  );
  const progress = useRef(0);
  const exitTriggered = useRef(false);

  // Parallax refs
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const currentOffset = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    if (isActive) {
      const globalCamera = get().camera as THREE.PerspectiveCamera;
      
      // Increase far plane to prevent clipping when translating backwards
      globalCamera.far = 20000;
      globalCamera.updateProjectionMatrix();

      // Calculate start position by moving further backwards locally
      const tempCam = new THREE.PerspectiveCamera();
      tempCam.position.copy(endPos);
      tempCam.rotation.copy(endRot);
      tempCam.translateZ(1500); // Increased from 400 to 1500
      startPos.current.copy(tempCam.position);

      globalCamera.position.copy(startPos.current);
      globalCamera.rotation.copy(endRot);
      progress.current = 0;
      exitTriggered.current = false;
      currentOffset.current.set(0, 0);
    }
  }, [isActive, endPos, endRot, get]);

  useFrame((state, delta) => {
    if (!isActive) return;

    if (isPlaying && progress.current < 1) {
      progress.current += delta * PROGRESS_SPEED;
      if (progress.current > 1) progress.current = 1;
    }

    // Easing function (easeOutCubic)
    const ease = 1 - Math.pow(1 - progress.current, 3);

    state.camera.position.lerpVectors(startPos.current, endPos, ease);

    // Base rotation
    state.camera.rotation.copy(endRot);

    // Mouse Parallax
    targetOffset.current.x = -state.pointer.x * 0.4;
    targetOffset.current.y = state.pointer.y * 0.4;
    currentOffset.current.lerp(targetOffset.current, 0.05);

    // Apply parallax over the base rotation
    state.camera.rotateY(currentOffset.current.x);
    state.camera.rotateX(currentOffset.current.y);

    // Trigger transition near the end
    if (isPlaying && progress.current > 0.95 && !exitTriggered.current) {
      exitTriggered.current = true;
      requestTransition("tunnel", "palace");
    }
  });

  return null;
}

export default function CaveScene({
  isActive,
  isVisible,
  hasEntered = true,
}: CaveSceneProps) {
  // Ref mirror for use inside useFrame / event-bus callbacks without stale closures
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);

  // const theatreCamRef = useRef<THREE.PerspectiveCamera>(null);

  // ── Reset state when this scene becomes active again (loop) ────────
  useEffect(() => {
    if (isActive) {
      // Reset for fresh activation (e.g. after ocean→cave loop)
      setIsRevealed(false);
      caveSheet.sequence.position = 0;
      setIsPlaying(true);
    } else {
      // Freeze when hidden — CPU-free
      setIsPlaying(false);
    }
  }, [isActive]);

  // ── Drive caveSheet sequence ───────────────────────────────────────
  useEffect(() => {
    if (isPlaying && hasEntered) {
      caveSheet.sequence.play({ iterationCount: 1, rate: THEATRE_RATE });
    } else {
      caveSheet.sequence.pause();
    }
  }, [isPlaying, hasEntered]);

  // ── Spacebar pause / play (only while this scene is active) ────────
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !isActiveRef.current) return;
      e.preventDefault();
      setIsPlaying((prev) => !prev);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const handleSweepRevealStart = useCallback(() => setIsRevealed(true), []);

  return (
    <SheetProvider sheet={caveSheet}>
      <group visible={isVisible}>
        <CaveCamera isActive={isActive} isPlaying={isPlaying && hasEntered} />

        {isActive && (
          <AnimatedFog
            fogType="linear"
            color={"#c0a382"}
            near={150}
            far={1500}
          />
        )}

        <CaveGradientSky
          isActive={isActive}
          isVisible={isVisible}
          isRevealed={isRevealed}
          environmentFile="/assets/cave/desert-HDR_2k.hdr"
          skyPosition={[0, -0.76, 0]}
          skyRotation={[0, -0.2, 0]}
          skyScale={[3, 1, 3]}
          distance={1}
        />

        <SweepRevealWrapper
          maxRadius={4000}
          speed={250} // Halved from 300 to match the slower pace
          mode="overlay"
          beamColor={0xffdd44}
          glowIntensity={5.5}
          trailLength={300}
          autoTriggerDelay={3000} // Doubled from 3500 to match the slower camera progression
          onRevealStart={handleSweepRevealStart}
          isActive={isActive && hasEntered}
        >
          <CaveModel />
          <SandDunes position={[-300, 10, 0]} />
        </SweepRevealWrapper>

        <CaveParticles active={isRevealed} />

        {/* <DesertDust /> */}
        {/* <CenterDust /> */}
      </group>
    </SheetProvider>
  );
}
