"use client";

import { Environment, Billboard, useTexture } from "@react-three/drei";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { useMemo, useRef } from "react";

// Centralized configuration for the moon's lighting and glow effects
const MOON_CONFIG = {
  backgroundGlow: {
    scale: 2.8,
    fadeEdge: 0.5, // Outer boundary of the glow
    fadeCenter: 0.0, // Inner brightest part
  },
  foregroundGlare: {
    scale: 2.5, // INCREASED SCALE so the plane is physically larger!
    innerFadeStart: 0.38, // Where the inner corona begins to form
    innerFadeEnd: 0.55, // Peak of the inner corona
    outerFadeStart: 0.68, // Outer boundary of the corona
    outerFadeEnd: 0.31, // Peak of the outer corona
  },
};

// Separated Moon Component
export function Moon() {
  const moonTexture = useTexture("/full-moon.png");

  // Memoizing uniforms so they don't trigger shader recompilations on every render
  const bgGlowUniforms = useMemo(
    () => ({
      uFadeEdge: { value: MOON_CONFIG.backgroundGlow.fadeEdge },
      uFadeCenter: { value: MOON_CONFIG.backgroundGlow.fadeCenter },
    }),
    [],
  );

  const fgGlowUniforms = useMemo(
    () => ({
      // Passed the scale into the shader to normalize the math!
      uScale: { value: MOON_CONFIG.foregroundGlare.scale },
      uInnerFadeStart: { value: MOON_CONFIG.foregroundGlare.innerFadeStart },
      uInnerFadeEnd: { value: MOON_CONFIG.foregroundGlare.innerFadeEnd },
      uOuterFadeStart: { value: MOON_CONFIG.foregroundGlare.outerFadeStart },
      uOuterFadeEnd: { value: MOON_CONFIG.foregroundGlare.outerFadeEnd },
    }),
    [],
  );

  return (
    <Billboard
      follow={true}
      lockX={false}
      lockY={false}
      lockZ={false}
      position={[0, 0.2, -0.91]} // Brought lower towards the horizon
      scale={0.15}
    >
      {/* Background Glow: A large, soft atmospheric halo placed BEHIND the moon */}
      <mesh position={[0, 0, -0.05]} scale={MOON_CONFIG.backgroundGlow.scale}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          transparent={true}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
          uniforms={bgGlowUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uFadeEdge;
            uniform float uFadeCenter;
            varying vec2 vUv;
            void main() {
              float dist = distance(vUv, vec2(0.5));
              // Create a very smooth, expansive glow falloff
              float glow = smoothstep(uFadeEdge, uFadeCenter, dist);
              glow = pow(glow, 1.5);
              // Soft moonlight color (slightly blue/white)
              gl_FragColor = vec4(0.6, 0.75, 1.0, glow * 0.7);
            }
          `}
        />
      </mesh>

      {/* The Actual Moon Texture */}
      <mesh rotation={[0, 0, Math.PI]}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          transparent={true}
          depthWrite={false}
          side={THREE.DoubleSide}
          toneMapped={false}
          fog={false}
          uniforms={{
            uTexture: { value: moonTexture },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform sampler2D uTexture;
            varying vec2 vUv;
            void main() {
              vec4 texColor = texture2D(uTexture, vUv);
              
              float dist = distance(vUv, vec2(0.5));
              
              // Crisper edge: only feathering the very outer rim so we don't lose moon craters
              float edgeAlpha = smoothstep(0.49, 0.46, dist);
              
              // Subtle blend with atmosphere without washing it out completely
              vec3 atmosphereColor = vec3(0.85, 0.90, 0.98);
              vec3 finalColor = mix(texColor.rgb, atmosphereColor, 0.05);
              
              gl_FragColor = vec4(finalColor, texColor.a * edgeAlpha);
            }
          `}
        />
      </mesh>

      {/* Foreground Glare: Math decoupled from scale to allow large halos! */}
      <mesh position={[0, 0, 0.01]} scale={MOON_CONFIG.foregroundGlare.scale}>
        <planeGeometry args={[1, 1]} />
        <shaderMaterial
          transparent={true}
          depthWrite={false}
          depthTest={false}
          blending={THREE.AdditiveBlending}
          toneMapped={false}
          fog={false}
          uniforms={fgGlowUniforms}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uScale;
            uniform float uInnerFadeStart;
            uniform float uInnerFadeEnd;
            uniform float uOuterFadeStart;
            uniform float uOuterFadeEnd;
            
            varying vec2 vUv;
            void main() {
              // MAGIC TRICK: Multiply by uScale so the distance is always relative to the moon's radius (0.5)
              float dist = distance(vUv, vec2(0.5)) * uScale;
              
              // Fade in starting from inside the moon
              float innerFade = smoothstep(uInnerFadeStart, uInnerFadeEnd, dist);
              
              // Fade out smoothly based on your config settings without hitting the square edges
              float outerFade = smoothstep(uOuterFadeStart, uOuterFadeEnd, dist);
              
              // Combine fades for a perfect ring
              float corona = innerFade * outerFade;
              
              gl_FragColor = vec4(0.8, 0.9, 1.0, corona * 0.45); 
            }
          `}
        />
      </mesh>
    </Billboard>
  );
}

export default function Skybox() {
  const skyTexture = useTexture("/night-6.jpg");
  const groupRef = useRef<THREE.Group>(null);

  useFrame((state) => {
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
    }
  });

  return (
    <>
      <Environment
        files="/kloppenheim_02_1k.hdr"
        background={false}
        environmentIntensity={0.4}
      />
      <group ref={groupRef}>
        {/* Grouping both to the same center/origin and reducing scale by half to fix depth precision issues */}
        <group scale={6000}>
          {/* High quality background mesh optimized for front-view only */}
          <mesh
            position={[0, -0.15, 1.6]} // You can change this to move ONLY the sky background
            rotation={[0, Math.PI / 2, 0]}
            scale={[3, 0.8, 1]}
          >
            <sphereGeometry
              args={[1, 16, 16, Math.PI / 2, Math.PI, 0, Math.PI / 2]}
            />
            <meshBasicMaterial
              map={skyTexture}
              side={THREE.BackSide}
              toneMapped={false}
              fog={false}
            />
          </mesh>
          <Moon />
        </group>
      </group>
    </>
  );
}
