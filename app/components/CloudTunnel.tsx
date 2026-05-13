"use client";

import { useRef, useMemo, useState, useEffect } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface CloudTunnelProps {
  /** true = tunnel fades in, false = tunnel fades out */
  isActive?: boolean;
  /** Speed at which the entire system (clouds + lights) moves towards camera */
  systemSpeed?: number;
}

export default function CloudTunnel({
  isActive = true,
  systemSpeed = 80,
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

  // More clouds, deeper tunnel
  const CLOUD_COUNT = 300;
  const TUNNEL_DEPTH = 750;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const [clouds, setClouds] = useState<any[]>([]);

  useEffect(() => {
    setClouds(
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
    );
  }, []);

  useFrame((state, delta) => {
    // Lock master group to camera
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
      groupRef.current.quaternion.copy(state.camera.quaternion);
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
        0.45 * targetFade,
        cloudFadeSpeed,
      );
    }

    // Calculate light appearance based on distance traveled
    let lightAppearanceFade = 1;
    if (systemGroupRef.current) {
      const traveled = systemGroupRef.current.position.z;
      // Start appearing at 30% of the tunnel depth, fully appeared at 70%
      const threshold1 = TUNNEL_DEPTH * 0.3;
      const threshold2 = TUNNEL_DEPTH * 0.7;
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
       * White background sphere — camera-locked.
       * RenderOrder 100 + depthTest=false forces it to completely block the 3D scene.
       */}
      <mesh renderOrder={100}>
        <sphereGeometry args={[900, 32, 16]} />
        <meshBasicMaterial
          ref={bgMatRef}
          color="#ffffff"
          side={THREE.BackSide}
          transparent
          opacity={1}
          depthTest={false}
          depthWrite={false}
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
            />
          </mesh>
        </group>

        {/* Cloud tunnel (instanced) */}
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, CLOUD_COUNT]}
          renderOrder={105}
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
          />
        </instancedMesh>
      </group>
    </group>
  );
}
