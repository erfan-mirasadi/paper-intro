"use client";

import React, { useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

interface StaticCloudsProps {
  count?: number;
  spread?: [number, number, number];
  offset?: [number, number, number];
  baseScale?: number;
  opacity?: number;
  renderOrder?: number;
  rotation?: [number, number, number];
}

export default function StaticClouds({
  count = 400,
  spread = [5000, 400, 5000],
  offset = [0, 350, -500],
  baseScale = 300,
  opacity = 0.03,
  renderOrder = -4,
  rotation = [0, 0, 0],
}: StaticCloudsProps) {
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      const x = (Math.random() - 0.5) * spread[0] + offset[0];
      const y = (Math.random() - 0.5) * spread[1] + offset[1];
      const z = (Math.random() - 0.5) * spread[2] + offset[2];

      const scaleX = Math.random() * 4.0 + 2.0;
      const scaleY = Math.random() * 0.4 + 0.2;

      dummy.position.set(x, y, z);
      dummy.rotation.set(rotation[0], rotation[1], rotation[2]);
      dummy.scale.set(baseScale * scaleX, baseScale * scaleY, 1);

      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }

    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [count, spread, offset, baseScale, rotation]);

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      renderOrder={renderOrder}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={opacity}
        depthWrite={false}
        color="#aaddff" // Soft bluish-white tint
        side={THREE.DoubleSide}
        fog={true}
      />
    </instancedMesh>
  );
}
