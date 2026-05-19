import dynamic from "next/dynamic";

// Dynamically import OceanScene (uses Three.js Water, Theatre.js camera, etc.)
const OceanScene = dynamic(() => import("../ocean/OceanScene"), { ssr: false });

// Dynamically import CaveScene (uses Three.js models, VolumetricSmoke, etc.)
const CaveScene = dynamic(() => import("../cave/CaveScene"), { ssr: false });

export type SceneId = "ocean" | "cave";

export const SCENES: Partial<Record<SceneId, any>> = {
  // ocean: OceanScene,
  cave: CaveScene,
};
/**
 * SCENE_FLOW defines the playback order of scenes.
 * By mapping a SceneId to the next SceneId, we can easily change
 * the transition logic and support non-linear paths in the future.
 */
export const SCENE_FLOW: Partial<Record<SceneId, SceneId | null>> = {
  // ocean: "cave",
  cave: null,
};

export function preloadScenes() {
  Object.values(SCENES).forEach((Scene) => {
    if (typeof Scene.preload === "function") {
      Scene.preload();
    }
  });
}
