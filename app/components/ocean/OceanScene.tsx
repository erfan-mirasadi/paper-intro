"use client";

/**
 * OceanScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * Always mounted.  isActive drives camera, sequence, exit trigger.
 * isVisible controls group.visible.  All useFrame hooks return early when
 * !isActive so the scene costs nothing while hidden.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useRef, useMemo, useEffect, useCallback } from "react";
import * as THREE from "three";
import {
  ThreeElement,
  useFrame,
  useThree,
  extend,
  useLoader,
} from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";
import Island from "./Island";
import Island2 from "./Island2";
// import Lighthouse from "./Lighthouse";
import Volcano from "./Volcano";
import StaticClouds from "../environment/StaticClouds";
// import Mountain2 from "./Mountain2";

// import ParallaxCamera from "../ParallaxCamera";
import Skybox from "../environment/Skybox";
import StaticStarsParticles from "../environment/StarsParticles";
import AnimatedFog from "../environment/AnimatedFog";
// import SweepRevealWrapper from "../environment/SweepRevealWrapper";
import { mainSheet } from "../TheatreSetup";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";
// import { Environment } from "@react-three/drei";

extend({ Water });

declare module "@react-three/fiber" {
  interface ThreeElements {
    water: ThreeElement<typeof Water>;
  }
}

const EXIT_TRIGGER_POSITION = 14.0;
const PLAYBACK_RATE = 1 / 1.8;
const START_OFFSET_SECONDS = 0.5;

interface OceanSceneProps {
  isActive: boolean;
  isVisible: boolean;
}

export default function OceanScene({ isActive, isVisible }: OceanSceneProps) {
  const handleSweepRevealStart = useCallback(() => {}, []);

  return (
    <>
      {/* Background + global state: only when active */}
      {isActive && <color attach="background" args={["#030507"]} />}

      <group visible={isVisible}>
        {/*
         * ParallaxCamera: Theatre.js-driven camera rig for Ocean.
         * Now permanently mounted! We pass isActive so it only drives
         * the global state.camera when OceanScene is actually active.
         * This completely eliminates the React unmount/remount stutter.
         */}
        {/* <ParallaxCamera isActive={isActive} /> */}
        <OceanCamera isActive={isActive} />

        {/* AnimatedFog: writes scene.fog globally — guard with isActive */}
        {/* {isActive && (
          <AnimatedFog
            color="#030507"
            baseDensity={0.0004}
            maxDensity={0.003}
          />
        )} */}

        {/* Skybox always mounted for warmup/preloading. isActive controls global state application, isVisible controls rendering */}
        <Skybox isActive={isActive} isVisible={isVisible} />
        {/* Add a studio-style HDR environment for lighting when the scene is active */}
        {/* {isActive && <Environment preset="studio" background={false} />} */}
        {/* Sequence driver + exit logic (CPU-free when not active) */}
        {/* <OceanSequencer isActive={isActive} /> */}

        {/* Water is outside SweepRevealWrapper because it has its own custom shader */}
        <OceanWater isActive={isActive} />

        {/* Static objects (islands, lighthouse, mountains) wrapped in SweepReveal */}
        {/* <SweepRevealWrapper
          maxRadius={35000}
          speed={3000}
          trailLength={500}
          mode="overlay"
          onRevealStart={handleSweepRevealStart}
          isActive={isActive}
        > */}
        <OceanStaticObjects />
        {/* </SweepRevealWrapper> */}
      </group>
    </>
  );
}

// ── OceanSequencer ────────────────────────────────────────────────────────
// Advances mainSheet.sequence in useFrame. Starts slightly ahead when active.
// Resets cleanly on deactivation so next visit begins from the same offset.

function OceanSequencer({ isActive }: { isActive: boolean }) {
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const isPlayingRef = useRef(false);
  const isPausedRef = useRef(false);
  const exitTriggeredRef = useRef(false);

  // Freeze & reset on deactivation, start slightly ahead on activation
  useEffect(() => {
    if (!isActive) {
      isPlayingRef.current = false;
      isPausedRef.current = false;
      exitTriggeredRef.current = false;
      mainSheet.sequence.pause();
      mainSheet.sequence.position = START_OFFSET_SECONDS;
    } else {
      mainSheet.sequence.position = START_OFFSET_SECONDS;
      isPausedRef.current = false;
      isPlayingRef.current = true;
      exitTriggeredRef.current = false;
    }
  }, [isActive]);

  // Spacebar pause/resume
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !isActiveRef.current) return;
      e.preventDefault();
      isPausedRef.current = !isPausedRef.current;
      isPlayingRef.current = !isPausedRef.current;
      if (isPausedRef.current) mainSheet.sequence.pause();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Pause on unmount (safety)
  useEffect(() => {
    return () => {
      mainSheet.sequence.pause();
    };
  }, []);

  useFrame((_, delta) => {
    // ── Guard: CPU-free when not active ───────────────────────────────
    if (!isActiveRef.current || !isPlayingRef.current) return;

    const safeDelta = Math.min(delta, 0.1);
    mainSheet.sequence.position += safeDelta * PLAYBACK_RATE;

    // Trigger transition slightly before the end of the sequence.
    // At PLAYBACK_RATE = 1/1.8, 1 second of real time adds ~0.55 to sequence.position.
    // This allows a 1-second fade out while the camera is still smoothly moving up to 14.0.
    if (
      !exitTriggeredRef.current &&
      mainSheet.sequence.position >= EXIT_TRIGGER_POSITION - 0.55
    ) {
      exitTriggeredRef.current = true;
      // Do NOT set isPlayingRef to false so the camera keeps moving during the fade!
      requestTransition("black", "cave");
    }
  });

  return null;
}

// ── OceanCamera ──────────────────────────────────────────────────────────
// Writes directly to the global state.camera (the one persistent R3F camera)
// so no competing camera object is ever mounted.
// Completely idle (CPU-free) when !isActive.

function OceanCamera({ isActive }: { isActive: boolean }) {
  const { camera } = useThree();
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const isPausedRef = useRef(false);

  const progressRef = useRef(0);
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const exitTriggeredRef = useRef(false);

  const start = useMemo(() => new THREE.Vector3(0, 200, 3000), []);
  const end = useMemo(() => new THREE.Vector3(0, 200, -3500), []);
  const lookAtTarget = useMemo(() => new THREE.Vector3(0, 100, -3500), []);
  const travelDuration = 14;

  // Configure global camera for this scene once
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 70;
      camera.near = 0.1;
      camera.far = 25000;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  // Reset on deactivation so next visit starts clean
  useEffect(() => {
    if (!isActive) {
      progressRef.current = 0;
      exitTriggeredRef.current = false;
      isPausedRef.current = false;
    }
  }, [isActive]);

  // Listen for Space key press to toggle pause
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current) return;
      if (e.code === "Space") {
        e.preventDefault(); // Prevent scrolling the page
        isPausedRef.current = !isPausedRef.current;
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    // ── Guard: CPU-free when not active ───────────────────────────────
    if (!isActiveRef.current) return;

    if (!isPausedRef.current) {
      // Advance the dolly progress continuously. No clamp so it never stops!
      progressRef.current = progressRef.current + delta / travelDuration;
    }

    // ALWAYS update the camera position
    // Three.js lerpVectors does not clamp alpha, so it will continue extrapolating past 1.0
    camera.position.lerpVectors(start, end, progressRef.current);
    camera.lookAt(lookAtTarget);

    // Mouse parallax
    targetOffset.current.x = -state.pointer.x * 0.25;
    targetOffset.current.y = state.pointer.y * 0.18;
    currentOffset.current.lerp(targetOffset.current, 0.05);
    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);

    // Exit trigger: start transition slightly before the end
    // so it fades out completely while the camera is still in motion.
    if (!exitTriggeredRef.current && progressRef.current >= 0.91) {
      exitTriggeredRef.current = true;
      requestTransition("black", "cave");
    }
  });

  return null;
}

// ── OceanWater ────────────────────────────────────────────────────────────
// Water only — kept OUTSIDE of SweepRevealWrapper to avoid shader conflicts.
// The custom pulse wave shader has been removed per user request.

function OceanWater({ isActive }: { isActive: boolean }) {
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const waterRef = useRef<Water>(null!);
  const SCENE_SIZE = 25000;

  const moonWorldPosition = useMemo(
    () => new THREE.Vector3(0, 1400, -6370),
    [],
  );

  const moonConfig = useMemo(
    () => ({
      color: 0x5599cc,
      direction: new THREE.Vector3(0, 0.15, -1).normalize(),
    }),
    [],
  );

  const texture = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");
  const waterNormals = useMemo(() => {
    const t = texture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [texture]);

  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: moonConfig.direction,
      sunColor: moonConfig.color,
      waterColor: 0x00121a,
      distortionScale: 4.0,
      size: 1.0,
      fog: true,
      alpha: 0.85,
    }),
    [waterNormals, moonConfig],
  );

  const waterGeometry = useMemo(
    () => new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE),
    [SCENE_SIZE],
  );

  useFrame((state, delta) => {
    if (!isActiveRef.current || !waterRef.current) return;
    const mat = waterRef.current.material;
    if (mat.uniforms?.time) mat.uniforms.time.value += delta * 0.35;
    if (mat.uniforms.sunDirection) {
      mat.uniforms.sunDirection.value
        .copy(moonWorldPosition)
        .sub(state.camera.position)
        .normalize();
    }
  });

  return (
    <group position={[0, -2, 0]}>
      <water
        ref={waterRef}
        args={[waterGeometry, config]}
        rotation-x={-Math.PI / 2}
        position={[0, 0, 0]}
      />
      <mesh position={[0, -510, 0]}>
        <boxGeometry args={[SCENE_SIZE, 1000, SCENE_SIZE]} />
        <meshBasicMaterial
          color={0x001220}
          transparent
          opacity={0.8}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

// ── OceanStaticObjects ─────────────────────────────────────────────────────
// Islands, lighthouse, clouds, mountains — these are wrapped in SweepRevealWrapper.
// Water is intentionally excluded here (handled by OceanWater separately).

function OceanStaticObjects() {
  const mountainBrightness = 0.1;
  const bgMountainPos = [0, -25, -14000] as const;
  const bgMountainStretch = [1.5, 1, 1] as const;
  const bgMountainScale = 40;
  const bgMountainSpread = 5000;
  const WATER_SIZE = 25000;

  return (
    <>
      <StaticStarsParticles />

      {/*
       * Water-surface sweep overlay — a flat plane at the exact water level.
       * Water's ShaderMaterial cannot receive the sweep shader injection directly,
       * so this invisible plane acts as the "canvas" for the glow effect.
       * opacity=0.08 keeps it invisible in normal view; sweep glow lights it up.
       */}
      <mesh position={[0, -1.8, 0]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[WATER_SIZE, WATER_SIZE]} />
        <meshBasicMaterial
          color={0x001220}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      <Island />
      <Island2 />
      {/* <Lighthouse /> */}
      <StaticClouds opacity={0.1} />
      {/* <Mountain2
        position={[0, 500, 10000]}
        rotation={[0, 4, 0]}
        scale={40}
        color={[0.2, 0.2, 0.2]}
      />
      <Mountain2
        position={[1300, 300, 11000]}
        rotation={[0, Math.PI / 2, 0]}
        scale={40}
        color={[0.2, 0.2, 0.2]}
      /> */}

      {/* Volcanic feature placed in the distance — separate component */}
      <Volcano position={[0, -3, 0]} scale={30} />
      {/* 
      <group position={bgMountainPos} scale={bgMountainStretch}>
        <Mountain2
          position={[0, 0, 0]}
          rotation={[0, 4, 0]}
          scale={bgMountainScale}
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
        <Mountain2
          position={[bgMountainSpread + 5500, 0, 0]}
          scale={bgMountainScale * 0.8}
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
        <Mountain2
          position={[bgMountainSpread * 2.5, 0, 0]}
          scale={bgMountainScale * 1.2}
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
      </group> */}
    </>
  );
}
