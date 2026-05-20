/**
 * sceneConfig.ts
 * ──────────────────────────────────────────────────────────────────────────
 * Dynamic imports for all three scenes.
 * Kept as the single source of truth for scene registration.
 * ──────────────────────────────────────────────────────────────────────────
 */
import dynamic from "next/dynamic";
import type { SceneId } from "./useSceneStore";

export type { SceneId };

const CaveScene = dynamic(() => import("../cave/CaveScene"), { ssr: false });
const PalaceScene = dynamic(() => import("../palace/PalaceScene"), {
  ssr: false,
});
const OceanScene = dynamic(() => import("../ocean/OceanScene"), { ssr: false });

export const SCENES: Record<SceneId, any> = {
  cave: CaveScene,
  palace: PalaceScene,
  ocean: OceanScene,
};
