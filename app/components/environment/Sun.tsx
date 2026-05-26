"use client";

import { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";
import { Billboard } from "@react-three/drei";

export default function Sun({
  position = [0, 0, -1],
  rotation = [0, 0, 0],
  scale = 1,
  progressRef,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  progressRef?: React.MutableRefObject<number>;
}) {
  const dirLightRef = useRef<THREE.DirectionalLight>(null);
  const pointLightRef = useRef<THREE.PointLight>(null);
  const materialRef = useRef<THREE.ShaderMaterial>(null);

  const sunUniforms = useMemo(
    () => ({
      uProgress: { value: 0 },
    }),
    [],
  );

  // Day colors for lights
  const dayDirColor = useMemo(() => new THREE.Color("#ffaa66"), []);
  const dayPointColor = useMemo(() => new THREE.Color("#ff7722"), []);

  // Sunset colors for lights (Deep red/orange)
  const sunsetDirColor = useMemo(() => new THREE.Color("#ff3300"), []);
  const sunsetPointColor = useMemo(() => new THREE.Color("#aa1100"), []);

  useFrame(() => {
    if (progressRef && progressRef.current !== undefined) {
      const p = progressRef.current;

      if (materialRef.current) {
        materialRef.current.uniforms.uProgress.value = p;
      }
      if (dirLightRef.current) {
        dirLightRef.current.color.lerpColors(dayDirColor, sunsetDirColor, p);
        dirLightRef.current.intensity = THREE.MathUtils.lerp(3.5, 1.0, p);
      }
      if (pointLightRef.current) {
        pointLightRef.current.color.lerpColors(
          dayPointColor,
          sunsetPointColor,
          p,
        );
        pointLightRef.current.intensity = THREE.MathUtils.lerp(2.5, 0.5, p);
      }
    }
  });
  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Sunlight */}
      <directionalLight
        ref={dirLightRef}
        intensity={3.5}
        color="#ffaa66"
        position={[0, 0, 0]}
        castShadow
      />
      <pointLight
        ref={pointLightRef}
        intensity={2.5}
        color="#ff7722"
        distance={400}
        decay={2}
      />

      {/* Desert Sun with massive dusty atmospheric glow */}
      {/* We use a simple static plane just like the Moon. Since the parent skybox
          copies the camera's position, the camera can never walk past the sun. */}
      <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
        <mesh renderOrder={-1} frustumCulled={false}>
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={materialRef}
            transparent={true}
            depthWrite={false}
            depthTest={true}
            blending={THREE.AdditiveBlending}
            toneMapped={false}
            fog={false}
            uniforms={sunUniforms}
            vertexShader={`
            varying vec2 vUv;
            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `}
            fragmentShader={`
            uniform float uProgress;
            varying vec2 vUv;
            void main() {
              // Multiply by 3.0 to compensate for the 3x larger plane geometry.
              // This gives us a massive invisible canvas so the soft glow doesn't get clipped by the mountains!
              float dist = distance(vUv, vec2(0.5)) * 3.0;
              
              // Animate radii so the sun shrinks and halo reduces during sunset
              // User requested daytime to be smaller, but sunset to remain large like the reference
              float currentCore = mix(0.04, 0.08, uProgress);
              float currentInner = mix(0.12, 0.18, uProgress);
              float currentOuter = mix(0.4, 0.6, uProgress);

              // Blinding white-yellow core (now a sharper, larger disc)
              float core = smoothstep(currentCore, currentCore - 0.02, dist);
              
              // Intense yellow tight corona/glare
              float innerGlow = smoothstep(currentInner, 0.0, dist);
              
              // Massive, dusty orange atmospheric scattering
              float outerGlow = smoothstep(currentOuter, 0.0, dist);
              outerGlow = pow(outerGlow, 2.0); // Exponential falloff for realistic light fade
              
              // Day colors
              vec3 dayCoreColor = vec3(1.0, 1.0, 0.95);
              vec3 dayInnerColor = vec3(1.0, 0.6, 0.1);
              vec3 dayOuterColor = vec3(1.0, 0.25, 0.0);
              
              // Sunset colors (Deeper red/orange)
              vec3 sunsetCoreColor = vec3(1.0, 0.9, 0.6);
              vec3 sunsetInnerColor = vec3(1.0, 0.2, 0.0);
              vec3 sunsetOuterColor = vec3(0.5, 0.05, 0.0);

              vec3 coreColor = mix(dayCoreColor, sunsetCoreColor, uProgress);
              vec3 innerColor = mix(dayInnerColor, sunsetInnerColor, uProgress);
              vec3 outerColor = mix(dayOuterColor, sunsetOuterColor, uProgress);
              
              // Additive color mixing
              vec3 color = outerColor * outerGlow;
              color += innerColor * innerGlow;
              color += coreColor * core;
              
              // Alpha calculates the total brightness, limiting it to 1.0
              float alpha = outerGlow * 0.9 + innerGlow * 0.6 + core;
              
              gl_FragColor = vec4(color, clamp(alpha, 0.0, 1.0));
            }
          `}
          />
        </mesh>
      </Billboard>
    </group>
  );
}
