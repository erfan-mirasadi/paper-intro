"use client";

import { useMemo, useEffect, useState } from "react";
import { useThree } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
// import StaticClouds from "./StaticClouds";
import VolumetricSmoke from "./VolumetricSmoke";

const gltfCache = new Map();

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
  const url = "/mountain-2.glb";

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

        gltfCache.set(url, gltf.scene);
        if (isMounted) setScene(gltf.scene);
      },
      undefined,
      (err) => {
        console.error(`❌ Error loading mountain-2 model:`, err);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [gl, url]);

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
              `
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
      {hasClouds && <VolumetricSmoke count={100} animate={true} renderOrder={10} />}
    </group>
  );
}
