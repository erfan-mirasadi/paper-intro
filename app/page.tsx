// page.tsx
"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense, useState, useCallback } from "react";
import ParallaxCamera from "./components/ParallaxCamera";
import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
import OceanScene from "./components/OceanScene";
import StaticStarsParticles from "./components/StarsParticles";
import TheatreSetup from "./components/TheatreSetup";
import SceneTransition from "./components/SceneTransition";
import SequenceController from "./components/SequenceController";
import MusicPlayer from "./components/MusicPlayer";
import AnimatedFog from "./components/AnimatedFog";

export default function Home() {
  const [startPlayback, setStartPlayback] = useState(false);

  const handleHoldComplete = useCallback(() => {
    setStartPlayback(true);
  }, []);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <MusicPlayer />
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        className="z-10"
      >
        <AnimatedFog color="#030507" baseDensity={0.0004} maxDensity={0.003} />
        <TheatreSetup>
          <SequenceController
            isPlaying={startPlayback}
            playbackRate={1 / 1.8}
          />
          <Suspense fallback={null}>
            <SceneTransition
              holdMs={4800}
              onHoldComplete={handleHoldComplete}
              sequenceLength={29.35}
              exitBeforeSec={16}
              systemMovementSpeed={90}
              startAfterSec={0.45}
            >
              <ParallaxCamera />

              <Skybox />

              <NeonLinesScene />
              <StaticStarsParticles />
              <OceanScene />
            </SceneTransition>
          </Suspense>
        </TheatreSetup>
      </Canvas>
    </main>
  );
}
