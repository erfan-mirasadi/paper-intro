"use client";

import { useEffect, useState, useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();

export default function CaveEntrance({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: any) {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const url = "/assets/cave/intrence-cave-opt.glb";

  useEffect(() => {
    let isMounted = true;

    if (gltfCache.has(url)) {
      Promise.resolve().then(() => {
        if (isMounted) setScene(gltfCache.get(url));
      });
      return;
    }

    const loader = new GLTFLoader();
    const draco = getSharedDRACOLoader();
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = getSharedKTX2Loader(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;

        gltf.scene.traverse((obj: any) => {
          if (obj.isMesh && obj.material) {
            // Changed from MeshBasicMaterial to MeshStandardMaterial so it reacts to scene lights
            obj.material = new THREE.MeshStandardMaterial({
              color: new THREE.Color(0.8, 0.8, 0.8),
              map: obj.material.map,
              roughness: 0.9,
              metalness: 0.1,
              transparent: true,
              opacity: 1.0,
              side: THREE.DoubleSide,
            });
          }
        });

        gltfCache.set(url, gltf.scene);
        if (isMounted) setScene(gltf.scene);
      },
      undefined,
      (err) => {
        console.error(`❌ Error loading entrance model:`, err);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [gl, url]);

  const sceneClone = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();

    // Apply fog logic or materials similar to Mountain2 if needed
    clone.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        obj.material = obj.material.clone();
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
