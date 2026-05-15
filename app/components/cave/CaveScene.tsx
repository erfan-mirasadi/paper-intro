"use client";

import CaveModel from "./CaveModel";
import CaveEntrance from "./CaveEntrance";
import CavePillars from "./Pillars";
import MarbleFloor from "./MarbleFloor";
import VolumetricSmoke from "../VolumetricSmoke";
import AnimatedFog from "../AnimatedFog";
// No <Environment> — pillars and marble build their own envMaps locally

export default function CaveScene() {
  return (
    <group>
      {/* Set the background of the entire scene to white as requested */}
      {/* <color attach="background" args={["#ffffff"]} /> */}

      {/* Surreal & Luxurious Lighting Setup (Optimized & localized to the entrance) */}
      <group>
        {/* Very dim ambient light so the cave interior remains dark */}
        {/* <ambientLight intensity={0.05} color="#202030" />

        {/* Elegant, surreal blue light from above. 
            Distance is strictly controlled so it NEVER reaches Z < 6 (inside the cave) */}
        {/* <pointLight
          position={[0, 15, 25]}
          intensity={4.0}
          distance={19} // Reaches exactly Z=6 and stops
          color="#88bbff"
          castShadow
          shadow-mapSize={[1024, 1024]}
        />

        <pointLight
          position={[0, 1.5, 12]}
          intensity={30.0}
          distance={6} // Reaches exactly Z=6 and stops, totally safe
          color="#ffc857"
        />

        <pointLight
          position={[0, 1.5, 20]}
          intensity={3.0}
          distance={12} // Reaches Z=8 and stops
          color="#ffc857"
        />  */}
      </group>
      <CaveEntrance
        position={[0.6, -0.5, 6]}
        rotation={[0, Math.PI, 0]}
        scale={1.8}
      />
      <MarbleFloor position={[0, 0.15, 203]} />
      <CavePillars position={[0.6, -0.5, 10]} />
      <CaveModel position={[0, 0, 0]} />

      {/* Some fog inside the cave as requested */}
      <VolumetricSmoke
        count={50}
        animate={true}
        renderOrder={10}
        opacity={3}
        length={45}
        width={3}
        height={0}
        yOffset={5}
        minScale={10}
        maxScale={10}
        position={[0, -3.5, -17]}
        rotation={[0, Math.PI / 2, 0]}
        speedMultiplier={0.2}
        driftMultiplier={0.2}
        color="#696969"
      />
      <AnimatedFog color="#ffffff" baseDensity={0.0004} maxDensity={0.04} />
      {/* <VolumetricSmoke
        count={50}
        animate={true}
        renderOrder={10}
        opacity={3}
        length={45}
        width={3}
        height={0}
        yOffset={5}
        minScale={10}
        maxScale={10}
        position={[0, -3.5, 50]}
        rotation={[0, Math.PI / 2, 0]}
        speedMultiplier={0.2}
        driftMultiplier={0.2}
        color="#111111"
      /> */}
    </group>
  );
}
