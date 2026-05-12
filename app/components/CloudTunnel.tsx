"use client";

import { useRef, useMemo } from "react";
import { useFrame } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface CloudTunnelProps {
  /** true = tunnel fades in, false = tunnel fades out */
  isActive?: boolean;
}

export default function CloudTunnel({ isActive = true }: CloudTunnelProps) {
  const smokeTexture    = useTexture("/smoke.png");
  const lensFlareTexture = useTexture("/lensflare.png");

  const glowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width  = 64;
    canvas.height = 64;
    const ctx = canvas.getContext("2d");
    if (ctx) {
      const g = ctx.createRadialGradient(32, 32, 0, 32, 32, 32);
      g.addColorStop(0,   "rgba(255,255,255,1)");
      g.addColorStop(0.2, "rgba(255,255,255,0.5)");
      g.addColorStop(1,   "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // Refs
  const groupRef    = useRef<THREE.Group>(null);
  const meshRef     = useRef<THREE.InstancedMesh>(null);
  const lightRef    = useRef<THREE.PointLight>(null);
  const flareRef    = useRef<THREE.Group>(null);
  const bgMatRef    = useRef<THREE.MeshBasicMaterial>(null); // background sphere
  const smokeMatRef = useRef<THREE.MeshBasicMaterial>(null);
  const coreMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const haloMatRef  = useRef<THREE.MeshBasicMaterial>(null);
  const flare1Ref   = useRef<THREE.MeshBasicMaterial>(null);
  const flare2Ref   = useRef<THREE.MeshBasicMaterial>(null);
  
  const warpSpeedRef = useRef(1);
  const expansionRef = useRef(0);

  // More clouds, deeper tunnel
  const CLOUD_COUNT  = 400;
  const TUNNEL_DEPTH = 600;

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const clouds = useMemo(() =>
    Array.from({ length: CLOUD_COUNT }, () => {
      const r = Math.random() * 20 + 5;
      const a = Math.random() * Math.PI * 2;
      return {
        baseX:    Math.cos(a) * r,
        baseY:    Math.sin(a) * r,
        x:        Math.cos(a) * r,
        y:        Math.sin(a) * r,
        z:        Math.random() * -TUNNEL_DEPTH,
        rotation: Math.random() * Math.PI * 2,
        scale:    Math.random() * 30 + 20,
        speed:    Math.random() * 20 + 40,
        expandFactor: Math.random() * 2.5 + 1.5, // Used for bursting effect
      };
    })
  , []);

  useFrame((state, delta) => {
    // Lock group to camera
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
      groupRef.current.quaternion.copy(state.camera.quaternion);
    }

    const targetFade = isActive ? 1 : 0;

    // Cinematic slow fade out for the background to reveal the skybox smoothly
    // Fade in is faster to ensure the screen is covered when tunnel re-enters
    const bgFadeSpeed = isActive ? delta * 3 : delta * 0.8;
    
    // Cloud opacity fades slowly for a smooth transition
    const cloudFadeSpeed = isActive ? delta * 2 : delta * 0.6;

    // Core elements and flares fade out very quickly so they don't linger
    const coreFadeSpeed = isActive ? delta * 2 : delta * 8;

    // Warp speed & expansion logic for bursting through clouds
    warpSpeedRef.current = THREE.MathUtils.lerp(
      warpSpeedRef.current,
      isActive ? 1 : 3.5, // Accelerate when bursting out
      delta * 1.5
    );
    
    expansionRef.current = THREE.MathUtils.lerp(
      expansionRef.current,
      isActive ? 0 : 1, // 0 = standard tunnel, 1 = expanding outward
      delta * 1.2
    );

    // White background sphere
    if (bgMatRef.current) {
      bgMatRef.current.opacity = THREE.MathUtils.lerp(bgMatRef.current.opacity, targetFade, bgFadeSpeed);
    }

    // Tunnel elements opacities
    if (smokeMatRef.current) {
      // Max opacity of clouds is slightly higher for a denser tunnel
      smokeMatRef.current.opacity = THREE.MathUtils.lerp(smokeMatRef.current.opacity, 0.45 * targetFade, cloudFadeSpeed);
    }
      
    if (coreMatRef.current)
      coreMatRef.current.opacity  = THREE.MathUtils.lerp(coreMatRef.current.opacity,  0.9  * targetFade, coreFadeSpeed);
    if (haloMatRef.current)
      haloMatRef.current.opacity  = THREE.MathUtils.lerp(haloMatRef.current.opacity,  0.7  * targetFade, coreFadeSpeed);
    if (flare1Ref.current)
      flare1Ref.current.opacity   = THREE.MathUtils.lerp(flare1Ref.current.opacity,   0.5  * targetFade, coreFadeSpeed);
    if (flare2Ref.current)
      flare2Ref.current.opacity   = THREE.MathUtils.lerp(flare2Ref.current.opacity,   0.2  * targetFade, coreFadeSpeed);

    // Light pulse fades smoothly
    if (lightRef.current) {
      const pulse = 1500 + Math.sin(state.clock.elapsedTime * 2) * 200;
      lightRef.current.intensity = THREE.MathUtils.lerp(
        lightRef.current.intensity, pulse * targetFade, coreFadeSpeed,
      );
    }

    // Flare wobble
    if (flareRef.current)
      flareRef.current.position.x = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;

    // Cloud positions & bursting effect
    if (!meshRef.current) return;
    clouds.forEach((c, i) => {
      // Move clouds towards camera
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

      // Recycle clouds that pass the camera
      if (c.z > 40) {
        c.z = -TUNNEL_DEPTH;
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
       * Provides a pure white void that beautifully fades into the main skybox.
       */}
      <mesh renderOrder={-1}>
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

      <group>
        <pointLight
          ref={lightRef}
          position={[0, 0, -TUNNEL_DEPTH + 10]}
          intensity={0}
          color="#ffffff"
          distance={800}
          decay={1.5}
        />

        {/* Core glow */}
        <mesh position={[0, 0, -TUNNEL_DEPTH]}>
          <planeGeometry args={[25, 25]} />
          <meshBasicMaterial ref={coreMatRef} map={glowTexture} color="#ffffff"
            transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        {/* Halo */}
        <mesh position={[0, 0, -TUNNEL_DEPTH - 5]}>
          <planeGeometry args={[150, 150]} />
          <meshBasicMaterial ref={haloMatRef} map={glowTexture} color="#ffffff"
            transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>

        {/* Lens flares */}
        <group ref={flareRef}>
          <mesh position={[0, 0, -TUNNEL_DEPTH + 50]}>
            <planeGeometry args={[80, 80]} />
            <meshBasicMaterial ref={flare1Ref} map={lensFlareTexture}
              transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
          <mesh position={[0, 0, -TUNNEL_DEPTH + 200]} scale={0.6}>
            <planeGeometry args={[40, 40]} />
            <meshBasicMaterial ref={flare2Ref} map={lensFlareTexture}
              transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
          </mesh>
        </group>

        {/* Cloud tunnel (instanced) */}
        <instancedMesh ref={meshRef} args={[undefined, undefined, CLOUD_COUNT]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial ref={smokeMatRef} map={smokeTexture}
            transparent opacity={0} depthWrite={false}
            blending={THREE.NormalBlending} color="#ffffff" />
        </instancedMesh>
      </group>
    </group>
  );
}
