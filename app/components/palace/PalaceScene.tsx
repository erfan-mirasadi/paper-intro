"use client";

/**
 * PalaceScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * Always mounted.  isActive drives camera + guards useFrame.
 * isVisible controls group.visible (zero GPU cost when hidden).
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef, useState } from "react";
// import { OrbitControls } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import AnimatedFog from "../environment/AnimatedFog";
import MarbleFloor from "./MarbleFloor";
import PalaceModel from "./PalaceModel";
import Idols from "./Idols";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";

interface PalaceSceneProps {
  isActive: boolean;
  isVisible: boolean;
}

export default function PalaceScene({ isActive, isVisible }: PalaceSceneProps) {
  const isDev = process.env.NODE_ENV === "development";

  return (
    <>
      {/* Background color: only set when active to avoid conflicts */}
      {isActive && <color attach="background" args={["#ffffff"]} />}

      {/* Three.js skips draw calls for visible=false but keeps VRAM intact */}
      <group visible={isVisible}>
        {/* AnimatedFog writes scene.fog globally — guard with isActive */}
        {isActive && (
          <AnimatedFog color="#ffffff" baseDensity={0.01} maxDensity={0.01} />
        )}

        {/* Camera rig: writes directly to state.camera — no competing camera mount */}
        <PalaceCamera isActive={isActive} />
        {/* {isDev && isActive && (
          <OrbitControls enableDamping dampingFactor={0.08} makeDefault />
        )} */}

        <ambientLight intensity={0.6} />
        <directionalLight
          position={[10, 18, 30]}
          intensity={2.2}
          color="#ffffff"
        />
        <directionalLight
          position={[-18, 12, 12]}
          intensity={1.4}
          color="#f8f4ee"
        />

        <PalaceModel position={[0, 3.5, 0]} />
        <MarbleFloor position={[0, -0.02, 0]} ambientIntensity={1.4} />
        <Idols
          position={[0, 0, 0]}
          idol1={{
            position: [8, 6.3, -28],
            rotation: [0, Math.PI / 2, 0],
            scale: 0.4,
          }}
          idol2={{
            position: [8, 0, 3],
            rotation: [0, -Math.PI / 2, 0],
            scale: 0.1,
          }}
          idol3={{
            position: [-8, 0, -11.5],
            rotation: [0, Math.PI * 0.5, 0],
            scale: 13,
          }}
          idol4={{
            position: [-113, -0.5, -20],
            rotation: [0, -Math.PI / 4, 0],
            scale: 37,
          }}
        />
      </group>
    </>
  );
}

// ── PalaceCamera ──────────────────────────────────────────────────────────
// Writes directly to the global state.camera (the one persistent R3F camera)
// so no competing camera object is ever mounted.
// Completely idle (CPU-free) when !isActive.

function PalaceCamera({ isActive }: { isActive: boolean }) {
  const { camera } = useThree();
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const [isPaused, setIsPaused] = useState(false);

  const progressRef = useRef(0);
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const exitTriggeredRef = useRef(false);
  const introCompletedRef = useRef(false);

  const start = useMemo(() => new THREE.Vector3(0, 3, 50), []);
  const end = useMemo(() => new THREE.Vector3(0, 3, -90), []);
  const lookAtTarget = useMemo(() => new THREE.Vector3(0, 20, -200), []);
  const travelDuration = 12; // seconds

  // Configure global camera for this scene once
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 75;
      camera.near = 0.1;
      camera.far = 10000;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  // Reset on deactivation so next visit starts clean
  useEffect(() => {
    if (!isActive) {
      progressRef.current = 0;
      exitTriggeredRef.current = false;
      setIsPaused(false);
    }
  }, [isActive]);

  // Listen for Space key press to toggle pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (e.code === "Space") {
        e.preventDefault(); // Prevent scrolling the page
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    // ── Guard: CPU-free when not active ───────────────────────────────
    if (!isActiveRef.current) return;

    if (!isPaused) {
      // Advance the dolly progress IMMEDIATELY so there is continuous motion
      // while the transition is happening. No more pauses!
      progressRef.current = Math.min(
        1,
        progressRef.current + delta / travelDuration,
      );
    }

    // ALWAYS update the camera position
    camera.position.lerpVectors(start, end, progressRef.current);
    camera.lookAt(lookAtTarget);

    // Mouse parallax
    targetOffset.current.x = -state.pointer.x * 0.25;
    targetOffset.current.y = state.pointer.y * 0.18;
    currentOffset.current.lerp(targetOffset.current, 0.05);
    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);

    // Exit trigger: dolly completed
    if (!exitTriggeredRef.current && progressRef.current >= 1.0) {
      exitTriggeredRef.current = true;
      requestTransition("tunnel", "ocean");
    }
  });

  return null;
}
