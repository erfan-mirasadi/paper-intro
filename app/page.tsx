"use client";

import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { Suspense } from "react";
import {
  Environment,
  ContactShadows,
  Center,
  ScrollControls,
} from "@react-three/drei";
import RealModel from "./components/RealModel";
import Skybox from "./components/Skybox";
import ParticleMist from "./components/ParticleMist";
import SunBeam from "./components/SunBeam";
import ScrollCamera from "./components/ScrollCamera";
import Clouds from "./components/Clouds";
import GroundPlane from "./components/GroundPlane";

export default function Home() {
  return (
    <main className="relative w-full h-screen bg-[#050505] overflow-hidden">
      {/* Background UI */}
      <div className="absolute top-20 left-0 w-full flex flex-col items-center pointer-events-none z-0">
        <h1 className="text-[10vw] font-black text-white/5 uppercase tracking-tighter select-none leading-none">
          Makkah
        </h1>
      </div>

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
        <fogExp2 attach="fog" color="#A3906D" density={0.0004} />
        <Skybox />

        <ambientLight intensity={1.5} />
        <spotLight
          position={[10, 50, 10]}
          angle={0.15}
          penumbra={1}
          intensity={5}
          castShadow
        />
        <directionalLight position={[-10, 20, 10]} intensity={2} />
        <SunBeam />

        <Suspense fallback={null}>
          <ScrollControls pages={4} damping={0.2}>
            {/* Camera movement logic */}
            <ScrollCamera
              startPos={[0, 100, -1364]}
              endPos={[-12, 278, 2685]}
              startTarget={[459, 113, -8893]}
              endTarget={[0, 197, 0]}
            />

            <Clouds />
            <GroundPlane />

            <Center top>
              <group scale={1}>
                <RealModel url="/makkah-opt.glb" productTitle="Makkah Model" />
              </group>
            </Center>

            {/* توده‌های مه در نقاط مختلف */}
            <ParticleMist
              position={[0, 10, -900]}
              spread={[600, 100, 200]}
              count={100}
              size={300}
              opacity={0.1}
            />

            <ParticleMist
              position={[-300, 50, 160]}
              spread={[200, 50, 600]}
              count={300}
              size={250}
              opacity={0.01}
            />

            <ParticleMist
              position={[300, 50, 160]}
              spread={[200, 50, 600]}
              count={300}
              size={250}
              opacity={0.01}
            />
            <ParticleMist
              position={[0, 0, 0]}
              spread={[200, 50, 600]}
              count={300}
              size={250}
              opacity={0.01}
            />

            <ContactShadows
              position={[0, -5, 0]}
              opacity={0.4}
              scale={100}
              blur={2.4}
              far={10}
            />
            <Environment preset="sunset" />
          </ScrollControls>
        </Suspense>
      </Canvas>

      {/* Navigation / Info UI */}
      <div className="absolute bottom-10 left-1/2 -translate-x-1/2 z-20 flex flex-col items-center gap-4">
        <div className="px-6 py-2 bg-white/5 backdrop-blur-md border border-white/10 rounded-full">
          <span className="text-white/60 text-xs font-medium uppercase tracking-widest">
            Scroll to Navigate through the Model
          </span>
        </div>
      </div>
    </main>
  );
}
