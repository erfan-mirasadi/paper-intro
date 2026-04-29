"use client";

import React, { useMemo, useRef } from "react";
import * as THREE from "three";
import { useFrame, useLoader } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as BufferGeometryUtils from "three/examples/jsm/utils/BufferGeometryUtils.js";

const vertexShader = `
  varying vec2 vUv;
  void main() {
    vUv = uv;
    gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
  }
`;

const fragmentShader = `
  uniform sampler2D map;
  uniform vec3 fogColor;
  uniform float fogNear;
  uniform float fogFar;
  varying vec2 vUv;
  void main() {
    float depth = gl_FragCoord.z / gl_FragCoord.w;
    float fogFactor = smoothstep( fogNear, fogFar, depth );
    gl_FragColor = texture2D( map, vUv );
    gl_FragColor.w *= pow( gl_FragCoord.z, 20.0 );
    gl_FragColor = mix( gl_FragColor, vec4( fogColor, gl_FragColor.w ), fogFactor );
  }
`;

// --- CONFIGURATION ---
const CLOUD_CONFIG = {
  count: 700, // تعداد ابرها
  width: 4000, // عرض پخش شدن (X)
  height: -10, // ارتفاع کلی (Y)
  ySpread: 150, // میزان پراکندگی در ارتفاع
  depth: 3000, // عمق توده ابر (Z)
  color: "#2D5676", // رنگ مه (Fog Color)
  startZ: 500, // موقعیت شروع زوم (Z)
  endZ: 0, // موقعیت پایان زوم (Z)
  xScale: 2, // کشیدگی در عرض (X-Stretch)
  yScale: 1.0, // کشیدگی در ارتفاع (Y-Stretch)
  opacity: 0.8, // شفافیت
  xOffset: 0, // جابجایی افقی کل توده ابر
};

export default function Clouds() {
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");
  const groupRef = useRef<THREE.Group>(null!);

  // Geometry Merging
  const geometry = useMemo(() => {
    const geometries: THREE.PlaneGeometry[] = [];
    const plane = new THREE.PlaneGeometry(64, 64);

    for (let i = 0; i < CLOUD_CONFIG.count; i++) {
      const p = plane.clone();

      const x =
        (Math.random() - 0.5) * CLOUD_CONFIG.width + CLOUD_CONFIG.xOffset;
      const y =
        (Math.random() - 0.5) * CLOUD_CONFIG.ySpread + CLOUD_CONFIG.height;
      const z = Math.random() * CLOUD_CONFIG.depth;

      const rotation = Math.random() * Math.PI;
      const scale = Math.random() * 2.0 + 1.0;

      p.rotateZ(rotation);
      // Applying width stretch (xScale) and general scale
      p.scale(scale * CLOUD_CONFIG.xScale, scale * CLOUD_CONFIG.yScale, 1);
      p.translate(x, y, z);

      geometries.push(p);
    }

    return BufferGeometryUtils.mergeGeometries(geometries);
  }, []);

  const uniforms = useMemo(
    () => ({
      map: { value: texture },
      fogColor: { value: new THREE.Color(CLOUD_CONFIG.color) },
      fogNear: { value: -100 },
      fogFar: { value: 5000 },
    }),
    [texture],
  );

  const scroll = useScroll();
  const cld1Ref = useRef<THREE.Mesh>(null!);
  const cld2Ref = useRef<THREE.Mesh>(null!);
  const currentSpeed = useRef(0.5);

  // Animation logic
  useFrame((state, delta) => {
    // Target speed is 2.0 (faster) when at the top, and 0 when scrolling
    const targetSpeed = scroll.offset === 0 ? 2.0 : 0;

    // Smoothly damp the speed towards the target
    currentSpeed.current = THREE.MathUtils.damp(
      currentSpeed.current,
      targetSpeed,
      10,
      delta,
    );

    // If it's effectively stopped, don't update positions
    if (currentSpeed.current < 0.001) return;

    if (cld1Ref.current) {
      // Reverse direction: -=
      cld1Ref.current.position.z -= currentSpeed.current;
      if (cld1Ref.current.position.z < -CLOUD_CONFIG.depth) {
        cld1Ref.current.position.z = CLOUD_CONFIG.depth;
      }
    }

    if (cld2Ref.current) {
      // Reverse direction: -=
      cld2Ref.current.position.z -= currentSpeed.current;
      if (cld2Ref.current.position.z < -CLOUD_CONFIG.depth * 2) {
        cld2Ref.current.position.z = 0;
      }
    }
  });

  return (
    <group ref={groupRef} position={[0, 0, CLOUD_CONFIG.startZ]}>
      <mesh ref={cld1Ref} geometry={geometry}>
        <shaderMaterial
          attach="material"
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
          opacity={CLOUD_CONFIG.opacity}
          depthWrite={false}
        />
      </mesh>
      <mesh
        ref={cld2Ref}
        geometry={geometry}
        position={[0, 0, -CLOUD_CONFIG.depth]}
      >
        <shaderMaterial
          attach="material"
          uniforms={uniforms}
          vertexShader={vertexShader}
          fragmentShader={fragmentShader}
          transparent={true}
          opacity={CLOUD_CONFIG.opacity}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
