"use client";

export default function GroundPlane() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -70, 0]} receiveShadow>
      <planeGeometry args={[5000, 2000]} />
      <meshStandardMaterial color="#5B411A" roughness={1} metalness={0} />
    </mesh>
  );
}
