"use client";

import { useRef, useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

interface ParticleMistProps {
  position?: [number, number, number];
  scale?: [number, number, number] | number;
  count?: number;
  color?: string;
  size?: number;
  opacity?: number;
  spread?: [number, number, number];
}

export default function ParticleMist({
  position = [0, 0, 0],
  scale = 1,
  count = 100,
  color = "#8899aa",
  size = 150,
  opacity = 0.2,
  spread = [100, 50, 100],
}: ParticleMistProps) {
  const mistTexture = useTexture("/mist5.png");
  const pointsRef = useRef<THREE.Points>(null!);

  const positions = useMemo(() => {
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * spread[0];
      pos[i * 3 + 1] = (Math.random() - 0.5) * spread[1];
      pos[i * 3 + 2] = (Math.random() - 0.5) * spread[2];
    }
    return pos;
  }, [count, spread]);

  return (
    <group position={position} scale={scale}>
      <points ref={pointsRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={positions.length / 3}
            array={positions}
            itemSize={3}
          />
        </bufferGeometry>
        <pointsMaterial
          map={mistTexture}
          size={size}
          color={color}
          transparent={true}
          opacity={opacity}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </points>
    </group>
  );
}
