"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const SCENE_MOUNTAIN_URL = "/assets/cave/scene-mountain.glb";

interface SceneMountainProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function SceneMountain({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: SceneMountainProps) {
  const gl = useThree((state) => state.gl);

  const { scene } = useGLTF(SCENE_MOUNTAIN_URL, true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });

  const coloredScene = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();
    clone.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Apply reddish-brown tint
        if (child.material) {
          // If it's a multi-material or array, handle it (usually not for these)
          const materials = Array.isArray(child.material)
            ? child.material
            : [child.material];
          materials.forEach((mat: any) => {
            if (mat.color) {
              // Tone down the red to a more balanced reddish-brown
              mat.color.setRGB(0.45, 0.22, 0.15);
            }
            // Reduce shininess by increasing roughness and zeroing metalness
            if (mat.roughness !== undefined) mat.roughness = 0.95;
            if (mat.metalness !== undefined) mat.metalness = 0.0;
          });
        }
      }
    });
    return clone;
  }, [scene]);

  if (!coloredScene) return null;

  return (
    <primitive
      object={coloredScene}
      position={position}
      rotation={rotation}
      scale={scale}
    />
  );
}
