// page.tsx
"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import { OrbitControls } from "@react-three/drei";
import { PerspectiveCamera } from "@theatre/r3f";

import Skybox from "./components/Skybox";
import NeonLinesScene from "./components/NeonLinesScene";
import OceanScene from "./components/OceanScene";
import StaticStarsParticles from "./components/StaticStarsParticles";
import CloudTunnel from "./components/CloudTunnel";
import TheatreSetup from "./components/TheatreSetup";

export default function Home() {
  return (
    <main className="relative w-full h-screen overflow-hidden">
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: true,
          toneMapping: THREE.ACESFilmicToneMapping,
        }}
        dpr={[1, 2]}
        className="z-10"
      >
        <TheatreSetup>
          {/*
            fallback null mishe k ta hamechi load nashode chizi render nashe.
            injoori lag az bein mire va vaghti 100% shod 60fps narm miad bala.
          */}
          <Suspense fallback={null}>
            {/* 
              Use Theatre's PerspectiveCamera.
              It connects directly to the Studio for easy keyframing.
            */}
            <PerspectiveCamera
              theatreKey="MainCamera"
              makeDefault
              position={[0, 20, 100]}
              fov={45}
              near={0.1}
              far={20000}
            />

            <Skybox />
            {/* <fog attach="fog" args={["#1e2f3f", 10, 4000]} /> */}

            {/* Neon lines are always in front of the camera as requested */}
            <NeonLinesScene />
            <StaticStarsParticles />

            {/* 
            Pass isActive={true} to trigger fade in and move forward.
            Pass isActive={false} to fade out and move back.
          */}
            <CloudTunnel isActive={true} />

            <OceanScene />

            {/* 
              Keep OrbitControls commented out while using Theatre.js for camera animations.
              If it is active, it will override Theatre.js and lock your keyframes!
            */}
            {/* <OrbitControls makeDefault enableDamping /> */}

            {/* <Environment preset="sunset" /> */}
          </Suspense>
        </TheatreSetup>
      </Canvas>
    </main>
  );
}
