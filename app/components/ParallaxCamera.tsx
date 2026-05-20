"use client";

import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera as TheatrePerspectiveCamera } from "@theatre/r3f";
import { useRef, useEffect } from "react";
import * as THREE from "three";

export const baseCameraQuaternion = new THREE.Quaternion();
export const baseCameraPosition = new THREE.Vector3();
export const baseCameraUpdatedAt = { value: 0 };

export default function ParallaxCamera({ isActive = true }: { isActive?: boolean }) {
  const theatreCamRef = useRef<THREE.PerspectiveCamera>(null);
  const isActiveRef = useRef(isActive);
  
  // Using a manual ref sync for isActive
  useEffect(() => {
    isActiveRef.current = isActive;
  }, [isActive]);

  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));

  useFrame((state) => {
    const { pointer, camera } = state;
    if (!theatreCamRef.current || !isActiveRef.current) return;

    // Update the exported base transforms so other components (like CloudTunnel) can attach to them
    baseCameraPosition.copy(theatreCamRef.current.position);
    baseCameraQuaternion.copy(theatreCamRef.current.quaternion);
    baseCameraUpdatedAt.value = state.clock.elapsedTime;

    // 1. Copy the exact transformations from Theatre's camera to the active camera
    camera.position.copy(theatreCamRef.current.position);
    camera.quaternion.copy(theatreCamRef.current.quaternion);

    // 2. Sync essential camera properties
    if (
      camera instanceof THREE.PerspectiveCamera &&
      theatreCamRef.current instanceof THREE.PerspectiveCamera
    ) {
      let needsUpdate = false;

      // Stop syncing FOV from Theatre.js keyframes as requested
      // if (camera.fov !== theatreCamRef.current.fov) {
      //   camera.fov = theatreCamRef.current.fov;
      //   needsUpdate = true;
      // }

      if (camera.near !== theatreCamRef.current.near) {
        // eslint-disable-next-line
        camera.near = theatreCamRef.current.near;
        needsUpdate = true;
      }

      // Enforce far to always be 50000 and ignore Theatre.js keyframes for it
      if (camera.far !== 50000) {
        // eslint-disable-next-line
        camera.far = 50000;
        needsUpdate = true;
      }

      if (needsUpdate) {
        camera.updateProjectionMatrix();
      }
    }

    // 3. Apply the Parallax offset based on mouse position
    const maxPan = 0.4; // Significantly increased pan rotation
    const maxTilt = 0.4; // Significantly increased tilt rotation

    targetOffset.current.x = -pointer.x * maxPan;
    targetOffset.current.y = pointer.y * maxTilt;

    // Smooth interpolation
    currentOffset.current.lerp(targetOffset.current, 0.05);

    // Apply local rotations on top of Theatre.js base rotation
    camera.rotateY(currentOffset.current.x);
    camera.rotateX(currentOffset.current.y);
  });

  return (
    <TheatrePerspectiveCamera
      theatreKey="MainCamera"
      ref={theatreCamRef}
      position={[0, 20, 100]}
      fov={45}
      near={0.1}
      far={50000}
      makeDefault={false}
    />
  );
}
