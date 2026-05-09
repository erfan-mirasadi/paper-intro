"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { Environment, OrbitControls } from "@react-three/drei";
import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
import OceanScene from "./components/OceanScene";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      {/* 3D Canvas */}
      <Canvas
        shadows
        camera={{ position: [0, 20, 100], fov: 45, near: 0.1, far: 20000 }}
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        className="z-10"
      >
        <Skybox />
        <fog attach="fog" args={["#1e2f3f", 10, 4000]} />
        <NeonLinesScene />

        <Suspense fallback={null}>
          <OceanScene />
          <OrbitControls makeDefault enableDamping />

          <Environment preset="sunset" />
        </Suspense>
      </Canvas>
    </main>
  );
}
