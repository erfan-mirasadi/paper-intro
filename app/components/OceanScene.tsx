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

  // Load the water normal map - Make sure this file exists in your public/textures folder!
  const texture = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");

  const waterNormals = useMemo(() => {
    const t = texture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [texture]);

  // Use useMemo for the configuration to prevent unnecessary re-renders
  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: new THREE.Vector3(0, 0.5, -1).normalize(), // Sunset/sunrise angle for beautiful reflections
      sunColor: 0xffffff,
      waterColor: 0x13192e, // Lighter base color to see the waves and depth better
      distortionScale: 5.0, // Tweaked for clearer, more realistic waves
      size: 1.5, // Increased size to make the normal map look more natural
      fog: true,
      alpha: 0.85, // Added alpha transparency so we can see objects underneath
    }),
    [waterNormals],
  );

  // Animate the water
  useFrame((_state, delta) => {
    if (waterRef.current) {
      waterRef.current.material.uniforms["time"].value += delta * 0.35; // Faster, more turbulent ocean movement
    }
  });

  return (
    // Group everything to manage the overall ocean position easily
    <group position={[0, -2, 0]}>
      {/* The surface of the water */}
      <water
        ref={waterRef}
        args={[new THREE.PlaneGeometry(10000, 10000), config]}
        rotation-x={-Math.PI / 2}
        position={[0, 0, 0]}
      />

      {/* Deep ocean volume for fish, submarines, and island bases! */}
      {/* Lowered the position to -510 so the top face is at -10, fixing the Z-Fighting issue! */}
      <mesh position={[0, -510, 0]}>
        <boxGeometry args={[10000, 1000, 10000]} />
        {/* Changed to BasicMaterial for better performance and to avoid lighting glitches inside the box */}
        <meshBasicMaterial
          color={0x001220} // Very deep, dark ocean blue for the volume
          transparent={true}
          opacity={0.8}
          depthWrite={false} // Prevents z-fighting issues with objects inside
        />
      </mesh>
    </group>
  );
}
