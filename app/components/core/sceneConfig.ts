import dynamic from "next/dynamic";
import type { SceneId } from "./useSceneStore";
import type { ComponentType } from "react";

export type { SceneId };

type SceneProps = {
  isActive: boolean;
  isVisible: boolean;
};

const CaveScene = dynamic<SceneProps>(() => import("../cave/CaveScene"), {
  ssr: false,
});
const PalaceScene = dynamic<SceneProps>(() => import("../palace/PalaceScene"), {
  ssr: false,
});
const OceanScene = dynamic<SceneProps>(() => import("../ocean/OceanScene"), {
  ssr: false,
});

export const SCENES: Record<SceneId, ComponentType<SceneProps>> = {
  cave: CaveScene,
  palace: PalaceScene,
  ocean: OceanScene,
};
