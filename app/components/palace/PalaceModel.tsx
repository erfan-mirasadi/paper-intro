"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const PALACE_URL = "/assets/palace/palace-v02-opt.glb";
const INSTANCE_COUNT = 2;
// This controls how much of the second instance is kept (e.g., 0.25 means keep 25%)
const KEEP_FRACTION = 0.18;

interface PalaceModelProps {
  spacing?: number;
  overlapFactor?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function PalaceModel({
  spacing,
  overlapFactor = 0.975,
  position,
  rotation,
  scale,
}: PalaceModelProps) {
  const gl = useThree((state) => state.gl);
  const { scene } = useGLTF(PALACE_URL, true, true, (loader: any) => {
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }
  });
  const meshRefs = useRef<THREE.InstancedMesh[]>([]);

  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const collected: Array<{ mesh: THREE.Mesh; baseMatrix: THREE.Matrix4 }> =
      [];

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
        // Clone material so clipping plane doesn't affect other models sharing the material
        if (mesh.material && !mesh.userData.materialCloned) {
          mesh.material = (mesh.material as THREE.Material).clone();
          mesh.userData.materialCloned = true;
        }

        const baseMatrix = new THREE.Matrix4().multiplyMatrices(
          rootInverse,
          mesh.matrixWorld,
        );
        collected.push({ mesh, baseMatrix });
      }
    });

    return collected;
  }, [scene]);

  const autoSpacing = useMemo(() => {
    const bounds = new THREE.Box3().setFromObject(scene);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    return Math.max(1, size.z);
  }, [scene]);

  useEffect(() => {
    const resolvedSpacing = (spacing ?? autoSpacing) * overlapFactor;
    const offsets = [0, -resolvedSpacing];

    meshes.forEach((item, index) => {
      const instanced = meshRefs.current[index];
      if (!instanced) return;

      for (let i = 0; i < INSTANCE_COUNT; i += 1) {
        const offsetMatrix = new THREE.Matrix4().makeTranslation(
          0,
          0,
          offsets[i],
        );

        const instanceMatrix = new THREE.Matrix4().multiplyMatrices(
          offsetMatrix,
          item.baseMatrix,
        );
        instanced.setMatrixAt(i, instanceMatrix);
      }

      instanced.instanceMatrix.needsUpdate = true;
    });
  }, [meshes, spacing, overlapFactor, autoSpacing]);

  const groupRef = useRef<THREE.Group>(null);

  useEffect(() => {
    gl.localClippingEnabled = true;
  }, [gl]);

  useFrame(() => {
    if (groupRef.current) {
      const resolvedSpacing = (spacing ?? autoSpacing) * overlapFactor;

      // The second instance is centered at -resolvedSpacing.
      // Assuming its local origin is at its center, its geometry spans from
      // (-resolvedSpacing + autoSpacing/2) down to (-resolvedSpacing - autoSpacing/2).
      // If KEEP_FRACTION = 0, we cut exactly at its start (-resolvedSpacing + autoSpacing/2).
      // If KEEP_FRACTION = 1, we cut at its end (-resolvedSpacing - autoSpacing/2).
      const cutZ =
        -resolvedSpacing + autoSpacing / 2 - autoSpacing * KEEP_FRACTION;

      // Plane equation: Z + constant > 0 => Z > -constant, so constant = -cutZ
      const constant = -cutZ;
      const localPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), constant);
      localPlane.applyMatrix4(groupRef.current.matrixWorld);

      meshes.forEach(({ mesh }) => {
        const mat = mesh.material as THREE.Material;
        mat.clippingPlanes = [localPlane];
        mat.clipShadows = true;
        mat.needsUpdate = true;
      });
    }
  });

  return (
    <group ref={groupRef} position={position} rotation={rotation} scale={scale}>
      {meshes.map((item, index) => (
        <instancedMesh
          key={index}
          ref={(el) => {
            if (el) meshRefs.current[index] = el;
          }}
          args={[item.mesh.geometry, item.mesh.material, INSTANCE_COUNT]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  );
}
