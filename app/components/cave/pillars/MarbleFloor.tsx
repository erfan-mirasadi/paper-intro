"use client";

import { useMemo } from "react";
import { useTexture, MeshReflectorMaterial } from "@react-three/drei";
import * as THREE from "three";

export default function MarbleFloor(props: any) {
  const marbleTexture = useTexture("/assets/cave/marble.png");
  useMemo(() => {
    marbleTexture.wrapS = marbleTexture.wrapT = THREE.RepeatWrapping;
    marbleTexture.repeat.set(40, 200);
    marbleTexture.anisotropy = 16;
  }, [marbleTexture]);

  return (
    <group {...props}>
      <ambientLight intensity={6.5} />
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[80, 400]} />
        <MeshReflectorMaterial
          map={marbleTexture}
          color="#ffffff"
          roughness={0.05}
          metalness={0.1}
          mirror={0.7}
          resolution={1028}
          mixBlur={0}
          mixStrength={1.2}
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
