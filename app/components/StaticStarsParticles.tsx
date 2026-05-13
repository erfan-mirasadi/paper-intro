"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import * as random from "maath/random";

interface CustomShader {
  uniforms: {
    uTime: { value: number };
    [key: string]: unknown;
  };
  vertexShader: string;
  fragmentShader: string;
}

export default function StaticStarsParticles() {
  const count = 200;

  // Spread - keep center dense
  const SPREAD_X = 1500;
  const SPREAD_Z = 8000;

  // Height
  const HEIGHT_MIN = 2;
  const HEIGHT_MAX = 350;

  // We MUST increase the size dramatically so the shader has a "canvas" to draw the glow!
  const STAR_SIZE = 80.0;
  // =====================

  const materialRef = useRef<THREE.PointsMaterial>(null!);

  // Added a third array for random values to make each firefly blink independently
  const [positions, colors, randoms] = useMemo(() => {
    // Use a seeded generator to satisfy React 19 purity rules
    const gen = new random.Generator(42);

    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const rand = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // X: spread across horizontal center
      const x = (gen.value() - 0.5) * SPREAD_X;

      // Y: below the clouds, random spread
      const y = gen.value() * (HEIGHT_MAX - HEIGHT_MIN) + HEIGHT_MIN;

      // Z: depth of the scene
      const z = (gen.value() - 0.5) * SPREAD_Z;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Generate a random seed for each particle
      rand[i] = gen.value();

      // Color: 50% firefly (golden), 50% star (white/blue)
      const isFirefly = gen.value() > 0.5;

      if (isFirefly) {
        // Firefly (Golden/Yellow)
        col[i * 3] = 0.9 + gen.value() * 0.1; // R
        col[i * 3 + 1] = 0.7 + gen.value() * 0.2; // G
        col[i * 3 + 2] = 0.1 + gen.value() * 0.2; // B
      } else {
        // Star (Blue/White)
        const isBlue = gen.value() > 0.8;
        col[i * 3] = isBlue ? 0.6 + gen.value() * 0.4 : 0.8 + gen.value() * 0.2; // R
        col[i * 3 + 1] = isBlue
          ? 0.8 + gen.value() * 0.2
          : 0.8 + gen.value() * 0.2; // G
        col[i * 3 + 2] = 1.0; // B
      }
    }

    return [pos, col, rand];
  }, []);

  // Update the time uniform on every frame for the pulsing effect
  useFrame((state) => {
    const material = materialRef.current;
    if (material) {
      const shader = (material.userData as { shader?: CustomShader }).shader;
      if (shader) {
        shader.uniforms.uTime.value = state.clock.elapsedTime;
      }
    }
  });

  return (
    <points renderOrder={1}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        {/* Pass the random seeds to the geometry */}
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={STAR_SIZE}
        sizeAttenuation={true}
        vertexColors
        transparent
        opacity={1.0} // Kept full since shader handles the fading
        depthWrite={false}
        depthTest={true} // Explicitly tell the material to respect the depth of objects in front of it
        blending={THREE.AdditiveBlending}
        fog={true}
        onBeforeCompile={(shader) => {
          // Initialize uniforms and store shader reference
          shader.uniforms.uTime = { value: 0 };
          materialRef.current.userData.shader = shader;

          // Inject custom attributes and varyings into Vertex Shader
          shader.vertexShader = `
            uniform float uTime;
            attribute float aRandom;
            varying float vRandom;
            ${shader.vertexShader}
          `
            .replace(
              "void main() {",
              `
              void main() {
                // Pass random seed to Fragment Shader
                vRandom = aRandom;
              `,
            )
            .replace(
              "#include <begin_vertex>",
              `
              #include <begin_vertex>

              // 1. Organic chaotic 3D Floating (X, Y, Z axes)
              // Using different frequencies and amplitudes for a highly randomized feel
              float floatX = sin(uTime * 2.1 + aRandom * 143.0) * (20.0 + aRandom * 35.0);
              float floatY = cos(uTime * 1.8 + aRandom * 85.0)  * (25.0 + aRandom * 40.0);
              float floatZ = sin(uTime * 1.5 + aRandom * 200.0) * (15.0 + aRandom * 30.0);

              transformed.x += floatX;
              transformed.y += floatY;

              // 2. Fast movement towards the camera (+Z axis)
              // Increased speed dramatically for the rushing effect
              float forwardSpeed = 200.0 + (aRandom * 300.0); 
              
              // 3. Wrap-around logic to keep particles within the SPREAD_Z boundaries
              // SPREAD_Z is 8000.0. We divide by 2.0 to handle the -4000 to 4000 range perfectly.
              float spreadZ = 8000.0;
              float halfSpreadZ = spreadZ / 2.0;
              
              // Calculate new Z position: base + floating + forward movement
              float currentZ = position.z + floatZ + (uTime * forwardSpeed);
              
              // Wrap around Z axis so they infinitely come towards the screen
              transformed.z = mod(currentZ + halfSpreadZ, spreadZ) - halfSpreadZ;
              `,
            );

          // Inject custom logic into Fragment Shader
          shader.fragmentShader = `
            uniform float uTime;
            varying float vRandom;
            ${shader.fragmentShader}
          `
            .replace(
              "void main() {",
              `
              void main() {
                // Hide particles from the reflection camera (under the water)
                if (cameraPosition.y < 0.0) discard;
              `,
            )
            // Changed the replacement hook to be 100% reliable across modern Three.js versions
            .replace(
              "#include <opaque_fragment>",
              `
              #include <opaque_fragment>
              
              // Distance from the center of the particle (0.0 to 0.5)
              vec2 centerPos = gl_PointCoord - vec2(0.5);
              float dist = length(centerPos);
              
              // 1. Optical Glow Formula: Creates a very realistic, smooth light falloff
              float strength = 0.05 / dist - 0.1;
              
              // 2. Firefly Pulsing Effect: Use sine wave combined with time and random offset
              float flicker = sin(uTime * 3.0 + vRandom * 100.0) * 0.5 + 0.5;
              
              // Keep a minimum brightness so they don't completely vanish
              flicker = mix(0.3, 1.0, flicker);
              
              // 3. Final blend
              float finalAlpha = strength * flicker;
              
              // Clamp to avoid visual artifacts with AdditiveBlending
              finalAlpha = clamp(finalAlpha, 0.0, 1.0);
              
              // Apply the custom glow and fade out the edges
              gl_FragColor = vec4(gl_FragColor.rgb, gl_FragColor.a * finalAlpha);
              `,
            );
        }}
      />
    </points>
  );
}
