import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { ThreeElement, useFrame, extend, useLoader } from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";
import Island from "./Island";
import Island2 from "./Island2";
import Lighthouse from "./Lighthouse";
import StaticClouds from "./StaticClouds";
import Mountain2 from "./Mountain2";

extend({ Water });

// Add types for the extended water element
declare module "@react-three/fiber" {
  interface ThreeElements {
    water: ThreeElement<typeof Water>;
  }
}

export default function OceanScene() {
  const waterRef = useRef<Water>(null!);
  const pulseZ = useRef(2000); // Start far away / invisible
  // Adjust this percentage to control mountain darkness (0 = black, 1 = full brightness)
  const mountainBrightness = 0.1;

  // Unified constant for scene depth/scale
  const SCENE_SIZE = 25000; // Original was 40000. Reducing this brings everything "forward"
  const HORIZON_RADIUS = SCENE_SIZE * 0.7;
  const PULSE_LIMIT = SCENE_SIZE * -0.9;

  // Define our fixed colors outside to avoid recreation
  const darkWaterColor = useMemo(() => new THREE.Color(0x001e0f), []);
  const brightWaterColor = useMemo(() => new THREE.Color(0x00aaff), []);

  // Calculate the exact world position of the Moon based on the Skybox group scale (7000)
  // Position: [0, 0.2, -0.91] * 7000 = [0, 1400, -6370]
  const moonWorldPosition = useMemo(
    () => new THREE.Vector3(0, 1400, -6370),
    [],
  );

  // ==========================================
  // Moon reflection settings on water
  // ==========================================
  const moonConfig = useMemo(
    () => ({
      color: 0x5599cc, // Color of the moon reflection
      direction: new THREE.Vector3(0, 0.15, -1).normalize(), // Initial fallback direction
      shininess: "2500.0", // How narrow the light line is (higher = narrower)
      brightness: "10.0", // Intensity of the moon light on water
    }),
    [],
  );
  // ==========================================

  // Load the textures
  const texture = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");

  const waterNormals = useMemo(() => {
    const t = texture.clone();
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    return t;
  }, [texture]);

  const config = useMemo(
    () => ({
      textureWidth: 512,
      textureHeight: 512,
      waterNormals,
      sunDirection: moonConfig.direction,
      sunColor: moonConfig.color,

      waterColor: 0x00121a,
      distortionScale: 4.0,
      size: 1.0,
      fog: true,
      alpha: 0.85,
    }),
    [waterNormals, moonConfig],
  );

  // Inject custom shader logic for the sweeping line effect
  useEffect(() => {
    if (!waterRef.current) return;
    const mat = waterRef.current.material;

    // Initialize custom uniforms
    mat.uniforms.uPulseZ = { value: 2000.0 };
    mat.uniforms.uBaseColor = { value: darkWaterColor.clone() };
    mat.uniforms.uPulseColor = { value: brightWaterColor.clone() };

    mat.onBeforeCompile = (shader) => {
      // Link our React uniforms to the Shader
      shader.uniforms.uPulseZ = mat.uniforms.uPulseZ;
      shader.uniforms.uBaseColor = mat.uniforms.uBaseColor;
      shader.uniforms.uPulseColor = mat.uniforms.uPulseColor;

      // Inject uniform definitions at the top of the fragment shader
      shader.fragmentShader = `
        uniform float uPulseZ;
        uniform vec3 uBaseColor;
        uniform vec3 uPulseColor;
        ${shader.fragmentShader}
      `;

      // Calculate the sweep edge and dynamic color right after getting the noise
      shader.fragmentShader = shader.fragmentShader.replace(
        "vec4 noise = getNoise( worldPosition.xz * size );",
        `
        // 1. Curved Shockwave (makes it look like a parabolic bow wave)
        float curve = (worldPosition.x * worldPosition.x) * 0.00015;
        
        // 2. High-frequency energy ripples on the pulse
        float energyRipple = sin(worldPosition.x * 0.05 + time * 4.0) * 15.0 
                           + cos(worldPosition.x * 0.1 - time * 3.0) * 10.0;

        // Base distance to the pulse line (center leads, wings lag behind)
        float pulseZAtX = uPulseZ + curve + energyRipple;
        float distToPulse = abs(worldPosition.z - pulseZAtX);
        
        // 3. Multi-layered glow (Wide soft glow + Hot narrow core)
        float glowAlpha = smoothstep(300.0, 0.0, distToPulse);
        float coreAlpha = smoothstep(40.0, 0.0, distToPulse);
        
        // 4. Secondary 'echo' pulse following behind
        float echoZ = pulseZAtX + 350.0; // lags 350 units behind
        float echoDist = abs(worldPosition.z - echoZ);
        float echoAlpha = smoothstep(80.0, 0.0, echoDist) * 0.4;
        
        // Mix the colors: Base -> Glow -> Core -> Echo
        vec3 baseWithGlow = mix(uBaseColor, uPulseColor, glowAlpha);
        vec3 withCore = mix(baseWithGlow, vec3(0.8, 0.95, 1.0), coreAlpha); // Bright cyan/white core
        vec3 dynamicWaterColor = mix(withCore, uPulseColor, echoAlpha);

        vec4 noise = getNoise( worldPosition.xz * size );
        `,
      );

      // Replace shader default water color with our dynamic one, and apply moon brightness
      shader.fragmentShader = shader.fragmentShader
        .replace(" * waterColor", " * dynamicWaterColor")
        .replace("mix( waterColor,", "mix( dynamicWaterColor,")
        .replace(
          "100.0, 2.0, 0.5",
          `${moonConfig.shininess}, ${moonConfig.brightness}, 0.5`,
        );
    };

    // Force Three.js to recompile the material with our new shader code
    mat.customProgramCacheKey = () => "pulse_water_shader";
    mat.needsUpdate = true;
  }, [darkWaterColor, brightWaterColor, moonConfig]);

  // Camera movement config
  const camStartPos = 4000;

  // --- Distant Background Mountain Config ---
  const bgMountainPos = [0, -25, -14000] as const;
  const bgMountainStretch = [1.5, 1, 1] as const; // Very slight stretch just to ensure they overlap nicely
  const bgMountainScale = 40; // Natural mountain scale
  const bgMountainSpread = 5000; // Distance between the 3 mountains (tuned to fill the empty space to the right)

  // Animate the water, sweeping line, and camera
  useFrame((state, delta) => {
    // Water Shader Animation
    if (waterRef.current) {
      const mat = waterRef.current.material;

      // Time animation for continuous wave movement
      if (mat.uniforms && mat.uniforms.time) {
        mat.uniforms.time.value += delta * 0.35;
      }

      // Move the pulse away from the camera (negative Z direction)
      if (pulseZ.current > PULSE_LIMIT) {
        pulseZ.current -= delta * 800; // Speed of the pulse
      }

      // Ensure uniforms are injected before updating them
      if (mat.uniforms.uPulseZ) {
        mat.uniforms.uPulseZ.value = pulseZ.current;
      }

      // SMART TRICK: Dynamically calculate the direction from camera to the moon's exact world position!
      if (mat.uniforms.sunDirection) {
        mat.uniforms.sunDirection.value
          .copy(moonWorldPosition)
          .sub(state.camera.position)
          .normalize();
      }
    }
  });

  return (
    <>
      <Island />
      <Island2 />
      <Lighthouse />
      <StaticClouds opacity={0.1} />
      <Mountain2
        position={[0, 500, 10000]}
        rotation={[0, 4, 0]}
        scale={40}
        color={[0.2, 0.2, 0.2]}
      />
      <Mountain2
        position={[1300, 300, 11000]}
        rotation={[0, Math.PI / 2, 0]}
        scale={40}
        color={[0.2, 0.2, 0.2]}
      />

      {/* Distant Background Mountain (Replaces the old mountainTexture PNG and mists) */}
      <group
        position={bgMountainPos}
        scale={bgMountainStretch}
        rotation={[0, 0, 0]}
      >
        <Mountain2
          position={[0, 0, 0]}
          rotation={[0, 4, 0]}
          scale={bgMountainScale * 1} // The original one you liked
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
        <Mountain2
          position={[bgMountainSpread + 5500, 0, 0]}
          rotation={[0, 0, 0]}
          scale={bgMountainScale * 0.8} // First extra one to the right
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
        <Mountain2
          position={[bgMountainSpread * 2.5, 0, 0]}
          rotation={[0, 0, 0]}
          scale={bgMountainScale * 1.2} // Second extra one to the far right
          color={[mountainBrightness, mountainBrightness, mountainBrightness]}
          hasClouds={false}
          receiveSceneFog={true}
          sceneFogMultiplier={0.15}
        />
      </group>

      <group position={[0, -2, 0]}>
        <water
          ref={waterRef}
          args={[new THREE.PlaneGeometry(SCENE_SIZE, SCENE_SIZE), config]}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            // Start the pulse from the camera's Z position
            pulseZ.current = e.camera.position.z;
          }}
        />

        <mesh position={[0, -510, 0]}>
          <boxGeometry args={[SCENE_SIZE, 1000, SCENE_SIZE]} />
          <meshBasicMaterial
            color={0x001220}
            transparent={true}
            opacity={0.8}
            depthWrite={false}
          />
        </mesh>
      </group>
    </>
  );
}
