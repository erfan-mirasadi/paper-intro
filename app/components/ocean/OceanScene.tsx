"use client";

/**
 * OceanScene.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * Always mounted.  isActive drives camera, sequence, exit trigger.
 * isVisible controls group.visible.  All useFrame hooks return early when
 * !isActive so the scene costs nothing while hidden.
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { ThreeElement, useFrame, extend, useLoader } from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";
import Island from "./Island";
import Island2 from "./Island2";
import Lighthouse from "./Lighthouse";
import StaticClouds from "../environment/StaticClouds";
import Mountain2 from "./Mountain2";
import ParallaxCamera from "../ParallaxCamera";
import Skybox from "../environment/Skybox";
import StaticStarsParticles from "../environment/StarsParticles";
import AnimatedFog from "../environment/AnimatedFog";
import { mainSheet } from "../TheatreSetup";
import { requestTransition, onIntroComplete } from "../core/useSceneStore";

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
        <ParallaxCamera isActive={isActive} />

        {/* AnimatedFog: writes scene.fog globally — guard with isActive */}
        {isActive && (
          <AnimatedFog
            color="#030507"
            baseDensity={0.0004}
            maxDensity={0.003}
          />
        )}

        {/* Skybox always mounted for warmup/preloading. isActive controls global state application, isVisible controls rendering */}
        <Skybox isActive={isActive} isVisible={isVisible} />

        {/* Sequence driver + exit logic (CPU-free when not active) */}
        <OceanSequencer isActive={isActive} />

        {/* Heavy static content — always in VRAM, never unmounts */}
        <OceanSceneContent isActive={isActive} />
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
  const exitTriggeredRef = useRef(false);

  // Freeze & reset on deactivation, start slightly ahead on activation
  useEffect(() => {
    if (!isActive) {
      isPlayingRef.current = false;
      exitTriggeredRef.current = false;
      mainSheet.sequence.pause();
      mainSheet.sequence.position = START_OFFSET_SECONDS;
    } else {
      mainSheet.sequence.position = START_OFFSET_SECONDS;
      isPlayingRef.current = true;
      exitTriggeredRef.current = false;
    }
  }, [isActive]);

  // Spacebar pause/resume
  useEffect(() => {
    let manuallyPaused = false;
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== "Space" || !isActiveRef.current) return;
      e.preventDefault();
      manuallyPaused = !manuallyPaused;
      if (manuallyPaused) mainSheet.sequence.pause();
      else isPlayingRef.current = true;
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

// ── OceanSceneContent ─────────────────────────────────────────────────────
// Pure visual content.  Always in VRAM.  Water animation paused when inactive.

function OceanSceneContent({ isActive }: { isActive: boolean }) {
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const waterRef = useRef<Water>(null!);
  const pulseZ = useRef(2000);
  const SCENE_SIZE = 25000;
  const PULSE_LIMIT = SCENE_SIZE * -0.9;
  const mountainBrightness = 0.1;

  const darkWaterColor = useMemo(() => new THREE.Color(0x001e0f), []);
  const brightWaterColor = useMemo(() => new THREE.Color(0x00aaff), []);
  const moonWorldPosition = useMemo(
    () => new THREE.Vector3(0, 1400, -6370),
    [],
  );

  const moonConfig = useMemo(
    () => ({
      color: 0x5599cc,
      direction: new THREE.Vector3(0, 0.15, -1).normalize(),
      shininess: "2500.0",
      brightness: "10.0",
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

  useEffect(() => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material;

    mat.uniforms.uPulseZ = { value: 2000.0 };
    mat.uniforms.uBaseColor = { value: darkWaterColor.clone() };
    mat.uniforms.uPulseColor = { value: brightWaterColor.clone() };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPulseZ = mat.uniforms.uPulseZ;
      shader.uniforms.uBaseColor = mat.uniforms.uBaseColor;
      shader.uniforms.uPulseColor = mat.uniforms.uPulseColor;

      shader.fragmentShader = `
        uniform float uPulseZ;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        ${shader.fragmentShader}
      `;

      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4 noise = getNoise( worldPosition.xz * size );",
        `
        float curve = (worldPosition.x * worldPosition.x) * 0.00015;
        float energyRipple = sin(worldPosition.x * 0.05 + time * 4.0) * 15.0
                           + cos(worldPosition.x * 0.1 - time * 3.0) * 10.0;
        float pulseZAtX = uPulseZ + curve + energyRipple;
        float distToPulse = abs(worldPosition.z - pulseZAtX);
        float glowAlpha = smoothstep(300.0, 0.0, distToPulse);
        float coreAlpha = smoothstep(40.0, 0.0, distToPulse);
        float echoZ = pulseZAtX + 350.0;
        float echoDist = abs(worldPosition.z - echoZ);
        float echoAlpha = smoothstep(80.0, 0.0, echoDist) * 0.4;
        vec3 baseWithGlow = mix(uBaseColor, uPulseColor, glowAlpha);
        vec3 withCore = mix(baseWithGlow, vec3(0.8, 0.95, 1.0), coreAlpha);
        vec3 dynamicWaterColor = mix(withCore, uPulseColor, echoAlpha);
        vec4 noise = getNoise( worldPosition.xz * size );
        `,
      );

      shader.fragmentShader = shader.fragmentShader
        .replace(" * waterColor", " * dynamicWaterColor")
        .replace("mix( waterColor,", "mix( dynamicWaterColor,")
        .replace(
          "100.0, 2.0, 0.5",
          `${moonConfig.shininess}, ${moonConfig.brightness}, 0.5`,
        );
    };

    mat.customProgramCacheKey = () => "pulse_water_shader";
    mat.needsUpdate = true;
  }, [darkWaterColor, brightWaterColor, moonConfig]);

  useFrame((state, delta) => {
    // ── Guard: skip water animation tick when not active (CPU-free) ───
    if (!isActiveRef.current || !waterRef.current) return;

    const mat = waterRef.current.material;
    if (mat.uniforms?.time) mat.uniforms.time.value += delta * 0.35;
    if (pulseZ.current > PULSE_LIMIT) pulseZ.current -= delta * 800;
    if (mat.uniforms.uPulseZ) mat.uniforms.uPulseZ.value = pulseZ.current;
    if (mat.uniforms.sunDirection) {
      mat.uniforms.sunDirection.value
        .copy(moonWorldPosition)
        .sub(state.camera.position)
        .normalize();
    }
  });

  const bgMountainPos = [0, -25, -14000] as const;
  const bgMountainStretch = [1.5, 1, 1] as const;
  const bgMountainScale = 40;
  const bgMountainSpread = 5000;

  return (
    <>
      <StaticStarsParticles />

      <Island />
      <Island2 />
      <Lighthouse />
      <StaticClouds opacity={0.1} />
      <Mountain2
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
      />

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
      </group>

      <group position={[0, -2, 0]}>
        <water
          ref={waterRef}
          args={[waterGeometry, config]}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            pulseZ.current = e.camera.position.z;
          }}
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
    </>
  );
}
