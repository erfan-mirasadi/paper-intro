"use client";

import { useMemo } from "react";
import { extend, useLoader } from "@react-three/fiber";
import * as THREE from "three";
import {
  Lensflare,
  LensflareElement,
} from "three/examples/jsm/objects/Lensflare.js";

// Register Lensflare as a JSX component
extend({ Lensflare, LensflareElement });

declare module "@react-three/fiber" {
  interface ThreeElements {
    lensflare: any;
    lensflareElement: any;
  }
}

export default function LensFlareEffect() {
  const [textureMain, textureRing] = useLoader(THREE.TextureLoader, [
    "/lens_flare_main.png",
    "/lens_flare_ring.png",
  ]);

  // Position it high up and slightly behind or in front as requested
  // User code used (0, 1500, -20000)
  const position = useMemo(() => new THREE.Vector3(0, 1500, -5000), []);

  return (
    <group position={position}>
      <pointLight intensity={5} distance={10000} color="#ffffff" />
      <lensflare>
        <lensflareElement
          texture={textureMain}
          size={700}
          distance={0}
          color={new THREE.Color(1, 0.8, 0.5)}
        />
        <lensflareElement
          texture={textureRing}
          size={120}
          distance={0.6}
          color={new THREE.Color(1, 1, 1)}
        />
        <lensflareElement
          texture={textureRing}
          size={70}
          distance={0.7}
          color={new THREE.Color(1, 1, 1)}
        />
        <lensflareElement
          texture={textureRing}
          size={140}
          distance={0.9}
          color={new THREE.Color(1, 1, 1)}
        />
        <lensflareElement
          texture={textureRing}
          size={60}
          distance={1}
          color={new THREE.Color(1, 1, 1)}
        />
      </lensflare>
    </group>
  );
}
