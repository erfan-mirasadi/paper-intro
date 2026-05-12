"use client";

import { useRef, useMemo } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export default function CloudTunnel({ isActive = true }) {
  // --- 1. Texture Loading ---
  // Load Kenny smoke texture
  const smokeTexture = useTexture("/smoke.png");

  // Load lens flare texture
  const lensFlareTexture = useTexture("/lensflare.png");

  // Generate glow texture procedurally
  const glowTexture = useMemo(() => {
    const canvas = document.createElement("canvas");
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext("2d");

    // ESLint fix: check if context is not null
    if (context) {
      const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
      gradient.addColorStop(0, "rgba(255, 255, 255, 1)");
      gradient.addColorStop(0.2, "rgba(255, 255, 255, 0.5)");
      gradient.addColorStop(1, "rgba(255, 255, 255, 0)");
      context.fillStyle = gradient;
      context.fillRect(0, 0, 64, 64);
    }
    return new THREE.CanvasTexture(canvas);
  }, []);

  // --- Refs for animation and elements ---
  // ESLint fix: initialize useRef with null
  const groupRef = useRef(null);
  const innerGroupRef = useRef(null); // Added for local Z animation
  const meshRef = useRef(null);
  const centralLightRef = useRef(null);
  const flareRef = useRef(null);

  // Material refs to control opacity dynamically without GSAP
  // ESLint fix: initialize useRef with null
  const smokeMatRef = useRef(null);
  const coreMatRef = useRef(null);
  const haloMatRef = useRef(null);
  const flare1MatRef = useRef(null);
  const flare2MatRef = useRef(null);

  const { viewport } = useThree();
  const cloudCount = 180;
  const tunnelDepth = 300;

  // --- 2. Cloud Data Preparation ---
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const cloudsData = useMemo(() => {
    const data = [];
    for (let i = 0; i < cloudCount; i++) {
      const radius = Math.random() * 12 + 6;
      const angle = Math.random() * Math.PI * 2;

      data.push({
        x: Math.cos(angle) * radius,
        y: Math.sin(angle) * radius,
        z: Math.random() * -tunnelDepth,
        rotation: Math.random() * Math.PI * 2,
        scale: Math.random() * 20 + 20,
        speed: Math.random() * 10 + 25,
      });
    }
    return data;
  }, [cloudCount]);

  // --- 3. Animation Loop ---
  useFrame((state, delta) => {
    // Lock the main group to the camera position and rotation
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
      groupRef.current.quaternion.copy(state.camera.quaternion);
    }

    // Smooth transition logic based on isActive prop
    // Target position pushes the tunnel towards the camera massively
    // 350 ensures the core (at -300) passes completely through the camera (+50 past it)
    const targetZ = isActive ? 250 : 0;
    // Target fade multiplier
    const targetFade = isActive ? 1 : 0;

    // Smoothly animate the inner group position Z
    if (innerGroupRef.current) {
      innerGroupRef.current.position.z = THREE.MathUtils.lerp(
        innerGroupRef.current.position.z,
        targetZ,
        delta * 1.5, // Animation speed for position
      );
    }

    // Smoothly animate opacities for Fade In / Fade Out effect
    if (smokeMatRef.current) {
      smokeMatRef.current.opacity = THREE.MathUtils.lerp(
        smokeMatRef.current.opacity,
        0.4 * targetFade,
        delta * 2,
      );
    }
    if (coreMatRef.current) {
      coreMatRef.current.opacity = THREE.MathUtils.lerp(
        coreMatRef.current.opacity,
        0.9 * targetFade,
        delta * 2,
      );
    }
    if (haloMatRef.current) {
      haloMatRef.current.opacity = THREE.MathUtils.lerp(
        haloMatRef.current.opacity,
        0.7 * targetFade,
        delta * 2,
      );
    }
    if (flare1MatRef.current) {
      flare1MatRef.current.opacity = THREE.MathUtils.lerp(
        flare1MatRef.current.opacity,
        0.4 * targetFade,
        delta * 2,
      );
    }
    if (flare2MatRef.current) {
      flare2MatRef.current.opacity = THREE.MathUtils.lerp(
        flare2MatRef.current.opacity,
        0.15 * targetFade,
        delta * 2,
      );
    }

    if (!meshRef.current) return;

    // A) Cloud animation
    cloudsData.forEach((cloud, i) => {
      cloud.z += cloud.speed * delta;

      if (cloud.z > 20) {
        cloud.z = -tunnelDepth;
        cloud.rotation = Math.random() * Math.PI * 2;
      }
      cloud.rotation += delta * 0.1;

      dummy.position.set(cloud.x, cloud.y, cloud.z);
      dummy.rotation.z = cloud.rotation;
      dummy.scale.set(cloud.scale, cloud.scale, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;

    // B) Central light intensity pulse
    if (centralLightRef.current) {
      // Modulate light intensity with fade out as well
      const pulse = 1500 + Math.sin(state.clock.elapsedTime * 2) * 200;
      centralLightRef.current.intensity = THREE.MathUtils.lerp(
        centralLightRef.current.intensity,
        pulse * targetFade,
        delta * 2,
      );
    }

    // C) Lens flare wobble
    if (flareRef.current) {
      const wobble = Math.sin(state.clock.elapsedTime * 0.5) * 0.02;
      flareRef.current.position.x = wobble;
    }
  });

  return (
    <group ref={groupRef}>
      <group ref={innerGroupRef}>
        {/* Dynamic Central Light */}
        <pointLight
          ref={centralLightRef}
          position={[0, 0, -tunnelDepth + 10]}
          intensity={0} // Starts at 0, smoothly lerps up
          color="#ffffff"
          distance={400}
          decay={1.5}
        />

        {/* --- The Core --- */}
        <mesh position={[0, 0, -tunnelDepth]}>
          <planeGeometry args={[15, 15]} />
          <meshBasicMaterial
            ref={coreMatRef}
            map={glowTexture}
            color="#ffffff"
            transparent={true}
            opacity={0} // Controlled by lerp
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* --- Glow Halo --- */}
        <mesh position={[0, 0, -tunnelDepth - 5]}>
          <planeGeometry args={[100, 100]} />
          <meshBasicMaterial
            ref={haloMatRef}
            map={glowTexture}
            color="#ffffff"
            transparent={true}
            opacity={0} // Controlled by lerp
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </mesh>

        {/* --- Lens Flares --- */}
        <group ref={flareRef} position={[0, 0, 0]}>
          <mesh position={[0, 0, -tunnelDepth + 50]}>
            <planeGeometry args={[50, 50]} />
            <meshBasicMaterial
              ref={flare1MatRef}
              map={lensFlareTexture}
              transparent={true}
              opacity={0} // Controlled by lerp
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>

          <mesh position={[0, 0, -tunnelDepth + 150]} scale={0.5}>
            <planeGeometry args={[20, 20]} />
            <meshBasicMaterial
              ref={flare2MatRef}
              map={lensFlareTexture}
              transparent={true}
              opacity={0} // Controlled by lerp
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        </group>

        {/* --- Instanced Cloud Tunnel --- */}
        <instancedMesh ref={meshRef} args={[null, null, cloudCount]}>
          <planeGeometry args={[1, 1]} />
          <meshBasicMaterial
            ref={smokeMatRef}
            map={smokeTexture}
            transparent={true}
            opacity={0} // Controlled by lerp
            depthWrite={false}
            blending={THREE.NormalBlending}
            color="#eeeeee"
          />
        </instancedMesh>
      </group>
    </group>
  );
}
