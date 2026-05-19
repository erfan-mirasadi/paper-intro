import dynamic from "next/dynamic";

// Dynamically import PalaceScene (instanced model, marble floor, white fog)
const PalaceScene = dynamic(() => import("../palace/PalaceScene"), {
  ssr: false,
});

// const OceanScene = dynamic(() => import("../ocean/OceanScene"), { ssr: false });
// const CaveScene = dynamic(() => import("../cave/CaveScene"), { ssr: false });

export type SceneId = "palace";
// export type SceneId = "palace" | "ocean" | "cave";

export const SCENES: Partial<Record<SceneId, any>> = {
  palace: PalaceScene,
  // cave: CaveScene,
  // ocean: OceanScene,
};
/**
 * SCENE_FLOW defines the playback order of scenes.
 * By mapping a SceneId to the next SceneId, we can easily change
 * the transition logic and support non-linear paths in the future.
 */
export const SCENE_FLOW: Partial<Record<SceneId, SceneId | null>> = {
  palace: null,
  // cave: "ocean",
  // ocean: null,
};

export function preloadScenes() {
  Object.values(SCENES).forEach((Scene) => {
    if (typeof Scene.preload === "function") {
      Scene.preload();
    }
  });
}
