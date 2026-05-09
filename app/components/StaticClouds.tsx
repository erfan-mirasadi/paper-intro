"use client";

import React, { useRef, useLayoutEffect } from "react";
import * as THREE from "three";
import { useLoader } from "@react-three/fiber";

export default function StaticClouds() {
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");
  const meshRef = useRef<THREE.InstancedMesh>(null!);

  const count = 400;

  useLayoutEffect(() => {
    if (!meshRef.current) return;
    const dummy = new THREE.Object3D();

    for (let i = 0; i < count; i++) {
      // Cluster clouds around the models (radius ~2500)
      const x = (Math.random() - 0.5) * 5000;
      
      // Lower height range (from 150 to 550)
      const y = Math.random() * 400 + 150; 
      const z = (Math.random() - 0.5) * 5000 - 500; // Centered slightly towards the lighthouse at -1000

      const rotationY = 0; // All face the same direction
      const scaleX = Math.random() * 4.0 + 2.0;
      const scaleY = Math.random() * 0.4 + 0.2;

      dummy.position.set(x, y, z);
      
      // Make them vertical (standing up) instead of flat. 
      // Rotate on Y to face different directions.
      dummy.rotation.set(0, rotationY, 0);
      
      // Apply scale (base cloud size is 300)
      dummy.scale.set(300 * scaleX, 300 * scaleY, 1);
      
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    }
    
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, []);

  return (
    <instancedMesh ref={meshRef} args={[undefined, undefined, count]} renderOrder={-4}>
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={0.15}
        depthWrite={false}
        color="#aaddff" // Soft bluish-white tint
        side={THREE.DoubleSide}
        fog={true}
      />
    </instancedMesh>
  );
}
