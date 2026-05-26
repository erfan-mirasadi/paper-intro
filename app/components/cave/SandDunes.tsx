import * as THREE from "three";
import React, { useEffect } from "react";
import { useGLTF, Instances, Instance } from "@react-three/drei";
import { ThreeElements } from "@react-three/fiber";
import { GLTF } from "three-stdlib";

type GLTFResult = GLTF & {
  nodes: {
    Plane: THREE.Mesh;
  };
  materials: {
    sand: THREE.MeshStandardMaterial;
  };
};

export default function SandDunes(props: ThreeElements["group"]) {
  const { nodes, materials } = useGLTF(
    "/assets/cave/sand-opt.glb",
  ) as unknown as GLTFResult;

  // Optional: modify material if necessary
  useEffect(() => {
    if (materials.sand) {
      materials.sand.color.set("#f1be8b");
      materials.sand.roughness = 1;
      materials.sand.metalness = 0;
    }
  }, [materials]);

  // Adjust these offsets to get the exact stair-like layered effect without gaps
  const yOffset = -15; // vertical step
  const zOffset = -15; // horizontal step (assuming moving backwards/into the scene)
  const xOffset = 380; // horizontal spread along X-axis (assuming plane is ~400 units wide at scale 200)

  return (
    <group {...props} dispose={null}>
      <Instances
        range={81}
        material={materials.sand}
        geometry={nodes.Plane.geometry}
      >
        {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((rowIndex) => {
          // Shift each row in the Z-axis by 380 units to create depth
          const shiftZ = rowIndex * 380;
          // Lower the outer rows compared to the center
          const dropY = Math.abs(rowIndex) * -20; // 20 units lower per step from center

          return (
            <React.Fragment key={rowIndex}>
              {[-4, -3, -2, -1, 0, 1, 2, 3, 4].map((colIndex) => {
                const step = colIndex + 1;
                return (
                  <Instance
                    key={colIndex}
                    position={[
                      colIndex * xOffset,
                      0.882 + yOffset * step + dropY,
                      zOffset * step + shiftZ,
                    ]}
                    scale={200}
                  />
                );
              })}
            </React.Fragment>
          );
        })}
      </Instances>
    </group>
  );
}

useGLTF.preload("/assets/cave/sand-opt.glb");
