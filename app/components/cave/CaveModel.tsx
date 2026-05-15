"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const CAVE_URL = "/assets/cave/cave-v01-opt.glb";

interface CaveModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  count?: number;
  offsetZ?: number; // How much to move each instance along Z
  receiveSceneFog?: boolean;
  sceneFogMultiplier?: number;
}

export default function CaveModel({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  count = 8,
  receiveSceneFog = false,
  sceneFogMultiplier = 1.5,
}: CaveModelProps) {
  const gl = useThree((state) => state.gl);

  const { scene } = useGLTF(CAVE_URL, true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });

  const instances = useMemo(() => {
    if (!scene) return [];

    const arr = [];
    for (let i = 0; i < count; i++) {
      const clone = scene.clone();

      clone.traverse((obj: any) => {
        if (obj.isMesh && obj.material) {
          obj.material = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.45, 0.42, 0.38),
            map: obj.material.map,
            roughness: 0.92,
            metalness: 0.5,
            transparent: true,
            opacity: 1.0,
            side: THREE.DoubleSide,
          });
          obj.material.fog = receiveSceneFog;

          // Always patch the shader: zero out all indirect diffuse light (ambient, hemisphere)
          // so ONLY direct lights (point/beam lights) can illuminate the cave walls.
          obj.material.onBeforeCompile = (shader: any) => {
            // Reset irradiance (ambient/hemisphere) to zero after it's calculated
            shader.fragmentShader = shader.fragmentShader.replace(
              `#include <lights_fragment_begin>`,
              `
              #include <lights_fragment_begin>
              #if defined( RE_IndirectDiffuse )
                irradiance = vec3(0.0);
              #endif
              `,
            );

            // Custom fog density multiplier (if needed)
            if (receiveSceneFog && sceneFogMultiplier !== 1.0) {
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
            }
          };
          obj.material.needsUpdate = true;
        }
      });

      arr.push(clone);
    }

    return arr;
  }, [scene, count, receiveSceneFog, sceneFogMultiplier]);

  // Calculate the actual size of the model from its bounding box
  const modelDimensions = useMemo(() => {
    if (!scene) return { x: 100, y: 100, z: 100, centerY: 0 };
    const box = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    box.getSize(size);
    const center = new THREE.Vector3();
    box.getCenter(center);
    return { x: size.x, y: size.y, z: size.z, centerY: center.y };
  }, [scene]);

  const modelSizeZ = modelDimensions.z;

  if (!instances.length) return null;

  // Slight overlap so they go a little into each other (no gaps)
  const overlap = 2;
  const stepZ = -(modelSizeZ - overlap);

  // Calculate the dimensions for the black outer box to match the cave size
  const boxWidth = modelDimensions.x + 2; // Small buffer
  const boxHeight = modelDimensions.y + 2;
  const totalLength = Math.abs(count * stepZ) + modelSizeZ;
  const boxCenterZ = (stepZ * (count - 1)) / 2 - modelSizeZ / 2 + overlap;
  const boxCenterY = modelDimensions.centerY;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Black bounding box to block external light */}
      <mesh position={[0, boxCenterY, boxCenterZ]} castShadow receiveShadow>
        <boxGeometry args={[boxWidth, boxHeight, totalLength]} />
        <meshBasicMaterial
          attach="material-0"
          color="black"
          side={THREE.DoubleSide}
        />
        <meshBasicMaterial
          attach="material-1"
          color="black"
          side={THREE.DoubleSide}
        />
        <meshBasicMaterial
          attach="material-2"
          color="black"
          side={THREE.DoubleSide}
        />
        <meshBasicMaterial
          attach="material-3"
          color="black"
          side={THREE.DoubleSide}
        />
        {/* Front face (+Z) is removed so the camera can exit */}
        <meshBasicMaterial attach="material-4" visible={false} />
        <meshBasicMaterial
          attach="material-5"
          color="black"
          side={THREE.DoubleSide}
        />
      </mesh>

      {instances.map((instance, idx) => {
        // Simple sequential placement: each piece at idx * stepZ
        // stepZ is negative (going into -Z), with slight overlap so no gaps appear
        const finalZ = idx * stepZ;

        // Flip every other instance 180° around Y so each pair matches up visually
        // When rot=PI, the model mirrors — but it still occupies [-modelSizeZ, 0] from its origin
        // so no extra position compensation needed; just placing at idx*stepZ works
        const finalRotY = idx % 2 === 1 ? Math.PI : 0;

        return (
          <group
            key={idx}
            position={[0, 0, finalZ]}
            rotation={[0, finalRotY, 0]}
          >
            <primitive object={instance} />
          </group>
        );
      })}
    </group>
  );
}
