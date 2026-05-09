import React, { useRef, useMemo, useEffect } from "react";
import * as THREE from "three";
import { ThreeElement, useFrame, extend, useLoader } from "@react-three/fiber";
import { Water } from "three/examples/jsm/objects/Water.js";
import Island from "./Island";
import Lighthouse from "./Lighthouse";
import StaticClouds from "./StaticClouds";

// Extend R3F with the Water object
extend({ Water });

// Add types for the extended water element
declare module "@react-three/fiber" {
  interface ThreeElements {
    water: ThreeElement<typeof Water>;
  }
}

export default function OceanScene() {
  const waterRef = useRef<Water>(null!);
  const ambientRef = useRef<THREE.AmbientLight>(null!);
  const directionalRef = useRef<THREE.DirectionalLight>(null!);

  const pulseZ = useRef(2000); // Start far away / invisible

  // Adjust this percentage to control mountain darkness (0 = black, 1 = full brightness)
  const mountainBrightness = 0.1;

  // Define our fixed colors outside to avoid recreation
  const darkWaterColor = useMemo(() => new THREE.Color(0x001e0f), []);
  const brightWaterColor = useMemo(() => new THREE.Color(0x00aaff), []);
  const darkSunColor = useMemo(() => new THREE.Color(0x444444), []);
  const brightSunColor = useMemo(() => new THREE.Color(0xffffff), []);

  // Load the textures
  const texture = useLoader(THREE.TextureLoader, "/textures/waternormals.jpg");
  const mountainTexture = useLoader(THREE.TextureLoader, "/mountain.png");
  const mistTexture = useLoader(THREE.TextureLoader, "/mist5.png");

  useMemo(() => {
    mountainTexture.wrapS = THREE.MirroredRepeatWrapping;
    mountainTexture.wrapT = THREE.ClampToEdgeWrapping;
    mountainTexture.repeat.set(48, 1);

    mistTexture.wrapS = THREE.MirroredRepeatWrapping;
    mistTexture.wrapT = THREE.ClampToEdgeWrapping;
    mistTexture.repeat.set(16, 1);
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
      sunDirection: new THREE.Vector3(0, 0.5, -1).normalize(),
      sunColor: 0x444444,
      waterColor: 0x001e0f,
      distortionScale: 5.0,
      size: 1.5,
      fog: true,
      alpha: 0.85,
    }),
    [waterNormals],
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

      // Safely replace the built-in waterColor with our dynamic one
      shader.fragmentShader = shader.fragmentShader
        .replace(" * waterColor", " * dynamicWaterColor")
        .replace("mix( waterColor,", "mix( dynamicWaterColor,");
    };

    // Force Three.js to recompile the material with our new shader code
    mat.customProgramCacheKey = () => "pulse_water_shader";
    mat.needsUpdate = true;
  }, [darkWaterColor, brightWaterColor]);

  // Camera movement config
  const camStartPos = 4000;
  const camEndPos = -3500;
  const camSpeed = 450;
  const cameraZ = useRef(camStartPos);

  // Animate the water, sweeping line, and camera
  useFrame((state, delta) => {
    // 1. Camera Movement Loop
    cameraZ.current -= camSpeed * delta;
    if (cameraZ.current < camEndPos) {
      cameraZ.current = camStartPos;
    }

    // Set camera position (slightly to the right, slightly above water surface y=-2)
    state.camera.position.set(300, 25, cameraZ.current);

    // Update OrbitControls target if they exist to follow the movement
    if (state.controls) {
      // @ts-ignore
      state.controls.target.set(300, 25, cameraZ.current - 200);
      // @ts-ignore
      state.controls.update();
    } else {
      state.camera.lookAt(0, 20, cameraZ.current - 200);
    }

    // 2. Water Shader Animation
    if (waterRef.current) {
      const mat = waterRef.current.material;

      // Time animation for continuous wave movement
      mat.uniforms["time"].value += delta * 0.35;

      // Move the pulse away from the camera (negative Z direction)
      if (pulseZ.current > -8000) {
        pulseZ.current -= delta * 800; // Speed of the pulse
      }

      // Ensure uniforms are injected before updating them
      if (mat.uniforms.uPulseZ) {
        mat.uniforms.uPulseZ.value = pulseZ.current;
      }
    }
  });

  return (
    <>
      <ambientLight ref={ambientRef} intensity={0.2} />
      <directionalLight
        ref={directionalRef}
        position={[-10, 20, 10]}
        intensity={0.5}
      />

      <Island />
      <Lighthouse />
      <StaticClouds />

      {/* Back Mist layer (behind mountains) */}
      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-3}>
        {/* Slightly further than mountains (7100), taller for depth */}
        <cylinderGeometry args={[7100, 7100, 250, 4, 1, true]} />
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
              `
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
              `
            );
          }}
        />
      </mesh>

      {/* Distant mountains at the horizon, square shape to match water bounds */}
      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-2}>
        {/* Radius 7000 creates walls at ~4950 distance, just inside the 5000 water edge. 4 segments = square */}
        <cylinderGeometry args={[7000, 7000, 175, 4, 1, true]} />
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

      {/* Mist layer in front of mountains */}
      <mesh position={[0, -25, 0]} rotation-y={Math.PI / 4} renderOrder={-1}>
        {/* Slightly closer than mountains (6900), taller for better fading. 4 segments = square */}
        <cylinderGeometry args={[6900, 6900, 150, 4, 1, true]} />
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
          args={[new THREE.PlaneGeometry(10000, 10000), config]}
          rotation-x={-Math.PI / 2}
          position={[0, 0, 0]}
          onPointerDown={(e) => {
            // Start the pulse from the camera's Z position
            pulseZ.current = e.camera.position.z;
          }}
        />

        <mesh position={[0, -510, 0]}>
          <boxGeometry args={[10000, 1000, 10000]} />
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
