"use client";

import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
// import StaticClouds from "./StaticClouds";
import VolumetricSmoke from "../environment/VolumetricSmoke";

const gltfCache = new Map();
const MOUNTAIN_URL = "/mountain-2.glb";

interface Mountain2Props {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  color?: [number, number, number];
  hasClouds?: boolean;
  receiveSceneFog?: boolean;
  sceneFogMultiplier?: number;
}

export default function Mountain2({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  color = [0.1, 0.1, 0.1],
  hasClouds = true,
  receiveSceneFog = true,
  sceneFogMultiplier = 1.0,
}: Mountain2Props) {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const colorKey = color.join(",");

  useEffect(() => {
    let isMounted = true;

    loadMountainScene(gl, color)
      .then((loadedScene) => {
        if (isMounted) setScene(loadedScene);
      })
      .catch((err) => {
        console.error(`❌ Error loading mountain-2 model:`, err);
      });

    return () => {
      isMounted = false;
    };
  }, [gl, colorKey]);

  const sceneClone = useMemo(() => {
    if (!scene) return null;
    const clone = scene.clone();

    clone.traverse((obj: any) => {
      if (obj.isMesh && obj.material) {
        // We only clone material if we are modifying it, but to be safe and avoid shared state bugs:
        obj.material = obj.material.clone();
        obj.material.fog = receiveSceneFog;

        if (receiveSceneFog && sceneFogMultiplier !== 1.0) {
          obj.material.onBeforeCompile = (shader: any) => {
            shader.fragmentShader = shader.fragmentShader.replace(
              `#include <fog_fragment>`,
              `
              #ifdef USE_FOG
                #ifdef FOG_EXP2
                  float customDensity = fogDensity * ${sceneFogMultiplier.toFixed(3)};
                  float fogFactor = 1.0 - exp( - customDensity * customDensity * vFogDepth * vFogDepth );
                #else
                  float fogFactor = smoothstep( fogNear, fogFar, vFogDepth );
                #endif
                gl_FragColor.rgb = mix( gl_FragColor.rgb, fogColor, fogFactor );
              #endif
              `,
            );
          };
        }
        obj.material.needsUpdate = true;
      }
    });

    return clone;
  }, [scene, receiveSceneFog, sceneFogMultiplier]);

  if (!sceneClone) return null;

  return (
    <group
      position={position}
      rotation={[rotation[0], rotation[1] + (0.5 * Math.PI) / 180, rotation[2]]}
      scale={scale}
    >
      <primitive object={sceneClone} />
      {/* <StaticClouds
        count={190}
        spread={[200, 30, 50]}
        offset={[0, 26, 0]}
        baseScale={10}
        renderOrder={-3}
        rotation={[0, (65 * Math.PI) / 180, 0]}
        opacity={0.05}
      /> */}
      {/* Significantly thickened smoke concentrate */}
      {hasClouds && (
        <VolumetricSmoke count={100} animate={true} renderOrder={10} />
      )}
    </group>
  );
}

function getMountainCacheKey(color: [number, number, number]) {
  return `${MOUNTAIN_URL}|${color.join(",")}`;
}

function loadMountainScene(
  gl: THREE.WebGLRenderer,
  color: [number, number, number],
) {
  const cacheKey = getMountainCacheKey(color);

  if (gltfCache.has(cacheKey)) {
    return Promise.resolve(gltfCache.get(cacheKey));
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
      MOUNTAIN_URL,
      (gltf) => {
        gltf.scene.traverse((obj: any) => {
          if (obj.isMesh) {
            if (obj.material) {
              obj.material = new THREE.MeshBasicMaterial({
                color: new THREE.Color(...color),
                map: obj.material.map,
                transparent: true,
                opacity: 1.0,
                side: THREE.FrontSide,
              });
            }
          }
        });

        gltfCache.set(cacheKey, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadMountain2(
  gl: THREE.WebGLRenderer,
  color: [number, number, number],
) {
  return loadMountainScene(gl, color);
}
