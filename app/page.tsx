// page.tsx
"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { PerspectiveCamera } from "@theatre/r3f";

import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
import OceanScene from "./components/OceanScene";
import StaticStarsParticles from "./components/StaticStarsParticles";
import TheatreSetup from "./components/TheatreSetup";
import SceneTransition from "./components/SceneTransition";

export default function Home() {
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
          <Suspense fallback={null}>
            <SceneTransition
              sequenceLength={29.35}
              holdMs={1800}
              overlapMs={0}
              exitBeforeSec={2}
            >
              <PerspectiveCamera
                theatreKey="MainCamera"
                makeDefault
                position={[0, 20, 100]}
                fov={45}
                near={0.1}
                far={20000}
              />

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
