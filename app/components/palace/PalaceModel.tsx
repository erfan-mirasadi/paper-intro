"use client";

import { useEffect, useMemo, useRef, useCallback } from "react";
import { useGLTF } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

const PALACE_URL = "/assets/palace/palace-v02-opt.glb";
const INSTANCE_COUNT = 2;
// This controls how much of the second instance is kept (e.g., 0.25 means keep 25%)
const KEEP_FRACTION = 0.22;

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
  const loadExtensions = useCallback(
    (loader: any) => {
      loader.setKTX2Loader(getSharedKTX2Loader(gl));
      loader.setDRACOLoader(getSharedDRACOLoader());
      if (MeshoptDecoder) {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
    },
    [gl],
  );

  const { scene } = useGLTF(PALACE_URL, true, true, loadExtensions);
  const meshRefs = useRef<THREE.InstancedMesh[]>([]);

  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const collected: Array<{ mesh: THREE.Mesh; baseMatrix: THREE.Matrix4 }> =
      [];

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
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
  const clipPlaneRef = useRef(new THREE.Plane(new THREE.Vector3(0, 0, 1), 0));

  useEffect(() => {
    // Assign clipping plane once
    meshes.forEach(({ mesh }) => {
      const mat = mesh.material as THREE.Material;
      mat.clippingPlanes = [clipPlaneRef.current];
      mat.clipShadows = true;
      mat.needsUpdate = true; // Only needs update once to compile with clipping planes
    });
  }, [meshes]);

  useFrame(() => {
    if (groupRef.current) {
      const resolvedSpacing = (spacing ?? autoSpacing) * overlapFactor;
      const cutZ =
        -resolvedSpacing + autoSpacing / 2 - autoSpacing * KEEP_FRACTION;
      const constant = -cutZ;

      // Update the existing plane without triggering shader recompilation
      clipPlaneRef.current.set(new THREE.Vector3(0, 0, 1), constant);
      clipPlaneRef.current.applyMatrix4(groupRef.current.matrixWorld);
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
