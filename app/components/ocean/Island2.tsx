"use client";

import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();
const ISLAND2_URL = "/mountain-sea.glb";

function PlaceholderMesh() {
  return null;
}

// Create instances for Island2 with different positions outside the component
// to keep the component pure and avoid "impure function during render" errors.
const INSTANCES = [
  {
    id: "i2-1",
    position: [-2000, -10, -4000] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 1,
  },
  {
    id: "i2-2",
    position: [2000, -10, -7200] as [number, number, number],
    rotation: [0, Math.random() * Math.PI + Math.PI / 1, 0] as [
      number,
      number,
      number,
    ],
    scale: 1.6,
  },
];

function loadIsland2Scene(gl: THREE.WebGLRenderer) {
  if (gltfCache.has(ISLAND2_URL)) {
    return Promise.resolve(gltfCache.get(ISLAND2_URL));
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
      ISLAND2_URL,
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

        gltfCache.set(ISLAND2_URL, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadIsland2(gl: THREE.WebGLRenderer) {
  return loadIsland2Scene(gl);
}

export default function Island2() {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadIsland2Scene(gl)
      .then((loadedScene) => {
        if (isMounted) {
          setScene(loadedScene);
        }
      })
      .catch((err) => {
        console.error(`❌ Error loading island-2 model:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [gl]);

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
