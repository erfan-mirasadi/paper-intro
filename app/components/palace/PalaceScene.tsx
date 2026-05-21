"use client";

/**
 * PalaceScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * Always mounted.  isActive drives camera + guards useFrame.
 * isVisible controls group.visible (zero GPU cost when hidden).
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import AnimatedFog from "../environment/AnimatedFog";
import MarbleFloor from "./MarbleFloor";
import PalaceModel from "./PalaceModel";
import FallingIdols from "./FallingIdols";
import { requestTransition } from "../core/useSceneStore";

interface PalaceSceneProps {
  isActive: boolean;
  isVisible: boolean;
}

export default function PalaceScene({ isActive, isVisible }: PalaceSceneProps) {
  return (
    <>
      {isActive && <color attach="background" args={["#ffffff"]} />}

      {/* Three.js skips draw calls for visible=false but keeps VRAM intact */}
      <group visible={isVisible}>
        {isActive && (
          <AnimatedFog
            color="#ffffff"
            fogType="exp2"
            baseDensity={0.0004}
            maxDensity={0.01}
            near={20}
            far={100}
          />
        )}
        {/* Camera rig: writes directly to state.camera — no competing camera mount */}
        <PalaceCamera isActive={isActive} />
        <ambientLight intensity={0.1} />

        <PalaceModel position={[0, 3.5, 0]} scale={[1.6, 1, 2]} />
        <MarbleFloor position={[0, -0.02, -70]} />
        <FallingIdols
          isActive={isActive}
          position={[0, 0, 0]}
          idol1={{
            position: [10, 0, -85],
            rotation: [0, -Math.PI / 2, 0],
            scale: 0.4,
          }}
          idol2={{
            position: [-18, 0, -55],
            rotation: [0, Math.PI / 2, 0],
            scale: 17,
          }}
          idol3={{
            position: [10, 0, -25],
            rotation: [0, -Math.PI * 0.5, 0],
            scale: 16,
          }}
          idol4={{
            position: [-15, -0.9, 10],
            rotation: [0, Math.PI / 2, 0],
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

  const isPausedRef = useRef(false);

  const progressRef = useRef(0);
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const exitTriggeredRef = useRef(false);

  const start = useMemo(() => new THREE.Vector3(0, 3, 50), []);
  const end = useMemo(() => new THREE.Vector3(0, 3, -100), []);
  const lookAtTarget = useMemo(() => new THREE.Vector3(0, 50, -200), []);
  const travelDuration = 12;

  // Configure global camera for this scene once
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 70;
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
      isPausedRef.current = false;
    }
  }, [isActive]);

  // Listen for Space key press to toggle pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (e.code === "Space") {
        e.preventDefault(); // Prevent scrolling the page
        isPausedRef.current = !isPausedRef.current;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    // ── Guard: CPU-free when not active ───────────────────────────────
    if (!isActiveRef.current) return;

    if (!isPausedRef.current) {
      // Advance the dolly progress continuously. No clamp so it never stops!
      progressRef.current = progressRef.current + delta / travelDuration;
    }

    // ALWAYS update the camera position
    // Three.js lerpVectors does not clamp alpha, so it will continue extrapolating past 1.0
    camera.position.lerpVectors(start, end, progressRef.current);
    camera.lookAt(lookAtTarget);

    // Mouse parallax
    targetOffset.current.x = -state.pointer.x * 0.25;
    targetOffset.current.y = state.pointer.y * 0.18;
    currentOffset.current.lerp(targetOffset.current, 0.05);
    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);

    // Exit trigger: start transition slightly before the end
    // so it fades out completely while the camera is still in motion.
    if (!exitTriggeredRef.current && progressRef.current >= 0.91) {
      exitTriggeredRef.current = true;
      requestTransition("tunnel", "ocean");
    }
  });

  return null;
}
