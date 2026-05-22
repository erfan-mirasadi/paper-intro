"use client";

/**
 * CaveScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * This scene is ALWAYS mounted.  All heavy Three.js objects live in VRAM
 * permanently.  isActive controls camera/sequence logic; isVisible controls
 * group.visible (Three.js skips draw calls but keeps GPU memory).
 *
 * Guards in useFrame: return early when !isActive to be CPU-free when hidden.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { PerspectiveCamera as TheatrePerspectiveCamera } from "@theatre/r3f";
import { SheetProvider } from "@theatre/r3f";
import { getProject } from "@theatre/core";
import CaveModel from "./CaveModel";
import LowpolyMountain from "./LowpolyMountain";
import AnimatedFog from "../environment/AnimatedFog";
import SweepRevealWrapper from "../environment/SweepRevealWrapper";
import DesertDust from "./DesertDust";
import CenterDust from "./CenterDust";
import Skybox from "../environment/Skybox";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";
import caveProjectState from "../../data/CaveProject.theatre-project-state.json";

const caveProject = getProject("CaveProject", {
  state: caveProjectState as any,
});
const caveSheet = caveProject.sheet("CaveScene");

const TRIGGER_POSITION = 7.5;
const CAMERA_SPEED = 0.56;

interface CaveSceneProps {
  isActive: boolean; // controls camera rig, sequence, exit trigger
  isVisible: boolean; // controls group.visible (Three.js draw-call skip)
}

export default function CaveScene({ isActive, isVisible }: CaveSceneProps) {
  // Ref mirror for use inside useFrame / event-bus callbacks without stale closures
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const [isPlaying, setIsPlaying] = useState(true);
  const [isRevealed, setIsRevealed] = useState(false);

  const theatreCamRef = useRef<THREE.PerspectiveCamera>(null);

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
    if (isPlaying) {
      caveSheet.sequence.play({ iterationCount: 1, rate: CAMERA_SPEED });
    } else {
      caveSheet.sequence.pause();
    }
  }, [isPlaying]);

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
    // visible={isVisible}: Three.js skips all draw calls but keeps shaders/geometry in VRAM
    <SheetProvider sheet={caveSheet}>
      <group visible={isVisible}>
        <CameraRig theatreCamRef={theatreCamRef} isActive={isActive} />

        {/* Invisible Theatre camera object — animated by caveSheet keyframes */}
        <TheatrePerspectiveCamera
          theatreKey="Camera"
          ref={theatreCamRef}
          makeDefault={false}
          position={[0, 1, -48]}
          rotation={[0, Math.PI, 0]}
          fov={45}
          near={0.1}
          far={10000}
        />

        {/*
         * AnimatedFog writes to scene.fog globally.
         * Only render when isActive so inactive scenes don't fight over fog.
         */}
        {isActive && <AnimatedFog color={"#c0a382"} maxDensity={0.005} />}

        {/* Skybox always mounted for warmup/preloading. isActive controls global state application, isVisible controls rendering */}
        <Skybox
          isActive={isActive}
          isVisible={isVisible}
          image="/assets/cave/sunset.jpg"
          showMoon={false}
          environmentFile="/assets/cave/desert-HDR_2k.hdr"
          skyPosition={[0, -0.76, 0]}
          skyRotation={[0, -0.5, 0]}
          skyScale={[3, 1, 3]}
          distance={1}
        />

        <SweepRevealWrapper
          maxRadius={900}
          speed={100}
          mode="overlay"
          autoTriggerDelay={1900}
          onRevealStart={handleSweepRevealStart}
          isActive={isActive}
        >
          <CaveModel />
          <LowpolyMountain />
        </SweepRevealWrapper>

        <DesertDust />
        <CenterDust />

        <ambientLight intensity={isRevealed ? 1 : 0.1} />
      </group>
    </SheetProvider>
  );
}

// ── CameraRig ─────────────────────────────────────────────────────────────
// Reads Theatre-animated cave camera → writes to state.camera (global).
// Completely CPU-free when !isActive.

function CameraRig({
  theatreCamRef,
  isActive,
}: {
  theatreCamRef: React.RefObject<THREE.PerspectiveCamera | null>;
  isActive: boolean;
}) {
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const exitTriggeredRef = useRef(false);

  // Reset exit trigger each time scene activates
  useEffect(() => {
    if (isActive) {
      exitTriggeredRef.current = false;
    }
  }, [isActive]);

  useFrame((state) => {
    // ── Guard: do nothing when not active ──────────────────────────────
    if (!isActiveRef.current || !theatreCamRef.current) return;

    const { pointer, camera } = state;

    // Copy Theatre camera → global R3F camera
    camera.position.copy(theatreCamRef.current.position);
    camera.quaternion.copy(theatreCamRef.current.quaternion);

    if (
      camera instanceof THREE.PerspectiveCamera &&
      theatreCamRef.current instanceof THREE.PerspectiveCamera
    ) {
      let needsUpdate = false;
      if (camera.near !== theatreCamRef.current.near) {
        camera.near = theatreCamRef.current.near;
        needsUpdate = true;
      }
      if (camera.far !== 10000) {
        camera.far = 10000;
        needsUpdate = true;
      }
      if (needsUpdate) camera.updateProjectionMatrix();
    }

    // Mouse parallax
    targetOffset.current.x = -pointer.x * 0.4;
    targetOffset.current.y = pointer.y * 0.4;
    currentOffset.current.lerp(targetOffset.current, 0.05);
    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);

    // Exit trigger
    if (!exitTriggeredRef.current) {
      const pos = caveSheet.sequence.position;
      if (pos >= TRIGGER_POSITION && pos > 0.1) {
        exitTriggeredRef.current = true;
        requestTransition("tunnel", "palace");
      }
    }
  });

  return null;
}
