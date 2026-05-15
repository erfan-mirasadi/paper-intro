"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera } from "@react-three/drei";
import CaveModel from "./CaveModel";
import CaveEntrance from "./CaveEntrance";
import CavePillars from "./Pillars";
import MarbleFloor from "./MarbleFloor";
import VolumetricSmoke from "../environment/VolumetricSmoke";
import AnimatedFog from "../environment/AnimatedFog";
import SceneTransition from "../core/SceneTransition";

// ─────────────────────────────────────────────
// Cave fly-through camera.
// ─────────────────────────────────────────────
function TempCamera({
  isExiting,
  onReachEnd,
}: {
  isExiting: boolean;
  onReachEnd: () => void;
}) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [isPaused, setIsPaused] = useState(false);
  const hasTriggered = useRef(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        setIsPaused((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    // If the scene is transitioning out, STOP moving the camera
    if (!cameraRef.current || isPaused || isExiting) return;

    cameraRef.current.position.z += delta * 8;

    if (cameraRef.current.position.z >= 150 && !hasTriggered.current) {
      hasTriggered.current = true;
      onReachEnd();
    }
  });

  return (
    <PerspectiveCamera
      makeDefault
      ref={cameraRef}
      position={[0, 1, -48]}
      rotation={[0, Math.PI, 0]}
      fov={45}
      near={0.1}
      far={1000}
    />
  );
}

export default function CaveScene({ onComplete }: { onComplete?: () => void }) {
  const [sceneState, setSceneState] = useState<"intro" | "playing" | "exiting">(
    "intro",
  );
  const [isReady, setIsReady] = useState(false);

  const handleIntroComplete = useCallback(() => {
    setSceneState("playing");
  }, []);

  const handleSceneReady = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <SceneTransition
      isReady={isReady}
      isExiting={sceneState === "exiting"}
      introHoldMs={1500}
      exitHoldMs={9000}
      onIntroComplete={handleIntroComplete}
      onExitComplete={onComplete}
    >
      <SceneReadySignal onReady={handleSceneReady} />
      <group>
        <color attach="background" args={["#ffffff"]} />

        <TempCamera
          isExiting={sceneState === "exiting"}
          onReachEnd={() => setSceneState("exiting")}
        />

        <CaveEntrance
          position={[0.6, -0.5, 6]}
          rotation={[0, Math.PI, 0]}
          scale={1.8}
        />
        <MarbleFloor position={[0, 0.15, 203]} />
        <CavePillars position={[0.6, -0.5, 10]} />
        <CaveModel position={[0, 0, 0]} />

        <VolumetricSmoke
          count={50}
          animate={true}
          renderOrder={10}
          opacity={3}
          length={45}
          width={3}
          height={0}
          yOffset={5}
          minScale={10}
          maxScale={10}
          position={[0, -3.5, -17]}
          rotation={[0, Math.PI / 2, 0]}
          speedMultiplier={0.2}
          driftMultiplier={0.2}
          color="#696969"
        />
        <AnimatedFog color="#ffffff" baseDensity={0.0004} maxDensity={0.04} />
      </group>
    </SceneTransition>
  );
}

function SceneReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}
