import React, { useRef, useMemo } from "react";
import * as THREE from "three";
import { ThreeElement, useFrame, extend, useLoader } from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";

// Extend R3F with the Water object
extend({ Water });

// Add types for the extended water element
declare module "@react-three/fiber" {
  interface ThreeElements {
    water: ThreeElement<typeof Water>;
  }
}

export default function OceanScene() {
  const waterRef = useRef<Water>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const directionalRef = useRef<THREE.DirectionalLight>(null!);

  // Load the water normal map
  const texture = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");

  const waterNormals = useMemo(() => {
    const t = texture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [texture]);

  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(0, 0.5, -1).normalize(),
      sunColor: 0x444444, // Kept the dark sun color permanently
      waterColor: 0x001e0f, // Kept the dark water color permanently
      distortionScale: 5.0,
      size: 1.5,
      fog: true,
      alpha: 0.85,
    }),
    [waterNormals],
  );

  // Animate the water
  useFrame((_state, delta) => {
    if (waterRef.current) {
      // Time animation for continuous wave movement
      waterRef.current.material.uniforms["time"].value += delta * 0.35;
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.2} />
      <directionalLight
        ref={directionalRef}
        position={[-10, 20, 10]}
        intensity={0.5}
      />

      <group position={[0, -2, 0]}>
        <water
          ref={waterRef}
          args={[new THREE.PlaneGeometry(10000, 10000), config]}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
        />

        <mesh position={[0, -510, 0]}>
          <boxGeometry args={[10000, 1000, 10000]} />
          <meshBasicMaterial
            color={0x001220}
            transparent={true}
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}
