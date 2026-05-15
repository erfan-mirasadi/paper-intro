"use client";

import { useState, Suspense, useCallback, useEffect } from "react";
import type { ComponentType } from "react";
import { OrbitControls, Stats } from "@react-three/drei";
import { SCENES, SCENE_FLOW, preloadScenes } from "./sceneConfig";
import type { SceneId } from "./sceneConfig";
import LightBeam from "../environment/LightBeam";
import { TransitionProvider } from "./TransitionController";

const IS_DEV_MODE = false;
const TARGET_DEV_SCENE_ID: SceneId = "cave";

export interface SceneProps {
  onComplete?: (nextScene?: SceneId) => void;
}

export default function SceneManager() {
  const [activeSceneId, setActiveSceneId] = useState<SceneId>("ocean");

  // Added handler to switch scenes dynamically or strictly via flow
  const handleSceneComplete = useCallback(
    (nextScene?: SceneId) => {
      if (nextScene && SCENES[nextScene]) {
        setActiveSceneId(nextScene);
      } else {
        const nextInFlow = SCENE_FLOW[activeSceneId];
        if (nextInFlow) {
          setActiveSceneId(nextInFlow);
        }
      }
    },
    [activeSceneId],
  );

  useEffect(() => {
    preloadScenes();
  }, []);

  if (IS_DEV_MODE) {
    const DevScene = SCENES[TARGET_DEV_SCENE_ID];
    return (
      <TransitionProvider>
        <DevSceneLayer DevScene={DevScene} />
      </TransitionProvider>
    );
  }

  const ActiveScene = SCENES[activeSceneId];

  return (
    <TransitionProvider>
      <SceneLayer ActiveScene={ActiveScene} onComplete={handleSceneComplete} />
    </TransitionProvider>
  );
}

function SceneLayer({
  ActiveScene,
  onComplete,
}: {
  ActiveScene: ComponentType<any>;
  onComplete: (nextScene?: SceneId) => void;
}) {
  return (
    <>
      <LightBeam />
      <Suspense fallback={null}>
        <ActiveScene onComplete={onComplete} />
      </Suspense>
    </>
  );
}

function DevSceneLayer({ DevScene }: { DevScene: ComponentType<any> }) {
  return (
    <>
      <LightBeam />
      <Suspense fallback={null}>
        <OrbitControls makeDefault />
        <Stats />
        <DevScene />
      </Suspense>
    </>
  );
}
