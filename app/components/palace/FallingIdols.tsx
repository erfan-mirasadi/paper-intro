"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { MathUtils } from "three";
import type { Object3D } from "three";
import Idols from "./Idols";

type Vec3 = [number, number, number];

type ModelTransform = {
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
};

interface FallingIdolsProps {
  isActive: boolean;
  position?: Vec3;
  rotation?: Vec3;
  scale?: number | Vec3;
  idol1?: ModelTransform;
  idol2?: ModelTransform;
  idol3?: ModelTransform;
  idol4?: ModelTransform;
  triggerOffset?: number;
  fallDuration?: number;
  fallAngle?: number;
  forwardBend?: number;
  stagger?: number;
}

type IdolFallState = {
  triggered: boolean;
  triggerTime: number;
  delay: number;
  fallSign: number;
  hitGround: boolean;
};

const DEFAULT_TRANSFORM: Required<ModelTransform> = {
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  scale: 1,
};

const DEFAULT_TRIGGER_OFFSET = 24;
const DEFAULT_FALL_DURATION = 1.5;
const DEFAULT_FALL_ANGLE = MathUtils.degToRad(84);
const DEFAULT_FORWARD_BEND = MathUtils.degToRad(12);
const DEFAULT_STAGGER = 0.12;

// --- WOBBLE SETTINGS ---
// Change these values to adjust the "laghi" effect right before falling
const WOBBLE_INTENSITY = 0.022; // Controls how much it wobbles
const WOBBLE_SPEED = 6; // Controls how fast it wobbles

export default function FallingIdols({
  isActive,
  position,
  rotation,
  scale,
  idol1,
  idol2,
  idol3,
  idol4,
  triggerOffset = DEFAULT_TRIGGER_OFFSET,
  fallDuration = DEFAULT_FALL_DURATION,
  fallAngle = DEFAULT_FALL_ANGLE,
  forwardBend = DEFAULT_FORWARD_BEND,
  stagger = DEFAULT_STAGGER,
}: FallingIdolsProps) {
  const idol1Ref = useRef<Object3D | null>(null);
  const idol2Ref = useRef<Object3D | null>(null);
  const idol3Ref = useRef<Object3D | null>(null);
  const idol4Ref = useRef<Object3D | null>(null);

  const idolRefs = useMemo(
    () => ({
      idol1: idol1Ref,
      idol2: idol2Ref,
      idol3: idol3Ref,
      idol4: idol4Ref,
    }),
    [],
  );

  const idol1Transform = useMemo(
    () => ({ ...DEFAULT_TRANSFORM, ...idol1 }),
    [idol1],
  );
  const idol2Transform = useMemo(
    () => ({ ...DEFAULT_TRANSFORM, ...idol2 }),
    [idol2],
  );
  const idol3Transform = useMemo(
    () => ({ ...DEFAULT_TRANSFORM, ...idol3 }),
    [idol3],
  );
  const idol4Transform = useMemo(
    () => ({ ...DEFAULT_TRANSFORM, ...idol4 }),
    [idol4],
  );

  const configs = useMemo(
    () => [
      {
        ref: idol1Ref,
        basePosition: idol1Transform.position,
        baseRotation: idol1Transform.rotation,
        triggerZ: idol1Transform.position[2] + triggerOffset,
      },
      {
        ref: idol2Ref,
        basePosition: idol2Transform.position,
        baseRotation: idol2Transform.rotation,
        triggerZ: idol2Transform.position[2] + triggerOffset,
      },
      {
        ref: idol3Ref,
        basePosition: idol3Transform.position,
        baseRotation: idol3Transform.rotation,
        triggerZ: idol3Transform.position[2] + triggerOffset,
      },
      {
        ref: idol4Ref,
        basePosition: idol4Transform.position,
        baseRotation: idol4Transform.rotation,
        triggerZ: idol4Transform.position[2] + triggerOffset,
      },
    ],
    [
      idol1Transform,
      idol2Transform,
      idol3Transform,
      idol4Transform,
      triggerOffset,
    ],
  );

  const fallStatesRef = useRef<IdolFallState[]>([
    {
      triggered: false,
      triggerTime: 0,
      delay: 0,
      fallSign: 1,
      hitGround: false,
    },
    {
      triggered: false,
      triggerTime: 0,
      delay: stagger,
      fallSign: 1,
      hitGround: false,
    },
    {
      triggered: false,
      triggerTime: 0,
      delay: stagger * 2,
      fallSign: 1,
      hitGround: false,
    },
    {
      triggered: false,
      triggerTime: 0,
      delay: stagger * 3,
      fallSign: 1,
      hitGround: false,
    },
  ]);

  useEffect(() => {
    fallStatesRef.current = [
      {
        triggered: false,
        triggerTime: 0,
        delay: 0,
        fallSign: 1,
        hitGround: false,
      },
      {
        triggered: false,
        triggerTime: 0,
        delay: stagger,
        fallSign: 1,
        hitGround: false,
      },
      {
        triggered: false,
        triggerTime: 0,
        delay: stagger * 2,
        fallSign: 1,
        hitGround: false,
      },
      {
        triggered: false,
        triggerTime: 0,
        delay: stagger * 3,
        fallSign: 1,
        hitGround: false,
      },
    ];
  }, [stagger]);

  useEffect(() => {
    if (isActive) return;
    fallStatesRef.current.forEach((state) => {
      state.triggered = false;
      state.triggerTime = 0;
      state.fallSign = 1;
      state.hitGround = false;
    });

    configs.forEach((config) => {
      const obj = config.ref.current;
      if (!obj) return;
      obj.position.set(
        config.basePosition[0],
        config.basePosition[1],
        config.basePosition[2],
      );
      obj.rotation.set(
        config.baseRotation[0],
        config.baseRotation[1],
        config.baseRotation[2],
        "YXZ",
      );
    });
  }, [configs, isActive]);

  const shakeIntensityRef = useRef(0);

  useFrame((state, delta) => {
    if (!isActive) return;
    const camZ = state.camera.position.z;
    const elapsed = state.clock.getElapsedTime();

    configs.forEach((config, index) => {
      const obj = config.ref.current;
      if (!obj) return;
      const fallState = fallStatesRef.current[index];

      if (!fallState.triggered) {
        // Trigger when the camera crosses the idol's Z band.
        if (camZ <= config.triggerZ) {
          fallState.triggered = true;
          fallState.triggerTime = elapsed;
          fallState.fallSign = camZ >= config.basePosition[2] ? 1 : -1;
        } else {
          return;
        }
      }

      const rawT =
        (elapsed - fallState.triggerTime - fallState.delay) / fallDuration;
      if (rawT <= 0) return;

      const t = Math.min(1, rawT);

      // Hit ground trigger for camera shake
      if (t === 1 && !fallState.hitGround) {
        fallState.hitGround = true;
        shakeIntensityRef.current = 1.0;
      }

      // Anticipation easing (Back.easeIn): goes slightly negative then accelerates to 1
      const s = 1.70158;
      const eased = t * t * ((s + 1) * t - s);

      const forwardAngle = eased * fallAngle * fallState.fallSign;
      const frontAngle =
        Math.sin(Math.max(0, eased) * Math.PI) *
        forwardBend *
        fallState.fallSign;

      // Add a smooth wobble to the model while it is leaning back (laghi)
      let modelShakeX = 0;
      let modelShakeZ = 0;
      if (eased < 0) {
        // Use local time so it always starts at 0 phase
        const localTime = t * fallDuration;
        
        // Create a smooth fade envelope based on the eased curve.
        // `eased` smoothly goes from 0 to about -0.1, then back to 0. 
        // Multiplying by -10 scales this to a 0 -> 1 -> 0 fade factor.
        const fadeEnvelope = -eased * 10;
        
        modelShakeX = Math.sin(localTime * WOBBLE_SPEED) * WOBBLE_INTENSITY * fadeEnvelope;
        modelShakeZ = Math.sin(localTime * WOBBLE_SPEED * 1.3) * WOBBLE_INTENSITY * fadeEnvelope;
      }

      obj.position.set(
        config.basePosition[0],
        config.basePosition[1],
        config.basePosition[2],
      );
      obj.rotation.set(
        config.baseRotation[0] + forwardAngle + frontAngle + modelShakeX,
        config.baseRotation[1],
        config.baseRotation[2] + modelShakeZ,
        "YXZ",
      );
    });

    // Apply camera shake if active
    if (shakeIntensityRef.current > 0) {
      const shakeVal = shakeIntensityRef.current;
      state.camera.position.x += (Math.random() - 0.5) * 1.5 * shakeVal;
      state.camera.position.y += (Math.random() - 0.5) * 1.5 * shakeVal;

      // Decay shake over ~0.3 seconds
      shakeIntensityRef.current -= delta * 3.5;
      if (shakeIntensityRef.current < 0) shakeIntensityRef.current = 0;
    }
  });

  return (
    <Idols
      position={position}
      rotation={rotation}
      scale={scale}
      idol1={idol1}
      idol2={idol2}
      idol3={idol3}
      idol4={idol4}
      idolRefs={idolRefs}
    />
  );
}
