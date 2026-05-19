"use client";

import { useEffect, useMemo, useRef } from "react";
import { useGLTF } from "@react-three/drei";
import * as THREE from "three";

const PALACE_URL = "/assets/palace/palace-v02-opt.glb";
const INSTANCE_COUNT = 2;

interface PalaceModelProps {
  spacing?: number;
  overlapFactor?: number;
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function PalaceModel({
  spacing,
  overlapFactor = 0.985,
  position,
  rotation,
  scale,
}: PalaceModelProps) {
  const { scene } = useGLTF(PALACE_URL);
  const meshRefs = useRef<THREE.InstancedMesh[]>([]);

  const meshes = useMemo(() => {
    scene.updateMatrixWorld(true);
    const rootInverse = new THREE.Matrix4().copy(scene.matrixWorld).invert();
    const collected: Array<{ mesh: THREE.Mesh; baseMatrix: THREE.Matrix4 }> =
      [];

    scene.traverse((obj) => {
      if ((obj as THREE.Mesh).isMesh) {
        const mesh = obj as THREE.Mesh;
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

  return (
    <group position={position} rotation={rotation} scale={scale}>
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

useGLTF.preload(PALACE_URL);
