"use client";

import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();

function PlaceholderMesh() {
  return null;
}

// Create instances outside the component to ensure purity
const INSTANCES = [
  {
    id: 1,
    position: [600, 5, -4800] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 300,
  },
  {
    id: 2,
    position: [-800, 10, -7200] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 450,
  },
  {
    id: 3,
    position: [1200, 15, -10000] as [number, number, number],
    rotation: [0, Math.random() * Math.PI, 0] as [number, number, number],
    scale: 1000,
  },
];

export default function Island() {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const url = "/island.glb";

  useEffect(() => {
    let isMounted = true;

    if (gltfCache.has(url)) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setScene(gltfCache.get(url));
        }
      });
      return;
    }

    const loader = new GLTFLoader();

    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(
      "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/",
    );
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;

        // Process materials like in RealModel.tsx
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
                  color: obj.material.color ? obj.material.color.clone().multiplyScalar(0.12) : new THREE.Color(0.12, 0.12, 0.12),
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
                  color: obj.material.color ? obj.material.color.clone().multiplyScalar(0.12) : new THREE.Color(0.12, 0.12, 0.12),
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

        gltfCache.set(url, gltf.scene);
        setScene(gltf.scene);
      },
      undefined,
      (err) => {
        console.error(`❌ Error loading island model:`, err);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [gl, url]);

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
