"use client";

import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();
const ISLAND_URL = "/island.glb";

function PlaceholderMesh() {
  return null;
}

// Create instances outside the component to ensure purity
const INSTANCES = [
  {
    id: 1,
    position: [900, 5, -480] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 300,
  },
  {
    id: 2,
    position: [-1800, 10, -72] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 450,
  },
  {
    id: 3,
    position: [1200, 15, -100] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 1000,
  },
];

function loadIslandScene(gl: THREE.WebGLRenderer) {
  if (gltfCache.has(ISLAND_URL)) {
    return Promise.resolve(gltfCache.get(ISLAND_URL));
  }

  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();

    const draco = getSharedDRACOLoader();
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = getSharedKTX2Loader(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      ISLAND_URL,
      (gltf) => {
        gltf.scene.traverse((obj: any) => {
          if (obj.isMesh) {
            obj.castShadow = true;
            obj.receiveShadow = true;

            if (obj.material) {
              const originalMap = obj.material.map;
              if (originalMap) {
                const clonedMap = originalMap.clone();
                clonedMap.needsUpdate = true;
                clonedMap.anisotropy = gl.capabilities.getMaxAnisotropy();

                obj.material = new THREE.MeshBasicMaterial({
                  map: clonedMap,
                  color: obj.material.color
                    ? obj.material.color.clone().multiplyScalar(0.12)
                    : new THREE.Color(0.12, 0.12, 0.12),
                  transparent: true,
                  opacity:
                    obj.material.transmission > 0
                      ? Math.max(0.6, 1.0 - obj.material.transmission)
                      : obj.material.opacity,
                  side: obj.material.side,
                  alphaTest: obj.material.alphaTest || 0.1,
                });
              } else {
                obj.material = new THREE.MeshBasicMaterial({
                  color: obj.material.color
                    ? obj.material.color.clone().multiplyScalar(0.12)
                    : new THREE.Color(0.12, 0.12, 0.12),
                  transparent: obj.material.transparent,
                  opacity:
                    obj.material.transmission > 0
                      ? Math.max(0.6, 1.0 - obj.material.transmission)
                      : obj.material.opacity,
                  side: obj.material.side,
                });
              }
              obj.material.needsUpdate = true;
            }
          }
        });

        gltfCache.set(ISLAND_URL, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadIsland(gl: THREE.WebGLRenderer) {
  return loadIslandScene(gl);
}

export default function Island() {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadIslandScene(gl)
      .then((loadedScene) => {
        if (isMounted) {
          setScene(loadedScene);
        }
      })
      .catch((err) => {
        console.error(`❌ Error loading island model:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [gl]);

  // Memoize the clones so we don't clone on every render
  const islandClones = useMemo(() => {
    if (!scene) return [];
    return INSTANCES.map(() => scene.clone());
  }, [scene]);

  if (!scene) return <PlaceholderMesh />;

  return (
    <group>
      {INSTANCES.map((inst, index) => (
        <primitive
          key={inst.id}
          object={islandClones[index]}
          position={inst.position}
          rotation={inst.rotation}
          scale={inst.scale}
        />
      ))}
    </group>
  );
}
