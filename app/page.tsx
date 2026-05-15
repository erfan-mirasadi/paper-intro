"use client";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import MusicPlayer from "./components/ui/MusicPlayer";
import SceneManager from "./components/core/SceneManager";

export default function Home() {
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
        <SceneManager />
      </Canvas>
    </main>
  );
}
