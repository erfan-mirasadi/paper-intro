"use client";
import { useState, useEffect, useCallback, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { Stats } from "@react-three/drei";
import { PerspectiveCamera as TheatrePerspectiveCamera } from "@theatre/r3f";
import CaveModel from "./CaveModel";
import AnimatedFog from "../environment/AnimatedFog";
import SceneTransition from "../core/SceneTransition";
import SweepRevealWrapper from "../environment/SweepRevealWrapper";
import DesertDust from "./DesertDust";
import CenterDust from "./CenterDust";
import Skybox from "../environment/Skybox";

import { getProject } from "@theatre/core";
import { SheetProvider } from "@theatre/r3f";
import caveProjectState from "../../data/CaveProject.theatre-project-state.json";

// import studio from "@theatre/studio";
// import extension from "@theatre/r3f/dist/extension";

// if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
//   studio.initialize();
//   studio.extend(extension);
// }

const caveProject = getProject("CaveProject", {
  state: caveProjectState as any,
});
const caveSheet = caveProject.sheet("CaveScene");

export default function CaveScene({ onComplete }: { onComplete?: () => void }) {
  const [isReady, setIsReady] = useState(false);
  const [isRevealed, setIsRevealed] = useState(false);
  const [isPlaying, setIsPlaying] = useState(true);
  const [introCompleted, setIntroCompleted] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        setIsPlaying((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    // ADJUST CAMERA SPEED HERE (1 is normal speed, 0.5 is half speed, etc.)
    const CAMERA_SPEED = 0.56;

    if (introCompleted && isPlaying) {
      caveSheet.sequence.play({ iterationCount: 1, rate: CAMERA_SPEED });
    } else {
      caveSheet.sequence.pause();
    }
  }, [isPlaying, introCompleted]);

  useEffect(() => {
    if (!introCompleted) {
      caveSheet.sequence.position = 0;
    }
  }, [introCompleted]);

  useEffect(() => {
    return () => {
      caveSheet.sequence.pause();
    };
  }, []);

  const theatreCamRef = useRef<THREE.PerspectiveCamera>(null);

  const handleSceneReady = useCallback(() => {
    setIsReady(true);
  }, []);

  return (
    <SceneTransition
      isReady={isReady}
      isExiting={false}
      introHoldMs={3000}
      exitHoldMs={0}
      onIntroComplete={() => {
        setIntroCompleted(true);
      }}
      onExitComplete={onComplete}
    >
      <SceneReadySignal onReady={handleSceneReady} />
      <SheetProvider sheet={caveSheet}>
        <group>
          <CameraRig theatreCamRef={theatreCamRef} />
          <TheatrePerspectiveCamera
            theatreKey="Camera"
            ref={theatreCamRef}
            makeDefault={false}
            position={[0, 1, -48]}
            rotation={[0, Math.PI, 0]}
            fov={45}
            near={0.1}
            far={10000}
          />

          <Stats />

          <SweepRevealWrapper
            // epicenter={[0, 0, -100]}
            maxRadius={300}
            speed={60}
            mode="overlay"
            autoTriggerDelay={introCompleted ? 1000 : undefined}
            onRevealStart={() => setIsRevealed(true)}
          >
            <CaveModel />
          </SweepRevealWrapper>

          <DesertDust />
          <CenterDust />

          <AnimatedFog color={"#c0a382"} maxDensity={0.015} />
          <Skybox
            image="/assets/cave/sunset.jpg"
            showMoon={false}
            environmentFile="/assets/cave/desert-HDR_2k.hdr"
            skyPosition={[0, -0.76, 0]}
            skyRotation={[0, -0.5, 0]}
            skyScale={[3, 1, 3]}
            distance={1}
          />
          <ambientLight intensity={isRevealed ? 1 : 0.1} />
        </group>
      </SheetProvider>
    </SceneTransition>
  );
}

function SceneReadySignal({ onReady }: { onReady: () => void }) {
  useEffect(() => {
    onReady();
  }, [onReady]);

  return null;
}

function CameraRig({
  theatreCamRef,
}: {
  theatreCamRef: React.RefObject<THREE.PerspectiveCamera | null>;
}) {
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));

  useFrame((state) => {
    const { pointer, camera } = state;
    if (!theatreCamRef.current) return;

    camera.position.copy(theatreCamRef.current.position);
    camera.quaternion.copy(theatreCamRef.current.quaternion);

    if (
      camera instanceof THREE.PerspectiveCamera &&
      theatreCamRef.current instanceof THREE.PerspectiveCamera
    ) {
      let needsUpdate = false;
      if (camera.near !== theatreCamRef.current.near) {
        camera.near = theatreCamRef.current.near;
        needsUpdate = true;
      }
      if (camera.far !== 10000) {
        camera.far = 10000;
        needsUpdate = true;
      }
      if (needsUpdate) {
        camera.updateProjectionMatrix();
      }
    }

    // Apply the Parallax offset based on mouse position
    const maxPan = 0.4;
    const maxTilt = 0.4;

    targetOffset.current.x = -pointer.x * maxPan;
    targetOffset.current.y = pointer.y * maxTilt;

    currentOffset.current.lerp(targetOffset.current, 0.05);

    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);
  });

  return null;
}
