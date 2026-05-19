"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import AnimatedFog from "../environment/AnimatedFog";
import MarbleFloor from "./MarbleFloor";
import PalaceModel from "./PalaceModel";
import type { SceneProps } from "../core/SceneManager";

export default function PalaceScene({ onComplete }: SceneProps = {}) {
  const [isPlaying, setIsPlaying] = useState(true);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Space") return;
      event.preventDefault();
      setIsPlaying((prev) => !prev);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  return (
    <>
      <color attach="background" args={["#ffffff"]} />

      <Suspense fallback={null}>
        <PalaceCamera isPlaying={isPlaying} />

        <AnimatedFog color="#ffffff" baseDensity={0.01} maxDensity={0.01} />

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

        <PalaceModel position={[0, 0, 0]} />
        <MarbleFloor position={[0, -0.02, 0]} ambientIntensity={1.4} />
      </Suspense>
    </>
  );
}

function PalaceCamera({ isPlaying }: { isPlaying: boolean }) {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const progressRef = useRef(0);
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const basePosition = useRef(new THREE.Vector3());

  // Start further back and lower so the camera approaches from afar and tilts up.
  const start = useMemo(() => new THREE.Vector3(0, 3, -120), []);
  const end = useMemo(() => new THREE.Vector3(0, 3, 50), []);
  const lookAtTarget = useMemo(() => new THREE.Vector3(0, 20, 200), []);
  const travelDuration = 12;

  useFrame((state, delta) => {
    if (!cameraRef.current) return;

    if (isPlaying) {
      progressRef.current = Math.min(
        1,
        progressRef.current + delta / travelDuration,
      );
    }

    basePosition.current.lerpVectors(start, end, progressRef.current);
    cameraRef.current.position.copy(basePosition.current);
    // Always orient the camera to look forward toward the target ahead
    cameraRef.current.lookAt(lookAtTarget);

    const maxPan = 0.25;
    const maxTilt = 0.18;
    targetOffset.current.x = -state.pointer.x * maxPan;
    targetOffset.current.y = state.pointer.y * maxTilt;
    currentOffset.current.lerp(targetOffset.current, 0.05);

    cameraRef.current.rotateY(currentOffset.current.x);
    cameraRef.current.rotateX(currentOffset.current.y);
  });

  return (
    <PerspectiveCamera
      makeDefault
      ref={cameraRef}
      position={[0, 3, -120]}
      fov={75}
      near={0.1}
      far={10000}
    />
  );
}
