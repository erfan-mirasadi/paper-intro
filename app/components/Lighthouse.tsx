"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useThree, useFrame } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { KTX2Loader } from "three/examples/jsm/loaders/KTX2Loader.js";
import { DRACOLoader } from "three/examples/jsm/loaders/DRACOLoader.js";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();

/**
 * The rotating light source for the lighthouse
 * Made significantly larger and brighter to ensure visibility at distance
 */
function LighthouseLight({
  position = [0, 0, 0] as [number, number, number],
  speed = 1.2,
  lightColor = "#ffffaa",
  ...props
}) {
  const groupRef = useRef<THREE.Group>(null!);

  useFrame((_state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += speed * delta;
    }
  });

  const uniforms = useMemo(
    () => ({
      uColor: { value: new THREE.Color(lightColor) },
      uOpacity: { value: 0.7 }, // Increased intensity even more
    }),
    [lightColor],
  );

  return (
    <group position={position} {...props}>
      <group ref={groupRef}>
        {/* Fake volumetric beam (Light Halo) - Soft edges and fade using custom shader */}
        <mesh position={[0, 0, 1500]} rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[700, 3000, 32, 1, true]} />
          <shaderMaterial
            uniforms={uniforms}
            transparent={true}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            side={THREE.FrontSide} // Changed from DoubleSide to fix overlapping lines ("khat khat")
            vertexShader={`
              varying vec3 vNormal;
              varying vec3 vViewPosition;
              varying float vFade;
              void main() {
                vNormal = normalize(normalMatrix * normal);
                vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
                vViewPosition = -mvPosition.xyz;
                // Cone tip is at +1500, base is at -1500. Fade is 1 at tip, 0 at base.
                vFade = clamp((position.y + 1500.0) / 3000.0, 0.0, 1.0);
                gl_Position = projectionMatrix * mvPosition;
              }
            `}
            fragmentShader={`
              uniform vec3 uColor;
              uniform float uOpacity;
              varying vec3 vNormal;
              varying vec3 vViewPosition;
              varying float vFade;
              void main() {
                vec3 normal = normalize(vNormal);
                vec3 viewDir = normalize(vViewPosition);
                
                // Soft rim effect: bright at center, transparent at edges
                float rim = abs(dot(normal, viewDir));
                rim = pow(rim, 3.0); // sharp core, completely soft edge
                
                // Length fade: brighter near the bulb, fading out completely at the end
                float fade = pow(vFade, 2.0);
                
                float alpha = rim * fade * uOpacity;
                gl_FragColor = vec4(uColor, alpha);
              }
            `}
          />
        </mesh>
      </group>
    </group>
  );
}

function Birds({ position = [0, 400, 0] as [number, number, number] }) {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const groupRef = useRef<THREE.Group>(null!);
  const url = "/birds.glb";

  useEffect(() => {
    let isMounted = true;
    if (gltfCache.has(url)) {
      Promise.resolve().then(() => {
        if (isMounted) setScene(gltfCache.get(url).clone());
      });
      return;
    }

    const loader = new GLTFLoader();
    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(
      "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/",
    );
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;
        gltfCache.set(url, gltf.scene);
        setScene(gltf.scene.clone());
      },
      undefined,
      (err) => console.error("Error loading birds:", err),
    );

    return () => {
      isMounted = false;
    };
  }, [gl, url]);

  useFrame((state, delta) => {
    if (groupRef.current) {
      // چرخش نرم و دایره‌ای دور فانوس
      groupRef.current.rotation.y -= delta * 0.5;

      // حرکت سینوسی بالا و پایین (Bobbing) برای شبیه‌سازی پرواز
      groupRef.current.position.y =
        position[1] + Math.sin(state.clock.elapsedTime * 1.5) * 50;

      // کمی چرخش و شیب گرفتن برای ایجاد حس باد و پویایی پرنده‌ها
      groupRef.current.rotation.z =
        Math.sin(state.clock.elapsedTime * 1.2) * 0.1;
      groupRef.current.rotation.x =
        Math.cos(state.clock.elapsedTime * 0.9) * 0.05;
    }
  });

  if (!scene) return null;

  return (
    <group position={[position[0], 0, position[2]]}>
      <group ref={groupRef}>
        <primitive object={scene} />
      </group>
    </group>
  );
}

export default function Lighthouse() {
  const config = {
    // موقعیت کل مجموعه (فانوس + نور)
    groupPosition: [0, 0, -4000] as [number, number, number],

    // رنگ نور
    lightColor: "#aaddff",

    // موقعیت نور نسبت به فانوس (Relative)
    // الان روی [100, 100, 0] هست که کنارش دیده بشه
    lightPosition: [0, 370, 0] as [number, number, number],

    // مقیاس مدل فانوس
    modelScale: 0.5,

    // سرعت چرخش نور
    lightSpeed: 1,
  };
  // ==========================================

  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [error, setError] = useState<any>(null);
  const url = "/lighthouse-opt.glb";

  useEffect(() => {
    let isMounted = true;

    if (gltfCache.has(url)) {
      Promise.resolve().then(() => {
        if (isMounted) {
          setScene(gltfCache.get(url));
        }
      });
      return;
    }

    const loader = new GLTFLoader();

    const draco = new DRACOLoader();
    draco.setDecoderPath("https://www.gstatic.com/draco/v1/decoders/");
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = new KTX2Loader();
    ktx2.setTranscoderPath(
      "https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/jsm/libs/basis/",
    );
    ktx2.detectSupport(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      url,
      (gltf) => {
        if (!isMounted) return;
        console.log("✅ Lighthouse loaded successfully");
        gltfCache.set(url, gltf.scene);
        setScene(gltf.scene);
      },
      undefined,
      (err) => {
        if (!isMounted) return;
        console.error(`❌ Error loading lighthouse:`, err);
        setError(err);
      },
    );

    return () => {
      isMounted = false;
    };
  }, [gl, url]);

  if (error || !scene) return null;

  return (
    <group position={config.groupPosition} rotation={[0, Math.PI / 2, 0]}>
      <LighthouseLight
        position={config.lightPosition}
        lightColor={config.lightColor}
        speed={config.lightSpeed}
      />
      <primitive
        object={scene}
        position={[0, 0, 0]}
        rotation={[0, Math.PI / 4, 0]}
        scale={config.modelScale}
      />
      <Birds position={[0, -200, 0]} />
    </group>
  );
}
