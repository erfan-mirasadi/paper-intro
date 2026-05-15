// page.tsx
"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useCallback, useRef, useEffect } from "react";
// import ParallaxCamera from "./components/ParallaxCamera";
// import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
// import OceanScene from "./components/OceanScene";
// import StaticStarsParticles from "./components/StarsParticles";
// import TheatreSetup from "./components/TheatreSetup";
// import SceneTransition from "./components/SceneTransition";
// import SequenceController from "./components/SequenceController";
import MusicPlayer from "./components/MusicPlayer";
// import AnimatedFog from "./components/AnimatedFog";
import CaveScene from "./components/cave/CaveScene";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";

function TempCamera() {
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);
  const [isPaused, setIsPaused] = useState(false);

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
    if (!cameraRef.current || isPaused) return;
    // Move from cave entrance (Z=0) towards the end (Z=200)
    cameraRef.current.position.z += delta * 8;
  });

  return (
    <PerspectiveCamera
      makeDefault
      ref={cameraRef}
      position={[0, 1, -48]} // Start a bit before the cave entrance
      // Look straight down (-Math.PI/2 on X)
      // and rotate 180deg on Z so that +Z direction is "up" on the screen (forward)
      rotation={[0, Math.PI, 0]}
      fov={45}
      near={0.1}
      far={1000}
    />
  );
}

export default function Home() {
  // const [startPlayback, setStartPlayback] = useState(false);

  // const handleHoldComplete = useCallback(() => {
  //   setStartPlayback(true);
  // }, []);

  return (
    <main className="relative w-full h-screen overflow-hidden bg-white">
      <MusicPlayer />
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        className="z-10"
        style={{ background: "#ffffff" }}
      >
        {/* <TheatreSetup>
          <SequenceController
            isPlaying={startPlayback}
            playbackRate={1 / 2.5}
          /> */}
        <Suspense fallback={null}>
          <TempCamera />
          {/* <OrbitControls makeDefault /> */}
          <NeonLinesScene />
          <CaveScene />
        </Suspense>
        {/* </TheatreSetup> */}
      </Canvas>
    </main>
  );
}
