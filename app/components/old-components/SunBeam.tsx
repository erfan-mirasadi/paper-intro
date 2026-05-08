"use client";

import React, { useMemo } from "react";
import { useTexture } from "@react-three/drei";
import * as THREE from "three";

export default function SunBeam() {
  const [textureSun, textureBeam] = useTexture([
    "/alfa2.jpg",
    "/spotLcone2.jpg",
  ]);

  // Configure beam texture
  useMemo(() => {
    textureBeam.wrapS = textureBeam.wrapT = THREE.MirroredRepeatWrapping;
    textureBeam.repeat.set(1, 2);
  }, [textureBeam]);

  return (
    <group>
      {/* Sun Center Mesh - Stronger Glow */}
      <mesh position={[0, 1000, -500]}>
        <planeGeometry args={[500, 500]} />
        <meshBasicMaterial
          color="#4BACCC"
          alphaMap={textureSun}
          transparent={true}
          opacity={1.0}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Primary Light Beam */}
      <mesh position={[0, 500, -250]} rotation={[Math.PI / 2.5, 0, 0]}>
        <boxGeometry args={[500, 0.0001, 2500]} />
        <meshBasicMaterial
          color="#4BACCC"
          alphaMap={textureBeam}
          transparent={true}
          opacity={0.4}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Secondary Light Beam Layer for Volume */}
      <mesh
        position={[0, 500, -250]}
        rotation={[Math.PI / 2.5, 0, Math.PI / 2]}
      >
        <boxGeometry args={[500, 0.0001, 2500]} />
        <meshBasicMaterial
          color="#4BACCC"
          alphaMap={textureBeam}
          transparent={true}
          opacity={0.2}
          depthWrite={false}
          side={THREE.DoubleSide}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  );
}
