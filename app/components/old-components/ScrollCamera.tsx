"use client";

import { useFrame } from "@react-three/fiber";
import { useScroll } from "@react-three/drei";
import * as THREE from "three";
import { useMemo, useRef } from "react";

interface ScrollCameraProps {
  startPos: [number, number, number];
  endPos: [number, number, number];
  startTarget?: [number, number, number];
  endTarget?: [number, number, number];
  startOffset?: number; // New prop for intro period
}

export default function ScrollCamera({
  startPos,
  endPos,
  startTarget = [0, 0, 0],
  endTarget = [0, 0, 0],
  startOffset = 0,
}: ScrollCameraProps) {
  const scroll = useScroll();

  const vStart = useMemo(() => new THREE.Vector3(...startPos), [startPos]);
  const vEnd = useMemo(() => new THREE.Vector3(...endPos), [endPos]);
  const tStart = useMemo(() => new THREE.Vector3(...startTarget), [startTarget]);
  const tEnd = useMemo(() => new THREE.Vector3(...endTarget), [endTarget]);

  const currentPos = useRef(new THREE.Vector3());
  const currentTarget = useRef(new THREE.Vector3());

  useFrame((state) => {
    // Only start moving after startOffset
    const offset = scroll.range(startOffset, 1 - startOffset);
    
    currentPos.current.lerpVectors(vStart, vEnd, offset);
    currentTarget.current.lerpVectors(tStart, tEnd, offset);

    state.camera.position.copy(currentPos.current);
    state.camera.lookAt(currentTarget.current);
  });

  return null;
}
