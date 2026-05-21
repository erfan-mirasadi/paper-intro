"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type Vec3 = [number, number, number];

type ModelTransform = {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
};

interface IdolsProps {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  idol1?: ModelTransform;
  idol2?: ModelTransform;
  idol3?: ModelTransform;
  idol4?: ModelTransform;
}

const IDOL_1_URL = "/assets/palace/idols/idol-1.glb";
const IDOL_2_URL = "/assets/palace/idols/idol-2.glb";
const IDOL_3_URL = "/assets/palace/idols/idol-3.glb";
const IDOL_4_URL = "/assets/palace/idols/idol-4.glb";

const DEFAULT_TRANSFORM: Required<ModelTransform> = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

export default function Idols({
  position,
  rotation,
  scale,
  idol1,
  idol2,
  idol3,
  idol4,
}: IdolsProps) {
  const gl = useThree((state) => state.gl);
  const [idol1Data, idol2Data, idol3Data, idol4Data] = useGLTF(
    [IDOL_1_URL, IDOL_2_URL, IDOL_3_URL, IDOL_4_URL],
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

  const idol1Transform = { ...DEFAULT_TRANSFORM, ...idol1 };
  const idol2Transform = { ...DEFAULT_TRANSFORM, ...idol2 };
  const idol3Transform = { ...DEFAULT_TRANSFORM, ...idol3 };
  const idol4Transform = { ...DEFAULT_TRANSFORM, ...idol4 };

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive
        object={idol1Data.scene}
        position={idol1Transform.position}
        rotation={idol1Transform.rotation}
        scale={idol1Transform.scale}
      />
      <primitive
        object={idol2Data.scene}
        position={idol2Transform.position}
        rotation={idol2Transform.rotation}
        scale={idol2Transform.scale}
      />
      <primitive
        object={idol3Data.scene}
        position={idol3Transform.position}
        rotation={idol3Transform.rotation}
        scale={idol3Transform.scale}
      />
      <primitive
        object={idol4Data.scene}
        position={idol4Transform.position}
        rotation={idol4Transform.rotation}
        scale={idol4Transform.scale}
      />
    </group>
  );
}
