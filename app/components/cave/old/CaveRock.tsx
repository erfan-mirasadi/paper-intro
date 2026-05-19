// "use client";

// import { useMemo } from "react";
// import { useThree } from "@react-three/fiber";
// import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
// import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
// import * as THREE from "three";
// import { useGLTF } from "@react-three/drei";

// const ROCK_URL = "/assets/cave/rock-opt.glb";

// interface CaveRockProps {
//   position?: [number, number, number];
//   rotation?: [number, number, number];
//   scale?: number | [number, number, number];
// }

// export default function CaveRock({
//   position = [0, 0, 0],
//   rotation = [0, 0, 0],
//   scale = 1,
// }: CaveRockProps) {
//   const gl = useThree((state) => state.gl);

//   const { scene } = useGLTF(ROCK_URL, true, true, (loader: any) => {
//     loader.setKTX2Loader(getSharedKTX2Loader(gl));
//     loader.setDRACOLoader(getSharedDRACOLoader());
//     if (MeshoptDecoder) {
//       loader.setMeshoptDecoder(MeshoptDecoder);
//     }
//   });

//   const { rockClones, size, center } = useMemo(() => {
//     if (!scene) {
//       return {
//         rockClones: [],
//         size: new THREE.Vector3(),
//         center: new THREE.Vector3(),
//       };
//     }

//     // Compute bounding box to know exact size for stacking
//     const box = new THREE.Box3();
//     scene.traverse((child) => {
//       if (child instanceof THREE.Mesh) {
//         box.expandByObject(child);
//       }
//     });

//     const size = new THREE.Vector3();
//     box.getSize(size);
//     const center = new THREE.Vector3();
//     box.getCenter(center);

//     // Create 3 separate clones
//     const clone1 = scene.clone();
//     const clone2 = scene.clone();
//     const clone3 = scene.clone();

//     const clones = [clone1, clone2, clone3];

//     // Configure materials on all clones to look premium and consistent
//     clones.forEach((clone) => {
//       clone.traverse((obj: any) => {
//         if (obj.isMesh && obj.material) {
//           obj.material = obj.material.clone();
//           obj.material.roughness = 0.85;
//           obj.material.metalness = 0.15;
//           obj.material.envMapIntensity = 2.0;
//           obj.material.side = THREE.DoubleSide;
//           obj.material.fog = true;
//           obj.material.needsUpdate = true;
//           obj.renderOrder = 2; // Always render on top of the cave
//         }
//       });
//     });

//     return { rockClones: clones, size, center };
//   }, [scene]);

//   if (!scene || rockClones.length < 3) return null;

//   // Offset to center the rock geometry locally
//   const offset: [number, number, number] = [-center.x, -center.y, -center.z];

//   // We want:
//   // - 2 rocks stacked on top of each other (Rock 1 at the bottom, Rock 2 on top)
//   // - 1 rock next to them (Rock 3)

//   // Let's specify exact spacing and overlap factors for realistic stacking
//   const height = size.y;
//   const width = size.x;
//   const depth = size.z;

//   // Rock 1: Base rock (at 0,0,0 locally)
//   const rock1Position: [number, number, number] = [0, 0, 0];
//   const rock1Rotation: [number, number, number] = [0, 0, 0];
//   const rock1Scale: [number, number, number] = [1, 1, 1];

//   // Rock 2: Stacked on top of Rock 1
//   // We place it at y = height * 0.75 for a natural nested look, slightly rotated
//   const rock2Position: [number, number, number] = [
//     0.05 * width,
//     height * 0.72,
//     0.05 * depth,
//   ];
//   const rock2Rotation: [number, number, number] = [0.15, -Math.PI / 4, -0.1];
//   const rock2Scale: [number, number, number] = [0.85, 0.8, 0.85]; // Slightly smaller to look natural

//   // Rock 3: Next to them
//   // We place it at x = width * 1.1, slightly rotated
//   const rock3Position: [number, number, number] = [
//     width * -0.2,
//     1.3 * height,
//     -1.5 * depth,
//   ];
//   const rock3Rotation: [number, number, number] = [-0.1, Math.PI / 4, 0.15];
//   const rock3Scale: [number, number, number] = [1.1, 0.95, 1.1]; // Slightly different scale for organic variation

//   return (
//     <group position={position} rotation={rotation} scale={scale}>
//       {/* Rock 1: Base */}
//       <group
//         position={rock1Position}
//         rotation={rock1Rotation}
//         scale={rock1Scale}
//       >
//         <primitive object={rockClones[0]} position={offset} />
//       </group>

//       {/* Rock 2: Stacked on top */}
//       <group
//         position={rock2Position}
//         rotation={rock2Rotation}
//         scale={rock2Scale}
//       >
//         <primitive object={rockClones[1]} position={offset} />
//       </group>

//       {/* Rock 3: Next to them */}
//       <group
//         position={rock3Position}
//         rotation={rock3Rotation}
//         scale={rock3Scale}
//       >
//         <primitive object={rockClones[2]} position={offset} />
//       </group>
//     </group>
//   );
// }
