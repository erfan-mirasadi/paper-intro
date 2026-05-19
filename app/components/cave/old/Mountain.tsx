"use client";

import { useMemo } from "react";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";
import { useGLTF } from "@react-three/drei";

const MOUNTAIN_URL = "/assets/cave/mountain-opt.glb";

interface MountainProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  children?: React.ReactNode;
  // Custom props to carve a hole
  cutoutPosition?: [number, number, number];
  cutoutRadius?: number;
}

export default function Mountain({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
  cutoutPosition = [0, 0, 0],
  cutoutRadius = 0,
  children,
}: MountainProps) {
  const gl = useThree((state) => state.gl);

  const { scene } = useGLTF(MOUNTAIN_URL, true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });

  // Inject a custom shader to discard mountain pixels that overlap with the cave entrance
  useMemo(() => {
    if (!scene) return;

    scene.traverse((child: any) => {
      if (child.isMesh && child.material) {
        // Setup the shader injection only once per material
        if (!child.material.userData.isCutoutModified) {
          child.material = child.material.clone();
          child.material.userData.isCutoutModified = true;

          // Store uniforms so they can be updated dynamically if props change
          child.material.userData.cutoutPosition = {
            value: new THREE.Vector3(...cutoutPosition),
          };
          child.material.userData.cutoutRadius = {
            value: cutoutRadius,
          };

          child.material.onBeforeCompile = (shader: any) => {
            shader.uniforms.uCutoutPosition =
              child.material.userData.cutoutPosition;
            shader.uniforms.uCutoutRadius =
              child.material.userData.cutoutRadius;

            // Add varying for world position
            shader.vertexShader = shader.vertexShader.replace(
              `#include <common>`,
              `#include <common>
               varying vec3 vWorldPos;`,
            );

            // Calculate exact world position
            shader.vertexShader = shader.vertexShader.replace(
              `#include <worldpos_vertex>`,
              `#include <worldpos_vertex>
               vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;`,
            );

            // Receive in fragment shader
            shader.fragmentShader = shader.fragmentShader.replace(
              `#include <common>`,
              `#include <common>
               uniform vec3 uCutoutPosition;
               uniform float uCutoutRadius;
               varying vec3 vWorldPos;`,
            );

            // Discard fragments within the radius of the cutout position
            shader.fragmentShader = shader.fragmentShader.replace(
              `void main() {`,
              `void main() {
                 if (uCutoutRadius > 0.0 && distance(vWorldPos, uCutoutPosition) < uCutoutRadius) {
                   discard;
                 }`,
            );
          };
        } else {
          // Update existing uniforms safely by assigning a new Vector3 to avoid type stripping
          child.material.userData.cutoutPosition.value = new THREE.Vector3(
            ...cutoutPosition,
          );
          child.material.userData.cutoutRadius.value = cutoutRadius;
        }
      }
    });
  }, [scene, cutoutPosition, cutoutRadius]);

  const { width, leftClone, rightClone, bottomRightClone, center } =
    useMemo(() => {
      if (!scene)
        return {
          width: 0,
          leftClone: null,
          rightClone: null,
          center: new THREE.Vector3(),
        };

      // Compute bounds only from meshes to avoid invisible objects/padding
      const box = new THREE.Box3();
      scene.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          box.expandByObject(child);
        }
      });

      const size = new THREE.Vector3();
      box.getSize(size);
      const center = new THREE.Vector3();
      box.getCenter(center);

      // Create clones for the additional instances
      return {
        width: size.x,
        leftClone: scene.clone(),
        rightClone: scene.clone(),
        bottomRightClone: scene.clone(),
        center,
      };
    }, [scene]);

  const parentScale = Array.isArray(scale) ? scale : [scale, scale, scale];
  const sx = parentScale[0] ?? 1;
  const sy = parentScale[1] ?? 1;
  const sz = parentScale[2] ?? 1;

  if (!scene) return null;

  const offset: [number, number, number] = [-center.x, -center.y, -center.z];
  // Add a significant overlap (e.g. 20%) to ensure they are tightly packed
  const overlapFactor = 0.5;
  const spacing = width * overlapFactor;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      {/* Center Mountain */}
      <group>
        <primitive object={scene} position={offset} />
      </group>

      {/* Left Mountain - rotated 180deg to fit */}
      {leftClone && (
        <group
          position={[-spacing, 2, 0]}
          rotation={[0, Math.PI * 2, 0]}
          scale={[1, 0.7, 1]}
        >
          <primitive object={leftClone} position={offset} />
        </group>
      )}

      {/* Right Mountain - rotated 180deg to fit */}
      {rightClone && (
        <group position={[spacing, -5, -10]} rotation={[0.1, Math.PI * 2, 0]}>
          <group scale={[2.5, 2.5, 1]}>
            <primitive object={rightClone} position={offset} />
          </group>
          {/* Plant the cave inside this mountain without distorting it */}
          <group scale={[1 / sx, 1 / sy, 1 / sz]} position={[0, 5, 0]}>
            <group scale={[sx, sx, sx]}>{children}</group>
          </group>
        </group>
      )}

      {/* Bottom Right Mountain */}
      {bottomRightClone && (
        <group
          position={[spacing + 50, -5, 0]}
          rotation={[0.1, Math.PI * 2, 0]}
          scale={[2.5, 0.5, 1.2]}
        >
          <primitive object={bottomRightClone} position={offset} />
        </group>
      )}
    </group>
  );
}
