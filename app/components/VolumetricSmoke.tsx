import { useMemo, useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

const smokeVertexShader = `
  varying vec2 vUv;
  varying float vDistance;
  uniform float time;

  void main() {
    vUv = uv;
    
    // Get the base position of this instance
    vec4 basePosition = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
    
    // Add smooth, slow 3D drifting movement (vertex animation) for zero-cost performance
    // Using the original position as a seed to offset the phase per particle
    float speed = 0.3;
    float driftX = sin(time * speed + basePosition.y * 0.2) * 8.0;
    float driftY = cos(time * speed * 0.8 + basePosition.x * 0.2) * 4.0;
    float driftZ = sin(time * speed * 0.6 + basePosition.z * 0.2) * 8.0;
    
    basePosition.x += driftX;
    basePosition.y += driftY;
    basePosition.z += driftZ;

    // Calculate the center position of the instance in view space
    vec4 mvPosition = viewMatrix * modelMatrix * basePosition;
    
    // Extract the combined scale from model and instance matrices to ensure the billboard is sized correctly
    float worldScaleX = length(vec3(modelMatrix * instanceMatrix * vec4(1.0, 0.0, 0.0, 0.0)));
    float worldScaleY = length(vec3(modelMatrix * instanceMatrix * vec4(0.0, 1.0, 0.0, 0.0)));
    
    // Billboard offset: add the plane position (scaled) directly to the view-space center
    // We also add a tiny rotational wiggle based on time for extra life
    float rotWiggle = sin(time * 0.5 + basePosition.x) * 0.15;
    float cw = cos(rotWiggle);
    float sw = sin(rotWiggle);
    vec2 wiggledPos = vec2(
      position.x * cw - position.y * sw,
      position.x * sw + position.y * cw
    );

    mvPosition.xy += wiggledPos * vec2(worldScaleX, worldScaleY);
    
    gl_Position = projectionMatrix * mvPosition;
    vDistance = -mvPosition.z;
  }
`;

const smokeFragmentShader = `
  varying vec2 vUv;
  varying float vDistance;
  uniform float time;
  uniform vec3 smokeColor;
  uniform float uOpacity;

  float hash(vec2 p) {
    return fract(1e4 * sin(17.0 * p.x + p.y * 0.1) * (0.1 + abs(sin(p.y * 13.0 + p.x))));
  }

  float noise(vec2 x) {
    vec2 i = floor(x);
    vec2 f = fract(x);
    float a = hash(i);
    float b = hash(i + vec2(1.0, 0.0));
    float c = hash(i + vec2(0.0, 1.0));
    float d = hash(i + vec2(1.0, 1.0));
    vec2 u = f * f * (3.0 - 2.0 * f);
    return mix(a, b, u.x) + (c - a) * u.y * (1.0 - u.x) + (d - b) * u.x * u.y;
  }

  void main() {
    float dist = length(vUv - 0.5);
    if (dist > 0.5) discard;
    
    // Sharper edges for a "thicker" look
    float alpha = smoothstep(0.5, 0.1, dist);
    
    // More intense noise pattern for smoke texture (speed slightly increased)
    float n = noise(vUv * 5.0 - time * 0.4);
    float n2 = noise(vUv * 10.0 + time * 0.25);
    alpha *= (n * 0.7 + n2 * 0.3);
    
    // Soften proximity fade - increased range to ensure it doesn't disappear too early
    float cameraFade = smoothstep(2.0, 20.0, vDistance);
    
    // Reduced opacity for a more subtle, natural look
    gl_FragColor = vec4(smokeColor, alpha * cameraFade * 0.15 * uOpacity);
  }
`;

// --- SMOKE CONFIGURATION (Tune these values) ---
const SMOKE_CONFIG = {
  length: 250, // Tool (X-axis spread)
  width: 50, // Arz (Z-axis spread)
  height: 25, // Ertefa (Y-axis range)
  yOffset: 5, // Vertical shift
  minScale: 10, // Minimum particle scale
  maxScale: 60, // Maximum particle scale
};
// ----------------------------------------------

interface VolumetricSmokeProps {
  count?: number;
  animate?: boolean;
  renderOrder?: number;
  opacity?: number;
}

export default function VolumetricSmoke({ count = 400, animate = false, renderOrder, opacity = 1.0 }: VolumetricSmokeProps) {
  const meshRef = useRef<THREE.InstancedMesh>(null);

  const uniforms = useMemo(
    () => ({
      time: { value: 0 },
      // Muted smoke color
      smokeColor: { value: new THREE.Color("#99aabb") },
      uOpacity: { value: opacity },
    }),
    [],
  );

  useEffect(() => {
    if (meshRef.current && meshRef.current.material) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.uOpacity.value = opacity;
    }
  }, [opacity]);

  useEffect(() => {
    if (!meshRef.current) return;

    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      // Distribute particles using SMOKE_CONFIG
      const x = (Math.random() - 0.5) * SMOKE_CONFIG.length;
      const z = (Math.random() - 0.5) * SMOKE_CONFIG.width;
      const y = Math.random() * SMOKE_CONFIG.height + SMOKE_CONFIG.yOffset;

      dummy.position.set(x, y, z);

      // Scale range from SMOKE_CONFIG
      const scale =
        Math.random() * (SMOKE_CONFIG.maxScale - SMOKE_CONFIG.minScale) +
        SMOKE_CONFIG.minScale;
      dummy.scale.set(scale, scale, scale);
      dummy.rotation.z = Math.random() * Math.PI * 2;

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count]);

  useFrame((state) => {
    if (animate && meshRef.current && meshRef.current.material) {
      (meshRef.current.material as THREE.ShaderMaterial).uniforms.time.value =
        state.clock.elapsedTime;
    }
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      renderOrder={renderOrder}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <shaderMaterial
        vertexShader={smokeVertexShader}
        fragmentShader={smokeFragmentShader}
        uniforms={uniforms}
        transparent={true}
        depthWrite={false}
        blending={THREE.NormalBlending}
      />
    </instancedMesh>
  );
}
