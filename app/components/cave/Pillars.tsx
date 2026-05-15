"use client";

import { useRef, useEffect, useMemo } from "react";
import * as THREE from "three";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGLTF } from "@react-three/drei";

const PILLARS_URL = "/assets/cave/pillars-opt.glb";

export default function CavePillars(props: any) {
  const gl = useThree((state) => state.gl);

  const { nodes: originalNodes } = useGLTF(
    PILLARS_URL,
    true,
    true,
    (loader: any) => {
      loader.setKTX2Loader(getSharedKTX2Loader(gl));
      loader.setDRACOLoader(getSharedDRACOLoader());
      if (MeshoptDecoder) {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
    },
  );

  const pillarRef = useRef<THREE.InstancedMesh>(null);
  const blockRef = useRef<THREE.InstancedMesh>(null);

  const count = 50; // per side
  const total = count * 2;
  const spacing = 4; // distance between pillars
  const width = 12; // width of the path between the two rows of pillars

  const modelData = useMemo(() => {
    if (!originalNodes) return null;

    const nodes: any = {};
    const materials: any = {};

    // We traverse originalNodes if it's accessible or we just pull the needed nodes directly
    // useGLTF returns `nodes` which is a flat object of all nodes in the gltf
    Object.values(originalNodes).forEach((obj: any) => {
      if (obj.name) nodes[obj.name] = obj;
      if (obj.material) {
        if (!materials[obj.material.name || obj.name]) {
          const mat = new THREE.MeshStandardMaterial({
            color: new THREE.Color(0.9, 0.9, 0.9),
            map: obj.material.map,
            roughness: 0.3,
            metalness: 0.2,
            envMapIntensity: 1.5,
            transparent: obj.material.transparent,
            opacity: obj.material.opacity,
            side: THREE.DoubleSide,
          });
          materials[obj.material.name || obj.name] = mat;
        }
        obj.material = materials[obj.material.name || obj.name];
      }
    });

    return { nodes, materials };
  }, [originalNodes]);

  useEffect(() => {
    if (!modelData || !pillarRef.current || !blockRef.current) return;

    const dummy = new THREE.Object3D();

    const meshLocalMatrixPillar = new THREE.Matrix4().compose(
      new THREE.Vector3(-0.021, 2.163, 0),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, -3.142),
      ),
      new THREE.Vector3(2.163, 2.163, 2.163),
    );

    const meshLocalMatrixBlock = new THREE.Matrix4().compose(
      new THREE.Vector3(0.001, 2.667, 0.004),
      new THREE.Quaternion().setFromEuler(
        new THREE.Euler(-Math.PI / 2, 0, -3.142),
      ),
      new THREE.Vector3(2.878, 2.878, 2.878),
    );

    let idx = 0;
    for (let i = 0; i < count; i++) {
      const zOffset = i * spacing;

      const sides = [-1, 1];
      for (const side of sides) {
        dummy.position.set(side * (width / 2), 0, zOffset);
        // Face each other: left side (side=-1) faces right (+x) -> rotation y = Math.PI/2
        // right side (side=1) faces left (-x) -> rotation y = -Math.PI/2
        dummy.rotation.set(0, side === -1 ? Math.PI / 2 : -Math.PI / 2, 0);
        dummy.updateMatrix();

        const finalMatrixPillar = dummy.matrix
          .clone()
          .multiply(meshLocalMatrixPillar);
        pillarRef.current.setMatrixAt(idx, finalMatrixPillar);

        const finalMatrixBlock = dummy.matrix
          .clone()
          .multiply(meshLocalMatrixBlock);
        blockRef.current.setMatrixAt(idx, finalMatrixBlock);

        idx++;
      }
    }

    pillarRef.current.instanceMatrix.needsUpdate = true;
    blockRef.current.instanceMatrix.needsUpdate = true;
  }, [count, spacing, width, modelData]);

  if (!modelData) return null;

  const { nodes } = modelData;
  const pillarGeo = nodes.AncientPillar_01_AncientPillar_0?.geometry;
  const blockGeo = nodes.AncientBlock_02_AncientBlocks_0?.geometry;

  if (!pillarGeo || !blockGeo) {
    // Fallback if node names are different
    console.warn("Could not find expected node names in pillars model");
    return null;
  }

  // We can just use the materials assigned to the nodes directly
  const pillarMat = nodes.AncientPillar_01_AncientPillar_0.material;
  const blockMat = nodes.AncientBlock_02_AncientBlocks_0.material;

  return (
    <group {...props} dispose={null}>
      <ambientLight intensity={2.5} />
      <instancedMesh ref={pillarRef} args={[pillarGeo, pillarMat, total]} />
      <instancedMesh ref={blockRef} args={[blockGeo, blockMat, total]} />
    </group>
  );
}
