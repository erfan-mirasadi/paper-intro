// page.tsx
"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense, useState } from "react";
import ParallaxCamera from "./components/ParallaxCamera";
import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
import OceanScene from "./components/OceanScene";
import StaticStarsParticles from "./components/StaticStarsParticles";
import TheatreSetup from "./components/TheatreSetup";
import SceneTransition from "./components/SceneTransition";
import SequenceController from "./components/SequenceController";

export default function Home() {
  const [startPlayback, setStartPlayback] = useState(false);

  return (
    <main className="relative w-full h-screen overflow-hidden">
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        className="z-10"
      >
        <TheatreSetup>
          <SequenceController
            isPlaying={startPlayback}
            playbackRate={1 / 1.5}
          />
          <Suspense fallback={null}>
            <SceneTransition
              holdMs={4800}
              onHoldComplete={() => setStartPlayback(true)}
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
