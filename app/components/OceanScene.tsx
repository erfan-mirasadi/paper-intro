import { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { ThreeElement, useFrame, extend, useLoader } from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";
import Island from "./Island";
import Island2 from "./Island2";
import Lighthouse from "./Lighthouse";
import StaticClouds from "./StaticClouds";
import Mountain2 from "./Mountain2";
import VolumetricSmoke from "./VolumetricSmoke";

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
  const mountainTexture = useLoader(THREE.TextureLoader, "/mountain.png");
  const mistTexture = useLoader(THREE.TextureLoader, "/mist5.png");

  useMemo(() => {
    mountainTexture.wrapS = THREE.MirroredRepeatWrapping;
    mountainTexture.wrapT = THREE.ClampToEdgeWrapping;
    mountainTexture.repeat.set(12, 1);

    mistTexture.wrapS = THREE.MirroredRepeatWrapping;
    mistTexture.wrapT = THREE.ClampToEdgeWrapping;
    mistTexture.repeat.set(4, 1);
  }, [mountainTexture, mistTexture]);

  const mistTextureBack = useMemo(() => {
    const t = mistTexture.clone();
    t.offset.set(0.5, 0); // Offset by 50% to look different from the front
    return t;
  }, [mistTexture]);

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
      if (pulseZ.current > -36000) {
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
      <StaticClouds />
      <Mountain2
        position={[0, 500, 10000]}
        rotation={[0, 4, 0]}
        scale={40}
        color={[0.2, 0.2, 0.2]}
      />

      {/* Distant static mist on all 4 sides of the ocean */}
      {/* back */}
      <group position={[0, -100, 5000]} scale={[40, 15, 2]}>
        <VolumetricSmoke count={100} animate={false} renderOrder={-4} opacity={0.3} />
      </group>
      {/* FRONT */}
      <group position={[0, -100, -19800]} scale={[120, 15, 1]}>
        <VolumetricSmoke count={1120} animate={false} renderOrder={-4} opacity={0.3} />
      </group>
      {/* right */}
      <group
        position={[4500, -100, 0]}
        scale={[70, 15, 1]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <VolumetricSmoke count={80} animate={false} renderOrder={-4} opacity={0.3} />
      </group>
      {/* left */}
      <group
        position={[-3500, -100, 0]}
        scale={[40, 15, 1]}
        rotation={[0, Math.PI / 2, 0]}
      >
        <VolumetricSmoke count={80} animate={false} renderOrder={-4} opacity={0.3} />
      </group>

      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-3}>
        {/* Slightly further than mountains (28200), taller for depth. Only on the facing edge. */}
        <cylinderGeometry
          args={[28200, 28200, 250, 1, 1, true, 0.5 * Math.PI, Math.PI / 2]}
        />
        <meshBasicMaterial
          map={mistTextureBack}
          transparent={true}
          opacity={0.3}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={true}
          fog={false}
          blending={THREE.AdditiveBlending}
          onBeforeCompile={(shader) => {
            shader.vertexShader = `
              varying vec3 vWorldPos;
              ${shader.vertexShader}
            `.replace(
              "#include <worldpos_vertex>",
              `
              #include <worldpos_vertex>
              vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
              `,
            );
            shader.fragmentShader = `
              varying vec3 vWorldPos;
              ${shader.fragmentShader}
            `.replace(
              "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
              `
              // Fade out at top and bottom (different range for back mist)
              float fade = smoothstep(-150.0, -50.0, vWorldPos.y) * (1.0 - smoothstep(100.0, 225.0, vWorldPos.y));
              gl_FragColor = vec4( outgoingLight, diffuseColor.a * fade );
              `,
            );
          }}
        />
      </mesh>

      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-2}>
        {/* Radius 28000 creates walls at ~19800 distance. Only on the facing edge. */}
        <cylinderGeometry
          args={[28000, 28000, 175, 1, 1, true, 0.5 * Math.PI, Math.PI / 2]}
        />
        <meshBasicMaterial
          map={mountainTexture}
          color={
            new THREE.Color(
              mountainBrightness,
              mountainBrightness,
              mountainBrightness,
            )
          }
          transparent={true}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={true}
          fog={false}
        />
      </mesh>

      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-1}>
        {/* Slightly closer than mountains (27800), taller for better fading. Only on the facing edge. */}
        <cylinderGeometry
          args={[27800, 27800, 150, 1, 1, true, 0.5 * Math.PI, Math.PI / 2]}
        />
        <meshBasicMaterial
          map={mistTexture}
          transparent={true}
          opacity={0.4}
          side={THREE.BackSide}
          depthWrite={false}
          depthTest={true}
          fog={false}
          blending={THREE.AdditiveBlending}
          onBeforeCompile={(shader) => {
            shader.vertexShader = `
              varying vec3 vWorldPos;
              ${shader.vertexShader}
            `.replace(
              "#include <worldpos_vertex>",
              `
              #include <worldpos_vertex>
              vWorldPos = (modelMatrix * vec4(transformed, 1.0)).xyz;
              `,
            );
            shader.fragmentShader = `
              varying vec3 vWorldPos;
              ${shader.fragmentShader}
            `.replace(
              "gl_FragColor = vec4( outgoingLight, diffuseColor.a );",
              `
              // Fade out at top and bottom of the cylinder height
              // Cylinder is at y=-25 with height 150 (goes -100 to 50)
              float fade = smoothstep(-100.0, -37.5, vWorldPos.y) * (1.0 - smoothstep(12.5, 50.0, vWorldPos.y));
              gl_FragColor = vec4( outgoingLight, diffuseColor.a * fade );
              `,
            );
          }}
        />
      </mesh>

      <group position={[0, -2, 0]}>
        <water
          ref={waterRef}
          args={[new THREE.PlaneGeometry(40000, 40000), config]}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            // Start the pulse from the camera's Z position
            pulseZ.current = e.camera.position.z;
          }}
        />

        <mesh position={[0, -510, 0]}>
          <boxGeometry args={[40000, 1000, 40000]} />
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
