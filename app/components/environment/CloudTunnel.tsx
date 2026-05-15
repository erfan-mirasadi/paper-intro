"use client";

import { useRef, useMemo, useState, useEffect, useCallback } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

import {
  baseCameraPosition,
  baseCameraQuaternion,
  baseCameraUpdatedAt,
} from "../ParallaxCamera";

useTexture.preload("/smoke.png");
useTexture.preload("/lensflare.png");

interface CloudTunnelProps {
  /** true = tunnel fades in, false = tunnel fades out */
  isActive?: boolean;
  /** Speed at which the entire system (clouds + lights) moves towards camera */
  systemSpeed?: number;
  /** External reset trigger to restart the tunnel from the beginning */
  resetSignal?: number;
}

export default function CloudTunnel({
  isActive = true,
  systemSpeed = 80,
  resetSignal = 0,
}: CloudTunnelProps) {
  const smokeTexture = useTexture("/smoke.png");
  const lensFlareTexture = useTexture("/lensflare.png");

  const glowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0, "rgba(255,255,255,1)");
      g.addColorStop(0.2, "rgba(255,255,255,0.5)");
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Refs
  const groupRef = useRef<THREE.Group>(null);
  const systemGroupRef = useRef<THREE.Group>(null); // New wrapper for global forward movement
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const lightRef = useRef<THREE.PointLight>(null);
  const flareRef = useRef<THREE.Group>(null);
  const bgMatRef = useRef<THREE.MeshBasicMaterial>(null); // background sphere
  const smokeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const flare1Ref = useRef<THREE.MeshBasicMaterial>(null);
  const flare2Ref = useRef<THREE.MeshBasicMaterial>(null);

  const warpSpeedRef = useRef(1);
  const expansionRef = useRef(0);
  const isFrozenRef = useRef(false);
  const wasActiveRef = useRef(isActive);

  // More clouds, deeper tunnel
  const CLOUD_COUNT = 300;
  const TUNNEL_DEPTH = 750;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [clouds, setClouds] = useState<any[]>([]);

  const createClouds = useCallback(
    () =>
      Array.from({ length: CLOUD_COUNT }, () => {
        const r = Math.random() * 20 + 5;
        const a = Math.random() * Math.PI * 2;
        return {
          baseX: Math.cos(a) * r,
          baseY: Math.sin(a) * r,
          x: Math.cos(a) * r,
          y: Math.sin(a) * r,
          z: Math.random() * -(TUNNEL_DEPTH + 30),
          rotation: Math.random() * Math.PI * 2,
          scale: Math.random() * 30 + 20,
          speed: Math.random() * 20 + 40,
          expandFactor: Math.random() * 3.0 + 2.0, // Majestic parting effect
        };
      }),
    [],
  );

  useEffect(() => {
    setClouds(createClouds());
  }, [createClouds]);

  useEffect(() => {
    if (systemGroupRef.current) {
      systemGroupRef.current.position.z = 0;
    }
    warpSpeedRef.current = 1;
    expansionRef.current = 0;
    isFrozenRef.current = false;
    setClouds(createClouds());
  }, [resetSignal, createClouds]);

  useEffect(() => {
    const wasActive = wasActiveRef.current;

    if (isActive) {
      isFrozenRef.current = false;

      if (!wasActive) {
        if (systemGroupRef.current) {
          systemGroupRef.current.position.z = 0;
        }
        warpSpeedRef.current = 1;
        expansionRef.current = 0;
        setClouds(createClouds());
      }
    }

    wasActiveRef.current = isActive;
  }, [isActive]);

  useFrame((state, delta) => {
    if (!isActive && isFrozenRef.current) return;

    // Prefer ParallaxCamera base transform when it's active; otherwise use the live camera
    if (groupRef.current) {
      const useBaseCamera =
        state.clock.elapsedTime - baseCameraUpdatedAt.value < 0.1;
      const sourcePosition = useBaseCamera
        ? baseCameraPosition
        : state.camera.position;
      const sourceQuaternion = useBaseCamera
        ? baseCameraQuaternion
        : state.camera.quaternion;

      groupRef.current.position.copy(sourcePosition);
      groupRef.current.quaternion.copy(sourceQuaternion);
    }

    // Move the entire system (clouds + lights) towards the camera globally
    if (systemGroupRef.current) {
      systemGroupRef.current.position.z += systemSpeed * delta;
    }

    const targetFade = isActive ? 1 : 0;

    // Background disappears smoothly to reveal the moon and scene
    const bgFadeSpeed = isActive ? delta * 3 : delta * 2.5;

    // Cloud opacity fades out gracefully
    const cloudFadeSpeed = isActive ? delta * 2 : delta * 1.5;

    // Light source and flares fade smoothly to match the scene behind.
    // Fades out faster when inactive to prevent lingering lens flares.
    const lightFadeSpeed = isActive ? delta * 3 : delta * 4.0;

    // Warp speed & expansion logic for bursting through clouds
    warpSpeedRef.current = THREE.MathUtils.lerp(
      warpSpeedRef.current,
      isActive ? 1 : 5.0, // Smooth, majestic acceleration
      delta * 2,
    );

    expansionRef.current = THREE.MathUtils.lerp(
      expansionRef.current,
      isActive ? 0 : 5.0, // Stronger expansion so clouds majestically "move aside"
      delta * 1.5,
    );

    // White background sphere
    if (bgMatRef.current) {
      bgMatRef.current.opacity = THREE.MathUtils.lerp(
        bgMatRef.current.opacity,
        targetFade,
        bgFadeSpeed,
      );
    }

    // Tunnel elements opacities
    if (smokeMatRef.current) {
      smokeMatRef.current.opacity = THREE.MathUtils.lerp(
        smokeMatRef.current.opacity,
        0.52 * targetFade,
        cloudFadeSpeed,
      );
    }

    // Ramp flare visibility over travel distance. Keep thresholds shallow so short
    // intros (e.g. CaveScene ~1.5s × ~80 speed ≈ z120) still show lens flare—old
    // 30–70% window kept flares at 0 for the entire short tunnel.
    let lightAppearanceFade = 1;
    if (systemGroupRef.current) {
      const traveled = systemGroupRef.current.position.z;
      const threshold1 = TUNNEL_DEPTH * 0.06;
      const threshold2 = TUNNEL_DEPTH * 0.42;
      lightAppearanceFade = THREE.MathUtils.clamp(
        (traveled - threshold1) / (threshold2 - threshold1),
        0,
        1,
      );
    }

    // Multiply target fade by appearance factor so it starts invisible
    const lightTarget = targetFade * lightAppearanceFade;

    if (coreMatRef.current)
      coreMatRef.current.opacity = THREE.MathUtils.lerp(
        coreMatRef.current.opacity,
        0.9 * lightTarget,
        lightFadeSpeed,
      );
    if (haloMatRef.current)
      haloMatRef.current.opacity = THREE.MathUtils.lerp(
        haloMatRef.current.opacity,
        0.7 * lightTarget,
        lightFadeSpeed,
      );
    if (flare1Ref.current)
      flare1Ref.current.opacity = THREE.MathUtils.lerp(
        flare1Ref.current.opacity,
        0.5 * lightTarget,
        lightFadeSpeed,
      );
    if (flare2Ref.current)
      flare2Ref.current.opacity = THREE.MathUtils.lerp(
        flare2Ref.current.opacity,
        0.2 * lightTarget,
        lightFadeSpeed,
      );

    const isFullyHidden =
      !isActive &&
      bgMatRef.current?.opacity !== undefined &&
      smokeMatRef.current?.opacity !== undefined &&
      coreMatRef.current?.opacity !== undefined &&
      haloMatRef.current?.opacity !== undefined &&
      flare1Ref.current?.opacity !== undefined &&
      flare2Ref.current?.opacity !== undefined &&
      bgMatRef.current.opacity < 0.01 &&
      smokeMatRef.current.opacity < 0.01 &&
      coreMatRef.current.opacity < 0.01 &&
      haloMatRef.current.opacity < 0.01 &&
      flare1Ref.current.opacity < 0.01 &&
      flare2Ref.current.opacity < 0.01;

    if (isFullyHidden) {
      isFrozenRef.current = true;
      return;
    }

    // Light pulse fades smoothly
    if (lightRef.current) {
      const pulse = 1500 + Math.sin(state.clock.elapsedTime * 2) * 200;
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity,
        pulse * lightTarget,
        lightFadeSpeed,
      );
    }

    // Flare wobble
    if (flareRef.current) {
      flareRef.current.position.x =
        Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
    }

    // Cloud positions & bursting effect
    if (!meshRef.current) return;
    clouds.forEach((c, i) => {
      // Individual clouds also move locally towards camera
      c.z += c.speed * warpSpeedRef.current * delta;

      // Bursting effect: expand outward when isActive is false
      if (expansionRef.current > 0.01) {
        c.x += c.x * c.expandFactor * expansionRef.current * delta;
        c.y += c.y * c.expandFactor * expansionRef.current * delta;
      } else if (isActive) {
        // Return to tunnel shape smoothly if re-entering
        c.x = THREE.MathUtils.lerp(c.x, c.baseX, delta * 3);
        c.y = THREE.MathUtils.lerp(c.y, c.baseY, delta * 3);
      }

      // Recycle clouds that pass the camera (relative to the moving systemGroup)
      // Since system is moving +Z, we need to ensure clouds recycle properly
      // We check world Z relative to camera
      const worldZ =
        c.z + (systemGroupRef.current ? systemGroupRef.current.position.z : 0);

      if (worldZ > 40) {
        // Reset cloud way back behind the light source
        c.z =
          -(TUNNEL_DEPTH + 300) -
          (systemGroupRef.current ? systemGroupRef.current.position.z : 0);
        c.rotation = Math.random() * Math.PI * 2;

        // Reset base positions
        const r = Math.random() * 20 + 5;
        const a = Math.random() * Math.PI * 2;
        c.baseX = Math.cos(a) * r;
        c.baseY = Math.sin(a) * r;

        // If tunnel is active, snap to base position immediately
        if (isActive) {
          c.x = c.baseX;
          c.y = c.baseY;
        }
      }

      c.rotation += delta * 0.1;
      dummy.position.set(c.x, c.y, c.z);
      dummy.rotation.z = c.rotation;
      dummy.scale.setScalar(c.scale);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <group ref={groupRef}>
      {/*
       * Bright fog sphere — camera-locked (slightly off-white so smoke/flares read).
       * RenderOrder 100 + depthTest=false forces it to completely block the 3D scene.
       */}
      <mesh renderOrder={100}>
        <sphereGeometry args={[900, 32, 16]} />
        <meshBasicMaterial
          ref={bgMatRef}
          color="#cfd8e8"
          side={THREE.BackSide}
          transparent
          opacity={1}
          depthTest={false}
          depthWrite={false}
          fog={false}
        />
      </mesh>

      {/*
       * This wrapper group moves the entire cloud ocean AND the light source
       * towards the camera together.
       */}
      <group ref={systemGroupRef}>
        <pointLight
          ref={lightRef}
          position={[0, 0, -TUNNEL_DEPTH + 10]}
          intensity={0}
          color="#ffffff"
          distance={800}
          decay={1.5}
        />

        {/* Core glow */}
        <mesh position={[0, 0, -TUNNEL_DEPTH]} renderOrder={106}>
          <planeGeometry args={[25, 25]} />
          <meshBasicMaterial
            ref={coreMatRef}
            map={glowTexture}
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            fog={false}
          />
        </mesh>

        {/* Halo */}
        <mesh position={[0, 0, -TUNNEL_DEPTH - 5]} renderOrder={106}>
          <planeGeometry args={[150, 150]} />
          <meshBasicMaterial
            ref={haloMatRef}
            map={glowTexture}
            color="#ffffff"
            transparent
            opacity={0}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            depthTest={false}
            fog={false}
          />
        </mesh>

        {/* Lens flares */}
        <group ref={flareRef}>
          <mesh position={[0, 0, -TUNNEL_DEPTH + 50]} renderOrder={107}>
            <planeGeometry args={[80, 80]} />
            <meshBasicMaterial
              ref={flare1Ref}
              map={lensFlareTexture}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
              fog={false}
            />
          </mesh>
          <mesh
            position={[0, 0, -TUNNEL_DEPTH + 80]}
            scale={0.6}
            renderOrder={107}
          >
            <planeGeometry args={[40, 40]} />
            <meshBasicMaterial
              ref={flare2Ref}
              map={lensFlareTexture}
              transparent
              opacity={0}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
              fog={false}
            />
          </mesh>
        </group>

        {/* Cloud tunnel (instanced) */}
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, CLOUD_COUNT]}
          renderOrder={105}
          frustumCulled={false}
        >
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={smokeMatRef}
            map={smokeTexture}
            transparent
            opacity={0}
            depthWrite={false}
            depthTest={false}
            blending={THREE.NormalBlending}
            color="#ffffff"
            fog={false}
          />
        </instancedMesh>
      </group>
    </group>
  );
}
