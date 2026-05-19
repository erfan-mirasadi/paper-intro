"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

interface CenterDustProps {
  opacity?: number;
  speed?: number;
  // Props kept for compatibility, but the tunnel is now infinite and follows the camera automatically
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: [number, number, number] | number;
}

export default function CenterDust({
  opacity = 0.8,
  speed = 4.0,
}: CenterDustProps) {
  const groupRef = useRef<THREE.Group>(null);
  
  const mat1 = useRef<THREE.ShaderMaterial>(null);
  const mat2 = useRef<THREE.ShaderMaterial>(null);
  const mat3 = useRef<THREE.ShaderMaterial>(null);

  useFrame((state) => {
    const time = state.clock.elapsedTime;
    
    // Update all 3 layers
    if (mat1.current) {
      mat1.current.uniforms.uTime.value = time;
      mat1.current.uniforms.uOpacity.value = opacity;
      mat1.current.uniforms.uSpeed.value = speed;
    }
    if (mat2.current) {
      mat2.current.uniforms.uTime.value = time;
      mat2.current.uniforms.uOpacity.value = opacity;
      mat2.current.uniforms.uSpeed.value = speed;
    }
    if (mat3.current) {
      mat3.current.uniforms.uTime.value = time;
      mat3.current.uniforms.uOpacity.value = opacity;
      mat3.current.uniforms.uSpeed.value = speed;
    }
  });

  const vertexShader = `
    varying vec2 vUv;
    varying float vZ;
    
    void main() {
      vUv = uv;
      vec4 mvPosition = viewMatrix * modelMatrix * vec4(position, 1.0);
      vZ = mvPosition.z;
      gl_Position = projectionMatrix * mvPosition;
    }
  `;

  const fragmentShader = `
    uniform float uTime;
    uniform float uOpacity;
    uniform float uSpeed;
    uniform float uOffset;
    uniform float uNoiseScale;
    
    varying vec2 vUv;
    varying float vZ;

    // Fast 2D random
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

    // FBM
    float fbm(vec2 st) {
        float value = 0.0;
        float amplitude = 0.5;
        vec2 shift = vec2(100.0);
        mat2 rot = mat2(cos(0.5), sin(0.5), -sin(0.5), cos(0.5));
        for (int i = 0; i < 4; i++) {
            value += amplitude * noise(st);
            st = rot * st * 2.0 + shift;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
      // Scale UVs for noise detail
      vec2 st = vUv * vec2(8.0, uNoiseScale);
      
      // Flow along the tunnel (vUv.y is length axis)
      // Positive speed moves the texture towards the camera
      st.y += uTime * uSpeed * 0.15;
      
      // Ambient swirl
      st.x += sin(uTime * 0.05 + uOffset) * 0.3;
      st += uOffset * 20.0; // Separate the layers
      
      // Domain warping for wispy, organic cloud shapes (soft and smokey)
      vec2 q = vec2(0.0);
      q.x = fbm(st + vec2(uTime * 0.03, uTime * 0.02));
      q.y = fbm(st + vec2(5.2, 1.3 - uTime * 0.02));
      
      float n = fbm(st + q * 1.5);
      
      // Smooth out the noise to make completely soft, cloud-like volumes
      float density = smoothstep(0.25, 0.75, n);
      
      // Fade out at the start and end of the cylinder so the geometry is invisible
      float zFade = smoothstep(0.0, 0.1, vUv.y) * smoothstep(1.0, 0.9, vUv.y);
      
      // Prevent hard clipping if the camera gets too close to the cylinder wall
      // vZ is negative. 0 to -15 units in front of the camera fades out.
      float nearFade = smoothstep(0.0, -15.0, vZ);
      
      // Dubai Sand Colors
      vec3 darkSand = vec3(0.56, 0.39, 0.24);
      vec3 midSand = vec3(0.76, 0.60, 0.43);
      vec3 lightSand = vec3(0.91, 0.82, 0.70);
      
      // Beautiful self-shadowed color gradient based on smoke density
      vec3 color = mix(darkSand, midSand, smoothstep(0.0, 0.5, density));
      color = mix(color, lightSand, smoothstep(0.5, 1.0, density));
      
      // Final soft alpha blending
      float alpha = density * zFade * nearFade * uOpacity * 0.6; // Max 60% opacity per layer so they blend
      
      gl_FragColor = vec4(color, alpha);
    }
  `;

  return (
    // Centered deep in the scene, massive static scale so camera never leaves it
    <group ref={groupRef} position={[0, 0, -400]} rotation={[Math.PI / 2, 0, 0]}>
      {/* 
        Massive Concentric Volumetric Cylinders
        frustumCulled={false} prevents sudden disappearance when looking around.
        DoubleSide prevents walls disappearing if the camera somehow crosses them.
      */}
      
      {/* Inner layer */}
      <mesh frustumCulled={false}>
        <cylinderGeometry args={[80, 80, 1500, 32, 1, true]} />
        <shaderMaterial
          ref={mat1}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uSpeed: { value: speed },
            uOffset: { value: 0.0 },
            uNoiseScale: { value: 3.0 },
          }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      
      {/* Middle layer */}
      <mesh frustumCulled={false}>
        <cylinderGeometry args={[140, 140, 1500, 32, 1, true]} />
        <shaderMaterial
          ref={mat2}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uSpeed: { value: speed },
            uOffset: { value: 1.33 },
            uNoiseScale: { value: 4.0 },
          }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
      
      {/* Outer layer */}
      <mesh frustumCulled={false}>
        <cylinderGeometry args={[200, 200, 1500, 32, 1, true]} />
        <shaderMaterial
          ref={mat3}
          transparent
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.NormalBlending}
          uniforms={{
            uTime: { value: 0 },
            uOpacity: { value: opacity },
            uSpeed: { value: speed },
            uOffset: { value: 2.66 },
            uNoiseScale: { value: 5.0 },
          }}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
        />
      </mesh>
    </group>
  );
}
