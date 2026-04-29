"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

export default function Skybox() {
  const { scene } = useThree();

  useEffect(() => {
    const f = ".png";
    const loader = new THREE.CubeTextureLoader();
    // Setting path to /img/ based on the directory listing
    loader.setPath("/img/");

    loader.load(
      [
        "posx" + f,
        "negx" + f,
        "posy" + f,
        "negy" + f,
        "posz" + f,
        "negz" + f,
      ],
      (texture) => {
        scene.background = texture;
        // scene.environment = texture; // Optional: use skybox for lighting
        
        // Settings from your snippet:
        // scene.backgroundRotation.set(0, Math.PI / 4, 0); 
        // scene.backgroundBlurriness = 0.2; 
        // scene.backgroundIntensity = 0.75;
      }
    );

    return () => {
      scene.background = null;
    };
  }, [scene]);

  return null;
}
