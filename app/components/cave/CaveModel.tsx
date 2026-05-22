"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGLTF, Center } from "@react-three/drei";

const CAVE_SCENE_URLS = [
  "/assets/cave/cave-cave-scene-opt.glb",
  "/assets/cave/rock-cave-scene-opt.glb",
  "/assets/cave/plane-cave-scene-opt.glb",
];
const MOUNTAIN_URL = "/assets/cave/mountain-cave-scene-opt.glb";

interface CaveModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function CaveModel({
  position = [22, 0, 1],
  rotation = [0, 0, 0],
  scale = 1,
}: CaveModelProps) {
  const gl = useThree((state) => state.gl);

  const [caveData, rockData, planeData, mountainData] = useGLTF(
    [...CAVE_SCENE_URLS, MOUNTAIN_URL],
    true,
    true,
    (loader: any) => {
      loader.setKTX2Loader(getSharedKTX2Loader(gl));
      loader.setDRACOLoader(getSharedDRACOLoader());
      if (MeshoptDecoder) {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
    },
  );

  // Darken only the cave model's textures/colors (towards black)
  useEffect(() => {
    if (!caveData?.scene) return;
    const darkenFactor = 0.45; // 0 = black, 1 = unchanged
    caveData.scene.traverse((child: any) => {
      if (!child.isMesh) return;
      const materials = Array.isArray(child.material)
        ? child.material
        : [child.material];
      materials.forEach((mat: any) => {
        if (!mat) return;
        try {
          if (mat.color) {
            mat.color.multiplyScalar(darkenFactor);
          } else {
            mat.color = new THREE.Color(
              darkenFactor,
              darkenFactor,
              darkenFactor,
            );
          }
          if (mat.emissive) mat.emissive.multiplyScalar(darkenFactor);
          mat.needsUpdate = true;
        } catch (e) {
          // ignore materials that don't support color/emissive
        }
      });
    });
  }, [caveData]);

  return (
    <Center position={position} rotation={rotation} scale={scale}>
      <group>
        <primitive object={caveData.scene} />
        <primitive object={rockData.scene} />
        <primitive object={planeData.scene} />
        <primitive object={mountainData.scene} />
      </group>
    </Center>
  );
}
