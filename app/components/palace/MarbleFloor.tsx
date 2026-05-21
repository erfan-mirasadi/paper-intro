"use client";

import type { ComponentProps } from "react";
import { useTexture, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

type MarbleFloorProps = ComponentProps<"group">;

export default function MarbleFloor({ ...props }: MarbleFloorProps) {
  const marbleTexture = useTexture("/assets/palace/marble.jpeg", (texture) => {
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.repeat.set(40, 110);
    texture.anisotropy = 16;
    texture.needsUpdate = true;
  });

  return (
    <group {...props}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[220, 260]} />
        <MeshReflectorMaterial
          map={marbleTexture}
          color="#ffffff"
          roughness={0.05}
          metalness={0.1}
          mirror={0.05}
          resolution={1024}
          mixBlur={0}
          mixStrength={0.2}
          blur={[0, 0]}
          depthScale={0}
          minDepthThreshold={0.9}
          maxDepthThreshold={1.2}
          depthToBlurRatioBias={0.2}
          distortion={0}
          transparent={false}
          opacity={1}
        />
      </mesh>
    </group>
  );
}
