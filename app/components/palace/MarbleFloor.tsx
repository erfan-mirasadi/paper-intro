"use client";

import { useMemo } from "react";
import type { ComponentProps } from "react";
import { useTexture, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

interface MarbleFloorProps extends ComponentProps<"group"> {
  ambientIntensity?: number;
}

export default function MarbleFloor({
  ambientIntensity = 6.5,
  ...props
}: MarbleFloorProps) {
  const marbleTexture = useTexture("/assets/cave/old/marble.png");
  useMemo(() => {
    marbleTexture.wrapS = marbleTexture.wrapT = THREE.RepeatWrapping;
    marbleTexture.repeat.set(40, 200);
    marbleTexture.anisotropy = 16;
  }, [marbleTexture]);

  return (
    <group {...props}>
      {/* <ambientLight intensity={ambientIntensity} /> */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 400]} />
        <MeshReflectorMaterial
          map={marbleTexture}
          color="#ffffff"
          roughness={0.05}
          metalness={0.1}
          mirror={0.05}
          resolution={1028}
          mixBlur={0}
          mixStrength={0.2}
          blur={[0, 0]}
          depthScale={0}
          minDepthThreshold={0.9}
          maxDepthThreshold={1.2}
          depthToBlurRatioBias={0.2}
          distortion={0}
          transparent={true}
          opacity={1}
        />
      </mesh>
    </group>
  );
}
