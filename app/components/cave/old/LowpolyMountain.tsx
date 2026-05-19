// "use client";

// import { useMemo } from "react";
// import { useThree } from "@react-three/fiber";
// import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
// import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
// import * as THREE from "three";
// import { useGLTF } from "@react-three/drei";

// const LOWPOLY_MOUNTAIN_URL = "/assets/cave/lowpoly_mountain.glb";

// interface LowpolyMountainProps {
//   position?: [number, number, number];
//   rotation?: [number, number, number];
//   scale?: number | [number, number, number];
// }

// export default function LowpolyMountain({
//   position = [0, 0, 0],
//   rotation = [0, 0, 0],
//   scale = 1,
// }: LowpolyMountainProps) {
//   const gl = useThree((state) => state.gl);

//   const { scene } = useGLTF(LOWPOLY_MOUNTAIN_URL, true, true, (loader: any) => {
//     loader.setKTX2Loader(getSharedKTX2Loader(gl));
//     loader.setDRACOLoader(getSharedDRACOLoader());
//     if (MeshoptDecoder) {
//       loader.setMeshoptDecoder(MeshoptDecoder);
//     }
//   });

//   const sceneClone = useMemo(() => {
//     if (!scene) return null;
//     const clone = scene.clone();

//     clone.traverse((obj: any) => {
//       if (obj.isMesh && obj.material) {
//         obj.material = new THREE.MeshStandardMaterial({
//           color: new THREE.Color(0.8, 0.8, 0.8),
//           map: obj.material.map,
//           roughness: 0.9,
//           metalness: 0.1,
//           transparent: true,
//           opacity: 1.0,
//           side: THREE.DoubleSide,
//         });
//         obj.material.fog = true;
//         obj.material.needsUpdate = true;

//         if (obj.geometry && !obj.geometry.attributes.normal) {
//           obj.geometry.computeVertexNormals();
//         }
//       }
//     });

//     return clone;
//   }, [scene]);

//   if (!sceneClone) return null;

//   return (
//     <group position={position} rotation={rotation} scale={scale}>
//       <primitive object={sceneClone} />
//     </group>
//   );
// }
