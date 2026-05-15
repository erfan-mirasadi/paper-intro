"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const ENTRANCE_URL = "/assets/cave/intrence-cave-opt.glb";

export default function CaveEntrance({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: any) {
  const gl = useThree((state) => state.gl);

  const { scene } = useGLTF(ENTRANCE_URL, true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });

  const sceneClone = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();

    // Apply fog logic or materials similar to Mountain2 if needed
    clone.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        obj.material = new THREE.MeshStandardMaterial({
          color: new THREE.Color(0.8, 0.8, 0.8),
          map: obj.material.map,
          roughness: 0.9,
          metalness: 0.1,
          transparent: true,
          opacity: 1.0,
          side: THREE.DoubleSide,
        });
        obj.material.fog = true;
        obj.material.needsUpdate = true;
      }
    });

    return clone;
  }, [scene]);

  if (!sceneClone) return null;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={sceneClone} />
    </group>
  );
}
