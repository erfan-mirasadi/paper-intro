"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGLTF, Center } from "@react-three/drei";

const MOUNTAIN_URL = "/assets/cave/scene-mountain.glb";

interface LowpolyMountainProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function LowpolyMountain({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 50,
}: LowpolyMountainProps) {
  const gl = useThree((state) => state.gl);

  const [mountainData] = useGLTF([MOUNTAIN_URL], true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });

  useEffect(() => {
    if (!mountainData?.scene) return;
    mountainData.scene.traverse((child: any) => {
      if (child.isMesh) {
        const materials = Array.isArray(child.material)
          ? child.material
          : [child.material];
        materials.forEach((mat: any) => {
          if (!mat) return;
          // remove metalness and its map
          if ("metalness" in mat) mat.metalness = 0;
          if (mat.metalnessMap) mat.metalnessMap = null;
          // remove normal map
          if (mat.normalMap) mat.normalMap = null;
          // ensure roughness exists; use flat roughness if no map
          if ("roughness" in mat) {
            if (!mat.roughnessMap) mat.roughness = 1;
          } else {
            mat.roughness = 1;
          }
          mat.needsUpdate = true;
        });
      }
    });
  }, [mountainData]);

  return (
    <Center position={position} rotation={rotation} scale={scale}>
      <primitive object={mountainData.scene} />
    </Center>
  );
}
