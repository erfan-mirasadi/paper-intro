"use client";

import { useFrame } from "@react-three/fiber";
import { PerspectiveCamera as TheatrePerspectiveCamera } from "@theatre/r3f";
import { useRef } from "react";
import * as THREE from "three";

export const baseCameraQuaternion = new THREE.Quaternion();
export const baseCameraPosition = new THREE.Vector3();

export default function ParallaxCamera() {
  const theatreCamRef = useRef<THREE.PerspectiveCamera>(null);

  const currentOffset = useRef(new THREE.Vector2(0, 0));
  const targetOffset = useRef(new THREE.Vector2(0, 0));

  useFrame(({ pointer, camera }) => {
    if (!theatreCamRef.current) return;

    // Update the exported base transforms so other components (like CloudTunnel) can attach to them
    baseCameraPosition.copy(theatreCamRef.current.position);
    baseCameraQuaternion.copy(theatreCamRef.current.quaternion);

    // 1. Copy the exact transformations from Theatre's camera to the active camera
    camera.position.copy(theatreCamRef.current.position);
    camera.quaternion.copy(theatreCamRef.current.quaternion);

    // 2. Sync essential camera properties
    if (
      camera instanceof THREE.PerspectiveCamera &&
      theatreCamRef.current instanceof THREE.PerspectiveCamera
    ) {
      let needsUpdate = false;
      if (camera.fov !== theatreCamRef.current.fov) {
        // eslint-disable-next-line
        camera.fov = theatreCamRef.current.fov;
        needsUpdate = true;
      }
      if (camera.near !== theatreCamRef.current.near) {
        // eslint-disable-next-line
        camera.near = theatreCamRef.current.near;
        needsUpdate = true;
      }
      if (camera.far !== theatreCamRef.current.far) {
        // eslint-disable-next-line
        camera.far = theatreCamRef.current.far;
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
      far={20000}
      makeDefault={false}
    />
  );
}
