"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Sparkles } from "@react-three/drei";
import * as THREE from "three";

export default function DesertDust() {
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    if (materialRef.current) {
      materialRef.current.uniforms.uTime.value = state.clock.elapsedTime;
    }
  });

  return (
    <group>
      {/* 
        1. Ambient Floating Dust Motes: 
        Extremely lightweight (only 300 particles) using GPU-instanced Sparkles. 
        Provides realistic, soft dust drifting naturally in the air. 
      */}
      <Sparkles
        count={200}
        scale={[300, 100, 300]}
        size={55}
        speed={0.9}
        opacity={0.9}
        color="#d4b895"
        noise={10}
        position={[0, 0, -100]}
      />

      {/* 
        2. Distant Sandstorm Horizon: 
        A single procedural shader mesh. This is practically free for performance 
        (1 draw call, 0 particles) and creates a breathtaking volumetric blowing sand 
        effect at the far edges of the scene to hide the boundaries naturally. 
      */}
      {/* <mesh position={[0, 100, 100]}>
        <cylinderGeometry args={[220, 220, 150, 64, 1, true]} />
        <shaderMaterial
          ref={materialRef}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          uniforms={{
            uTime: { value: 0 },
            uColor: { value: new THREE.Color("#c0a382") },
          }}
          vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * viewMatrix * modelMatrix * vec4(position, 1.0);
            }
          `}
          fragmentShader={`
            uniform float uTime;
            uniform vec3 uColor;
            varying vec2 vUv;

            // Fast 2D random function
            float random(vec2 st) {
                return fract(sin(dot(st.xy, vec2(12.9898,78.233))) * 43758.5453123);
            }

            // 2D Noise
            float noise(vec2 st) {
                vec2 i = floor(st);
                vec2 f = fract(st);
                float a = random(i);
                float b = random(i + vec2(1.0, 0.0));
                float c = random(i + vec2(0.0, 1.0));
                float d = random(i + vec2(1.0, 1.0));
                vec2 u = f * f * (3.0 - 2.0 * f);
                return mix(a, b, u.x) + (c - a)* u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
            }

            // Fractal Brownian Motion for realistic fluffy dust/clouds
            float fbm(vec2 st) {
                float value = 0.0;
                float amplitude = 0.5;
                vec2 shift = vec2(100.0);
                for (int i = 0; i < 4; i++) {
                    value += amplitude * noise(st);
                    st = st * 2.0 + shift;
                    amplitude *= 0.5;
                }
                return value;
            }

            void main() {
              // Create blowing wind effect horizontally across the cylinder
              vec2 st = vUv * vec2(12.0, 3.0); 
              st.x += uTime * 0.08; // Fast horizontal wind
              st.y += sin(uTime * 0.05) * 0.2; // Slight vertical shifting
              
              // Base dust cloud noise
              float n = fbm(st);
              
              // Smooth and boost the noise to look like thick, blowing sand banks
              n = smoothstep(0.2, 0.7, n);

              // Fade out the cylinder smoothly at the top and bottom edges
              // so it completely blends with the sky/ground and isn't a harsh shape
              float verticalFade = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.6, vUv.y);
              
              // Gradient: thicker sand at the bottom, thinning out at the top
              float heightGradient = smoothstep(1.0, 0.0, vUv.y);
              
              float alpha = n * verticalFade * heightGradient * 0.9;
              
              gl_FragColor = vec4(uColor, alpha);
            }
          `}
        />
      </mesh> */}
    </group>
  );
}
