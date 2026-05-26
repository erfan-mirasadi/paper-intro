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

export default function CaveParticles({ active = true }: { active?: boolean }) {
  const count = 300; // slightly more for cave dust

  // Spread - keep center dense
  const SPREAD_X = 1500;
  const SPREAD_Z = 8000;

  // Height
  const HEIGHT_MIN = 2;
  const HEIGHT_MAX = 350;

  const PARTICLE_SIZE = 7.0; // reduced from 15.0

  const materialRef = useRef<THREE.PointsMaterial>(null!);

  const [positions, colors, randoms] = useMemo(() => {
    // Use a seeded generator to satisfy React 19 purity rules
    const gen = new random.Generator(42);

    const pos = new Float32Array(count * 3);
    const col = new Float32Array(count * 3);
    const rand = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // X: spread across horizontal center
      const x = (gen.value() - 0.5) * SPREAD_X;

      // Y: random spread
      const y = gen.value() * (HEIGHT_MAX - HEIGHT_MIN) + HEIGHT_MIN;

      // Z: depth of the scene
      const z = (gen.value() - 0.5) * SPREAD_Z;

      pos[i * 3] = x;
      pos[i * 3 + 1] = y;
      pos[i * 3 + 2] = z;

      // Generate a random seed for each particle
      rand[i] = gen.value();

      // Color: exactly #73472e -> rgb(115, 71, 46)
      col[i * 3] = 115 / 255;
      col[i * 3 + 1] = 71 / 255;
      col[i * 3 + 2] = 46 / 255;
    }

    return [pos, col, rand];
  }, []);

  const opacityRef = useRef(0);
  const activeTimerRef = useRef(0);

  // Update the time uniform on every frame for the pulsing effect
  useFrame((state, delta) => {
    const material = materialRef.current;
    if (material) {
      // Smooth fade in over 2 seconds when active, with a 2 second delay
      if (active) {
        activeTimerRef.current += delta;
        if (activeTimerRef.current > 2.0 && opacityRef.current < 1) {
          opacityRef.current = Math.min(1, opacityRef.current + delta * 0.5);
        }
      } else {
        activeTimerRef.current = 0;
        if (opacityRef.current > 0) {
          opacityRef.current = Math.max(0, opacityRef.current - delta * 1.0); // smooth fade out instead of instant hide
        }
      }

      material.opacity = opacityRef.current;

      const shader = (material.userData as { shader?: CustomShader }).shader;
      if (shader) {
        shader.uniforms.uTime.value = state.clock.elapsedTime;
      }
    }
  });

  return (
    <points renderOrder={1} rotation={[-2.589, -1.396, -2.596]}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        {/* Pass the random seeds to the geometry */}
        <bufferAttribute attach="attributes-aRandom" args={[randoms, 1]} />
      </bufferGeometry>
      <pointsMaterial
        ref={materialRef}
        size={PARTICLE_SIZE}
        sizeAttenuation={true}
        vertexColors
        transparent
        opacity={0} // starts hidden, fades in via useFrame
        depthWrite={false}
        depthTest={true} // Explicitly tell the material to respect the depth of objects in front of it
        blending={THREE.NormalBlending} // changed from AdditiveBlending for opaque sand
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
          `.replace(
            "#include <opaque_fragment>",
            `
              #include <opaque_fragment>
              
              // Distance from the center of the particle (0.0 to 0.5)
              vec2 centerPos = gl_PointCoord - vec2(0.5);
              float dist = length(centerPos);
              
              if (dist > 0.5) discard;
              
              // Harder edge for solid sand look
              float alpha = smoothstep(0.5, 0.45, dist);
              
              // 2. Pulsing Effect: Use sine wave combined with time and random offset
              float flicker = sin(uTime * 3.0 + vRandom * 100.0) * 0.5 + 0.5;
              
              // Keep a minimum brightness
              flicker = mix(0.7, 1.0, flicker);
              
              // Apply flicker to brightness instead of transparency, so they stay solid!
              vec3 finalColor = gl_FragColor.rgb * flicker;
              
              // Apply the custom shape and fade out the edges
              gl_FragColor = vec4(finalColor, gl_FragColor.a * alpha);
              `,
          );
        }}
      />
    </points>
  );
}
