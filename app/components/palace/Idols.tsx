"use client";

import { useGLTF } from "@react-three/drei";
import { useThree } from "@react-three/fiber";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import { useEffect } from "react";
import type { Ref } from "react";
import type { Object3D } from "three";

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
  idolRefs?: {
    idol1?: Ref<Object3D>;
    idol2?: Ref<Object3D>;
    idol3?: Ref<Object3D>;
    idol4?: Ref<Object3D>;
  };
}

const IDOL_1_URL = "/assets/palace/idols/idol-1-opt.glb";
const IDOL_2_URL = "/assets/palace/idols/idol-2.glb";
const IDOL_3_URL = "/assets/palace/idols/idol-3.glb";
const IDOL_4_URL = "/assets/palace/idols/idol-4-opt.glb";

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
  idolRefs,
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
    },
  );

  const idol1Transform = { ...DEFAULT_TRANSFORM, ...idol1 };
  const idol2Transform = { ...DEFAULT_TRANSFORM, ...idol2 };
  const idol3Transform = { ...DEFAULT_TRANSFORM, ...idol3 };
  const idol4Transform = { ...DEFAULT_TRANSFORM, ...idol4 };

  useEffect(() => {
    const applyMetallic = (scene: any) => {
      if (!scene) return;
      scene.traverse((child: any) => {
        if (child.isMesh && child.material) {
          child.material.metalness = 0.4;
          child.material.roughness = 0.8;
          child.material.needsUpdate = true;
        }
      });
    };

    applyMetallic(idol1Data?.scene);
    applyMetallic(idol2Data?.scene);
    applyMetallic(idol3Data?.scene);
    applyMetallic(idol4Data?.scene);
  }, [idol1Data, idol2Data, idol3Data, idol4Data]);

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive
        ref={idolRefs?.idol1}
        object={idol1Data.scene}
        position={idol1Transform.position}
        rotation={idol1Transform.rotation}
        scale={idol1Transform.scale}
      />
      <primitive
        ref={idolRefs?.idol2}
        object={idol2Data.scene}
        position={idol2Transform.position}
        rotation={idol2Transform.rotation}
        scale={idol2Transform.scale}
      />
      <primitive
        ref={idolRefs?.idol3}
        object={idol3Data.scene}
        position={idol3Transform.position}
        rotation={idol3Transform.rotation}
        scale={idol3Transform.scale}
      />
      <primitive
        ref={idolRefs?.idol4}
        object={idol4Data.scene}
        position={idol4Transform.position}
        rotation={idol4Transform.rotation}
        scale={idol4Transform.scale}
      />
    </group>
  );
}
