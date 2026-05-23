import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { requestTransition } from "../core/useSceneStore";

// ── OceanCamera ──────────────────────────────────────────────────────────
// Writes directly to the global state.camera (the one persistent R3F camera)
// so no competing camera object is ever mounted.
// Completely idle (CPU-free) when !isActive.

export default function OceanCamera({
  isActive,
  shakeRef,
}: {
  isActive: boolean;
  shakeRef: React.MutableRefObject<{ intensity: number }>;
}) {
  const { camera } = useThree();
  const isActiveRef = useRef(isActive);
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const isPausedRef = useRef(false);
  const progressRef = useRef(0);
  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));
  const exitTriggeredRef = useRef(false);

  // Swapped start and end points
  const end = useMemo(() => new THREE.Vector3(-400, 60, -1500), []);
  const start = useMemo(() => new THREE.Vector3(-500, 60, 3000), []);

  const baseQuaternion = useMemo(() => {
    const obj = new THREE.Object3D();
    obj.position.copy(start);
    obj.lookAt(end);
    obj.rotateY(Math.PI);
    return obj.quaternion.clone();
  }, [start, end]);

  const travelDuration = 20;

  // Configure global camera for this scene once
  useEffect(() => {
    if (camera instanceof THREE.PerspectiveCamera) {
      camera.fov = 70;
      camera.near = 0.1;
      camera.far = 25000;
      camera.updateProjectionMatrix();
    }
  }, [camera]);

  // Reset on deactivation so next visit starts clean
  useEffect(() => {
    if (!isActive) {
      progressRef.current = 0;
      exitTriggeredRef.current = false;
      isPausedRef.current = false;
      shakeRef.current.intensity = 0;
    }
  }, [isActive, shakeRef]);

  // Space → pause / resume
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (!isActiveRef.current || e.code !== "Space") return;
      e.preventDefault();
      isPausedRef.current = !isPausedRef.current;
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useFrame((state, delta) => {
    if (!isActiveRef.current) return;

    if (!isPausedRef.current) {
      progressRef.current += delta / travelDuration;
    }

    // Dolly: lerpVectors extrapolates past 1.0 intentionally (no clamp)
    state.camera.position.lerpVectors(start, end, progressRef.current);

    // Apply fixed base angle
    state.camera.quaternion.copy(baseQuaternion);

    // Mouse parallax
    targetOffset.current.x = -state.pointer.x * 0.25;
    targetOffset.current.y = state.pointer.y * 0.18;
    currentOffset.current.lerp(targetOffset.current, 0.05);
    state.camera.rotateY(currentOffset.current.x);
    state.camera.rotateX(currentOffset.current.y);

    // ── Camera shake ───────────────────────────────────────────────────
    if (shakeRef.current.intensity > 0.01) {
      shakeRef.current.intensity *= 0.97;
      const s = shakeRef.current.intensity;
      state.camera.position.x += (Math.random() - 0.5) * s;
      state.camera.position.y += (Math.random() - 0.5) * s * 0.5; // less vertical shake
    } else {
      shakeRef.current.intensity = 0;
    }

    // Exit trigger: start fade slightly before the end so it finishes in motion
    if (!exitTriggeredRef.current && progressRef.current >= 0.91) {
      exitTriggeredRef.current = true;
      requestTransition("black", "cave");
    }
  });

  return null;
}
