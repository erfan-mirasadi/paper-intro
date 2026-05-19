"use client";

import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useGLTF, Center } from "@react-three/drei";

const CAVE_SCENE_URL = "/assets/cave/cave-scene-2-opt.glb";
const MOUNTAIN_URL = "/assets/cave/mountain-opt.glb";

interface CaveModelProps {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
}

export default function CaveModel({
  position = [0, 0, 0],
  rotation = [0, 0, 0],
  scale = 1,
}: CaveModelProps) {
  const gl = useThree((state) => state.gl);

  const [caveData, mountainData] = useGLTF(
    [CAVE_SCENE_URL, MOUNTAIN_URL],
    true,
    true,
    (loader: any) => {
      loader.setKTX2Loader(getSharedKTX2Loader(gl));
      loader.setDRACOLoader(getSharedDRACOLoader());
      if (MeshoptDecoder) {
        loader.setMeshoptDecoder(MeshoptDecoder);
      }
    }
  );

  return (
    <Center position={position} rotation={rotation} scale={scale}>
      <group>
        <primitive object={caveData.scene} />
        <primitive object={mountainData.scene} />
      </group>
    </Center>
  );
}

