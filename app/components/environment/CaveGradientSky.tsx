"use client";

import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useEffect, useMemo, useRef } from "react";
import { useEnvironment } from "@react-three/drei";
import Sun from "./Sun";

// ── Sky Shader ────────────────────────────────────────────────────────
const skyVertexShader = `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const skyFragmentShader = `
varying vec2 vUv;
uniform float uProgress; // 0.0 = Day (Image 1), 1.0 = Sunset (Image 2)
uniform vec3 uDayMid;
uniform vec3 uSunsetMid;

void main() {
    // Colors for Day (Image 1) - Golden Hour
    vec3 dayTop = pow(vec3(0.65, 0.63, 0.61), vec3(2.2));
    vec3 dayMid = uDayMid;
    vec3 dayBot = pow(vec3(0.945, 0.745, 0.545), vec3(2.2)); // #f1be8b

    // Colors for Sunset (Image 2)
    vec3 sunsetTop = pow(vec3(0.12, 0.10, 0.18), vec3(2.2));
    vec3 sunsetMid = uSunsetMid;
    vec3 sunsetBot = pow(vec3(0.50, 0.12, 0.02), vec3(2.2));

    // Interpolate colors based on progress
    vec3 currentTop = mix(dayTop, sunsetTop, uProgress);
    vec3 currentMid = mix(dayMid, sunsetMid, uProgress);
    vec3 currentBot = mix(dayBot, sunsetBot, uProgress);

    // Create the vertical gradient
    // vUv.y is the vertical position on the sphere
    float midPoint = 0.45; 
    
    vec3 skyColor = mix(currentMid, currentTop, smoothstep(midPoint, 0.8, vUv.y));
    skyColor = mix(currentBot, skyColor, smoothstep(0.1, midPoint, vUv.y));

    gl_FragColor = vec4(skyColor, 1.0);
}
`;

interface CaveGradientSkyProps {
  environmentFile?: string;
  skyPosition?: [number, number, number];
  skyRotation?: [number, number, number];
  skyScale?: [number, number, number];
  distance?: number;
  isActive?: boolean;
  isVisible?: boolean;
  isRevealed?: boolean;
}

// ── Scalable Color Configuration ─────────────────────────────────────
// Define your colors here. Both the Sky Shader and the Fog will automatically sync!
const dayMidColor = new THREE.Color("#f1be8b");
const sunsetMidColor = new THREE.Color(0.35, 0.08, 0.05);

// Pre-calculate linear fog colors from the mid-gradient
const dayMidFog = dayMidColor.clone().convertSRGBToLinear();
const sunsetMidFog = sunsetMidColor.clone().convertSRGBToLinear();

export default function CaveGradientSky({
  environmentFile = "/assets/cave/desert-HDR_2k.hdr",
  skyPosition = [0, -0.76, 0],
  skyRotation = [0, -0.5, 0],
  skyScale = [3, 1, 3],
  distance = 1,
  isActive = true,
  isVisible = true,
  isRevealed = false,
}: CaveGradientSkyProps = {}) {
  const envMap = useEnvironment({ files: environmentFile });
  const { scene } = useThree();

  const groupRef = useRef<THREE.Group>(null);
  const skyMaterialRef = useRef<THREE.ShaderMaterial>(null);
  const sunGroupRef = useRef<THREE.Group>(null);

  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  // You can hook this ref up to an external state or Theatre.js sequence later!
  // Start at 1 (Sunset)
  const progressRef = useRef(1.0);

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

  const skyUniforms = useMemo(
    () => ({
      uProgress: { value: 0.0 },
      uDayMid: { value: dayMidFog },
      uSunsetMid: { value: sunsetMidFog },
    }),
    [],
  );

  useFrame((state, delta) => {
    if (!isActiveRef.current) return;

    // Follow camera
    if (groupRef.current) {
      groupRef.current.position.copy(state.camera.position);
    }

    // --- ANIMATION LOGIC ---
    // If revealed, transition to Day (0.0). Otherwise, stay at Sunset (1.0).
    const speed = 0.1;
    if (isRevealed) {
      // Use an internal linear tracker (we'll borrow the object's userData to avoid a new ref for now, or just calculate from a known start)
      // Actually, since progressRef.current is the output, we can't just subtract from it if we want to ease it.
      // Let's use a separate linear progress tracker attached to the groupRef.
      if (groupRef.current) {
        if (groupRef.current.userData.linearProgress === undefined) {
          groupRef.current.userData.linearProgress = 1.0;
        }
        groupRef.current.userData.linearProgress = THREE.MathUtils.clamp(
          groupRef.current.userData.linearProgress - delta * speed,
          0.0,
          1.0
        );
        
        // Apply smoothstep easing to the linear progress
        // smoothstep(0, 1, x) = x^2 * (3 - 2x)
        const lp = groupRef.current.userData.linearProgress;
        progressRef.current = lp * lp * (3.0 - 2.0 * lp);
      }
    } else {
      if (groupRef.current) groupRef.current.userData.linearProgress = 1.0;
      progressRef.current = 1.0;
    }
    // -----------------------

    // Update Sky Shader
    if (skyMaterialRef.current) {
      skyMaterialRef.current.uniforms.uProgress.value = progressRef.current;
    }

    // Update Fog Color to match mid gradient
    if (scene.fog) {
      scene.fog.color.lerpColors(dayMidFog, sunsetMidFog, progressRef.current);
    }

    // Update Sun Position
    // Map progress to Sun Y position (Day = high, Sunset = low)
    if (sunGroupRef.current) {
      // Moved the sun 10x further back (Z=-10000), so we scale the values to match.
      const sunMaxHeight = 2500;
      const sunMinHeight = -1500;

      const currentHeight = THREE.MathUtils.lerp(
        sunMaxHeight,
        sunMinHeight,
        progressRef.current,
      );

      // Update the sun's Y position directly
      sunGroupRef.current.position.y = currentHeight;

      // Optionally adjust sun intensity or scale based on sunset
      // (This accesses the directional and point lights if you want to extend it)
    }
  });

  return (
    <group ref={groupRef} visible={isVisible}>
      <group scale={distance}>
        {/* Sky Gradient Mesh */}
        <mesh
          position={skyPosition}
          rotation={skyRotation}
          scale={skyScale}
          renderOrder={-2}
        >
          <sphereGeometry
            args={[1, 32, 32, Math.PI / 2, Math.PI, 0, Math.PI / 2]}
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

        {/* Desert Sun */}
        {/* We place it in a group we can reference to animate its height */}
        <group rotation={[0, -Math.PI / 2, 0]}>
          {/* Pushed much further back (z=-10000) so it's physically behind the mountains */}
          <group ref={sunGroupRef} position={[0, 450, -10000]}>
            {/* Scaled up to 18000 (10x larger) to ensure the plane geometry is huge. 
                The shader inside Sun.tsx compensates for this so the visual size is the same,
                but it prevents the top edge of the plane from dipping below the mountains too early! */}
            <Sun scale={18000} progressRef={progressRef} />
          </group>
        </group>
      </group>
    </group>
  );
}
