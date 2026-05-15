"use client";

import { useEffect } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { mainSheet } from "../TheatreSetup";

interface AnimatedFogProps {
  color?: string;
  baseDensity?: number;
  maxDensity?: number;
  sequenceLength?: number;
}

export default function AnimatedFog({
  color = "#030507",
  baseDensity = 0.0004,
  maxDensity = 0.005,
  sequenceLength = 29.35,
}: AnimatedFogProps) {
  const { scene } = useThree();

  // Create fog on mount, remove it cleanly on unmount.
  // Without cleanup, the previous scene's fog bleeds into the next scene.
  useEffect(() => {
    scene.fog = new THREE.FogExp2(color, maxDensity);

    return () => {
      // Remove fog when this scene unmounts so it doesn't leak into the next scene
      scene.fog = null;
    };
  // Re-create fog when color changes (scene switch)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [color]);

  useFrame(() => {
    const pos = mainSheet.sequence.position;
    const twentyPercentTime = sequenceLength * 0.2; // approx 5.87s

    let targetDensity = baseDensity;

    if (pos < twentyPercentTime) {
      // Interpolate from maxDensity down to baseDensity over the first 20%
      const progress = pos / twentyPercentTime;
      // Ease-out for smoother transition
      targetDensity = maxDensity - (maxDensity - baseDensity) * progress;
    }

    if (scene.fog instanceof THREE.FogExp2) {
      // Smoothly animate towards target density
      scene.fog.density = THREE.MathUtils.lerp(
        scene.fog.density,
        targetDensity,
        0.05,
      );
    }
  });

  return null;
}
