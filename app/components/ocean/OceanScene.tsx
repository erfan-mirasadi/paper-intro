"use client";

/**
 * OceanScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * Always mounted.  isActive drives camera, sequence, exit trigger.
 * isVisible controls group.visible.  All useFrame hooks return early when
 * !isActive so the scene costs nothing while hidden.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useRef, useMemo, useEffect, useCallback, useState } from "react";
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
import OceanCamera from "./OceanCamera";
import StaticClouds from "../environment/StaticClouds";
// import Mountain2 from "./Mountain2";

// import ParallaxCamera from "../ParallaxCamera";
import Skybox from "../environment/Skybox";
import OceanGradientSky from "../environment/OceanGradientSky";
import StaticStarsParticles from "../environment/StarsParticles";
import AnimatedFog from "../environment/AnimatedFog";
import SweepRevealWrapper from "../environment/SweepRevealWrapper";
import { mainSheet } from "../TheatreSetup";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";
import Mountain2 from "./Mountain2";
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

// Optimized water plane bounds centered along camera track
const WATER_PLANE_WIDTH = 8000;
const WATER_PLANE_LENGTH = 20000;
const WATER_PLANE_Z = 1000;

interface OceanSceneProps {
  isActive: boolean;
  isVisible: boolean;
}

export default function OceanScene({ isActive, isVisible }: OceanSceneProps) {
  const [startVolcano, setStartVolcano] = useState(false);
  const [startStars, setStartStars] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setStartVolcano(false);
      setStartStars(false);
    }
  }, [isActive]);

  // Shared shake state: Volcano writes intensity, OceanCamera reads & decays it.
  // A plain ref avoids any React re-renders on every shake frame.
  const shakeRef = useRef({ intensity: 0 });

  const triggerCameraShake = useCallback(() => {
    shakeRef.current.intensity = 230; // strong initial amplitude, decays in OceanCamera
  }, []);

  const handleSweepRevealStart = useCallback(() => {
    // Delay the eruption slightly to let the sweep wave travel across the ocean
    setTimeout(() => {
      setStartVolcano(true);
      // Volcano explosion video starts 0.5s after startVolcano.
      // 1.0s after explosion = 1.5s total delay for stars.
      setTimeout(() => setStartStars(true), 1800);
    }, 1000);
  }, []);

  return (
    <>
      {/* Background + global state: only when active */}
      {isActive && <color attach="background" args={["#030507"]} />}
      {isActive && <AnimatedFog color="#172030" maxDensity={0.0004} />}

      <group visible={isVisible}>
        {/* OceanCamera: drives the global camera + applies camera shake */}
        <OceanCamera isActive={isActive} shakeRef={shakeRef} />

        {/* Skybox always mounted for warmup/preloading. isActive controls global state application, isVisible controls rendering */}
        <OceanGradientSky
          isActive={isActive}
          isVisible={isVisible}
          startVolcano={startVolcano}
        />

        {/* Water is outside SweepRevealWrapper because it has its own custom shader */}
        <OceanWater isActive={isActive} />

        {/* Static objects (islands, lighthouse, mountains) wrapped in SweepReveal */}
        <SweepRevealWrapper
          maxRadius={15000}
          speed={3000}
          trailLength={800}
          mode="overlay"
          beamColor={0xa6e6fa}
          onRevealStart={handleSweepRevealStart}
          isActive={isActive}
          autoTriggerDelay={2500}
        >
          <OceanStaticObjects
            startVolcano={startVolcano}
            startStars={startStars}
            onVolcanoCameraShake={triggerCameraShake}
          />
        </SweepRevealWrapper>
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
    () => new THREE.PlaneGeometry(WATER_PLANE_WIDTH, WATER_PLANE_LENGTH),
    [],
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
        position={[0, 0, WATER_PLANE_Z]}
      />
      <mesh position={[0, -510, WATER_PLANE_Z]}>
        <boxGeometry args={[WATER_PLANE_WIDTH, 1000, WATER_PLANE_LENGTH]} />
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

function OceanStaticObjects({
  startVolcano,
  startStars,
  onVolcanoCameraShake,
}: {
  startVolcano?: boolean;
  startStars?: boolean;
  onVolcanoCameraShake?: () => void;
}) {
  const mountainBrightness = 0.1;
  const bgMountainPos = [0, -25, -14000] as const;
  const bgMountainStretch = [1.5, 1, 1] as const;
  const bgMountainScale = 40;
  const bgMountainSpread = 5000;
  const WATER_SIZE = 25000;

  return (
    <>
      <StaticStarsParticles active={startStars} />
      <mesh position={[0, -1.8, WATER_PLANE_Z]} rotation-x={-Math.PI / 2}>
        <planeGeometry args={[WATER_PLANE_WIDTH, WATER_PLANE_LENGTH]} />
        <meshBasicMaterial
          color={0x001220}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      {/* <Island /> */}
      <Island2 />
      {/* <Lighthouse /> */}
      {/* <StaticClouds opacity={0.1} /> */}
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

      {/* Volcanic feature — sequence driven by startVolcano; shake wired to OceanCamera */}
      <Volcano
        position={[0, -80, 0]}
        scale={[60, 100, 60]}
        startSequence={startVolcano}
        onCameraShakeStart={onVolcanoCameraShake}
      />

      {/* <group position={bgMountainPos} scale={bgMountainStretch}>
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
