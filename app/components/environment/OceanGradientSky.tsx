"use client";

import { useFrame, useThree, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef, useLayoutEffect } from "react";
import { Moon } from "./Skybox"; // Assuming Moon is exported from your Skybox file
import { useEnvironment } from "@react-three/drei";

// Background Sky Shader (Gradient Only)
const skyVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
varying vec2 vUv;
void main() {
    // Sky is ALWAYS this gradient, regardless of explosion
    vec3 explTopColor = pow(vec3(0.06, 0.09, 0.14), vec3(2.2)); // Darker top for gradient
    vec3 explMidColor = pow(vec3(0.110, 0.149, 0.216), vec3(2.2)); // exact #1c2637
    vec3 explBotColor = pow(vec3(0.15, 0.19, 0.26), vec3(2.2)); // Lighter horizon for gradient

    vec3 skyColor = mix(explMidColor, explTopColor, smoothstep(0.3, 0.7, vUv.y));
    skyColor = mix(explBotColor, skyColor, smoothstep(0.0, 0.25, vUv.y));

    gl_FragColor = vec4(skyColor, 1.0);
}
`;

// Cloud Shader using Texture
const cloudVertexShader = `
varying vec2 vUv;
varying vec3 vLocalPosition;
void main() {
  vUv = uv;
  vec4 localPos = instanceMatrix * vec4(position, 1.0);
  vLocalPosition = localPos.xyz;
  gl_Position = projectionMatrix * viewMatrix * modelMatrix * localPos;
}
`;

const cloudFragmentShader = `
uniform sampler2D uMap;
uniform float uExplosion;
uniform vec3 uGlowColor;
varying vec2 vUv;
varying vec3 vLocalPosition;

void main() {
    vec4 texColor = texture2D(uMap, vUv);
    
    // Background sky color right behind the clouds (Now constant)
    vec3 currentSky = pow(vec3(0.110, 0.149, 0.216), vec3(2.2)); // Convert to Linear
    
    // 1. Remove the "Puffy" feeling by flattening contrast.
    // Mix the original image heavily towards the sky color so it looks like a dark silhouette, matching the reference
    vec3 flatCloud = mix(texColor.rgb, currentSky, 0.6); 
    
    // 2. TRUE VOLUMETRIC LIGHTING FROM VOLCANO
    // The volcano is roughly at X=0, Y=0. We only illuminate clouds that are near it!
    
    // Horizontal fade: Light is strongest directly above volcano (X=0) and fades out to the sides
    float horizontalFade = smoothstep(1.5, 0.0, abs(vLocalPosition.x));
    // Vertical fade: Light is strongest near the volcano and fades out completely for high clouds
    float verticalFade = smoothstep(0.8, 0.1, max(0.0, vLocalPosition.y));
    
    // Combined world-space light falloff from the volcano
    float volcanoLight = horizontalFade * verticalFade;
    
    // Local texture fade: The light hits the bottom of the cloud
    float localBottomFade = 1.0 - smoothstep(0.0, 0.5, vUv.y);
    
    // Organic texture details: Use the cloud's natural brightness to catch light
    float detailMask = texColor.r;
    
    // Final calculated light intensity hitting this specific pixel
    float glowIntensity = volcanoLight * localBottomFade * detailMask * uExplosion;
    
    // Additive illumination! We add the light on top of the dark silhouette
    vec3 finalColor = flatCloud + (uGlowColor * glowIntensity * 1.8);
    
    // 3. Ultra-aggressive edge mask that eats away straight edges from the PNG bounds
    // We want to fade the outer 25% of the texture to ensure it seamlessly blends
    float maskX = smoothstep(0.0, 0.25, vUv.x) * smoothstep(1.0, 0.75, vUv.x);
    float maskY = smoothstep(0.0, 0.3, vUv.y) * smoothstep(1.0, 0.7, vUv.y);
    float edgeMask = maskX * maskY;
    
    // 4. Calculate alpha
    // Make the core of the cloud solid enough to block the bright moon
    float coreAlpha = smoothstep(0.0, 0.6, texColor.a);
    coreAlpha = clamp(coreAlpha * 1.5, 0.0, 1.0);
    
    // Apply the edge mask to ensure all outer bounds fade softly
    float softAlpha = coreAlpha * edgeMask;
    
    // Apply exponential curve for a smoother gradient fade
    softAlpha = pow(softAlpha, 1.2);
    
    // Output final color with standard alpha. 
    // WebGL will naturally blend this over the Moon or the Sky correctly!
    gl_FragColor = vec4(finalColor, softAlpha);
}
`;

interface OceanGradientSkyProps {
  showMoon?: boolean;
  environmentFile?: string;
  skyPosition?: [number, number, number];
  skyRotation?: [number, number, number];
  skyScale?: [number, number, number];
  distance?: number;
  isActive?: boolean;
  isVisible?: boolean;
  startVolcano?: boolean;
  cloudGlowColor?: string;
}

export default function OceanGradientSky({
  showMoon = true,
  environmentFile = "/kloppenheim_02_1k.hdr",
  skyPosition = [0, -0.15, 1.6],
  skyRotation = [0, Math.PI / 2, 0],
  skyScale = [3, 0.8, 1],
  distance = 6000,
  isActive = true,
  isVisible = true,
  startVolcano = false,
  cloudGlowColor = "#ff5522", // Default to a fiery orange/magma to match reference
}: OceanGradientSkyProps = {}) {
  const envMap = useEnvironment({ files: environmentFile });
  const { scene } = useThree();
  const groupRef = useRef<THREE.Group>(null);

  const skyMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const cloudMaterialRef = useRef<THREE.ShaderMaterial>(null);

  const timeSinceExplosion = useRef(0);
  const transitionRef = useRef(0);

  // Load the newly provided cloud.png
  const cloudTexture = useLoader(
    THREE.TextureLoader,
    "/assets/ocean/cloud.png",
  );

  // Fix the "washed out/bright" look by telling WebGL to use correct sRGB colors
  useMemo(() => {
    cloudTexture.colorSpace = THREE.SRGBColorSpace;
    cloudTexture.needsUpdate = true;
  }, [cloudTexture]);

  // Instanced clouds setup: We need 20 clouds now (1 on moon, 19 in upper sky)
  const cloudCount = 20;
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    // Cloud 0: The original thin one exactly on the moon
    dummy.position.set(0, 0.18, -0.89);
    dummy.scale.set(2.5, 0.08, 1);
    dummy.rotation.set(0, 0, -0.01);
    dummy.updateMatrix();
    meshRef.current.setMatrixAt(0, dummy.matrix);

    // Simple deterministic random function for stable layout
    const random = (seed: number) => {
      const x = Math.sin(seed) * 10000;
      return x - Math.floor(x);
    };

    // Clouds 1-19: Massive dark overcast cloud bank at the top of the sky
    // We heavily overlap them to create a continuous volumetric storm feeling
    for (let i = 1; i < cloudCount; i++) {
      const rx = random(i * 10);
      const ry = random(i * 10 + 1);
      const rz = random(i * 10 + 2);
      const rsx = random(i * 10 + 3);
      const rsy = random(i * 10 + 4);
      const rrot = random(i * 10 + 5);

      // Spread widely across X (-2.0 to 2.0)
      const randomX = (rx - 0.5) * 4.0;
      // High up in the sky Y (0.35 to 1.1)
      const randomY = 0.35 + ry * 0.75;
      // Push back slightly to avoid Z-fighting
      const randomZ = -0.85 - rz * 0.05;

      // Make them very large and puffy so they overlap heavily
      const scaleX = (rsx > 0.5 ? 1 : -1) * (1.5 + rsx * 2.5); // 1.5 to 4.0
      const scaleY = 0.4 + rsy * 0.6; // 0.4 to 1.0

      // Natural subtle rotation
      const rotZ = (rrot - 0.5) * 0.15;

      dummy.position.set(randomX, randomY, randomZ);
      dummy.scale.set(scaleX, scaleY, 1);
      dummy.rotation.set(0, 0, rotZ);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [cloudCount]);

  useEffect(() => {
    if (isActive) {
      scene.environment = envMap;
      scene.environmentIntensity = 0.4;
    } else {
      if (scene.environment === envMap) {
        scene.environment = null;
      }
    }
  }, [isActive, envMap, scene]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
    }

    if (startVolcano) {
      timeSinceExplosion.current += delta;
    } else {
      timeSinceExplosion.current = 0;
    }

    // Sky and Clouds change color TOGETHER, 2 seconds AFTER volcano starts
    const target = timeSinceExplosion.current > 2.0 ? 1.0 : 0.0;

    transitionRef.current = THREE.MathUtils.lerp(
      transitionRef.current,
      target,
      delta * 0.8,
    );

    // Sky does NOT change anymore, only clouds glow
    if (cloudMaterialRef.current) {
      cloudMaterialRef.current.uniforms.uExplosion.value =
        transitionRef.current;
    }
  });

  const skyUniforms = useMemo(() => ({}), []);

  const parsedGlowColor = useMemo(() => {
    const color = new THREE.Color(cloudGlowColor);
    return [color.r, color.g, color.b];
  }, [cloudGlowColor]);

  const cloudUniforms = useMemo(
    () => ({
      uMap: { value: cloudTexture },
      uExplosion: { value: 0 },
      uGlowColor: { value: new THREE.Vector3().fromArray(parsedGlowColor) },
    }),
    [cloudTexture, parsedGlowColor],
  );

  return (
    <group ref={groupRef} visible={isVisible}>
      <group scale={distance}>
        {/* Layer 1: Background Gradient Sky (renders behind everything) */}
        <mesh
          position={skyPosition}
          rotation={skyRotation}
          scale={skyScale}
          renderOrder={-3}
        >
          <sphereGeometry
            args={[1, 16, 16, Math.PI / 2, Math.PI, 0, Math.PI / 2]}
          />
          <shaderMaterial
            ref={skyMaterialRef}
            vertexShader={skyVertexShader}
            fragmentShader={skyFragmentShader}
            uniforms={skyUniforms}
            side={THREE.BackSide}
            depthWrite={false}
            toneMapped={false}
            fog={false}
          />
        </mesh>

        {/* Layer 2: Moon (renders over background, under clouds) */}
        {showMoon && (
          <group renderOrder={-2}>
            <Moon />
          </group>
        )}

        {/* Layer 3: The custom Cloud Textures (renders over moon) */}
        {/* Uses InstancedMesh to draw the moon cloud and the higher background clouds */}
        <instancedMesh
          ref={meshRef}
          args={[undefined, undefined, cloudCount]}
          renderOrder={0}
        >
          <planeGeometry args={[1, 1]} />
          <shaderMaterial
            ref={cloudMaterialRef}
            vertexShader={cloudVertexShader}
            fragmentShader={cloudFragmentShader}
            uniforms={cloudUniforms}
            transparent={true}
            depthWrite={false}
            toneMapped={false}
            fog={false}
            side={THREE.DoubleSide} // Needed so flipped clouds (negative scale) don't disappear
          />
        </instancedMesh>
      </group>
    </group>
  );
}
