"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useThree, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

const gltfCache = new Map();
const VOLCANO_URL = "/assets/ocean/volcano-opt.glb";

function loadVolcanoScene(gl: THREE.WebGLRenderer) {
  if (gltfCache.has(VOLCANO_URL)) {
    return Promise.resolve(gltfCache.get(VOLCANO_URL));
  }

  return new Promise<THREE.Group>((resolve, reject) => {
    const loader = new GLTFLoader();

    const draco = getSharedDRACOLoader();
    loader.setDRACOLoader(draco);

    if (MeshoptDecoder) {
      loader.setMeshoptDecoder(MeshoptDecoder);
    }

    const ktx2 = getSharedKTX2Loader(gl);
    loader.setKTX2Loader(ktx2);

    loader.load(
      VOLCANO_URL,
      (gltf) => {
        gltfCache.set(VOLCANO_URL, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      (err) => reject(err),
    );
  });
}

export function preloadVolcano(gl: THREE.WebGLRenderer) {
  return loadVolcanoScene(gl);
}

// ── Flowing Lava Material Animation ────────────────────────────────────────
function FlowingLavaShader({ scene }: { scene: THREE.Group }) {
  const lavaMaterials = useMemo(() => {
    const mats: THREE.Material[] = [];
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mat = (child as THREE.Mesh).material;
        if (Array.isArray(mat)) {
          mat.forEach((m) => mats.push(m));
        } else {
          mats.push(mat);
        }
      }
    });

    // Filter for materials that might be lava based on name or emissive properties
    return mats.filter((m) => {
      const stdMat = m as THREE.MeshStandardMaterial;
      const isLavaName = m.name.toLowerCase().match(/lava|magma|fire|red|glow/);
      const hasEmissive =
        stdMat.emissive && (stdMat.emissive.r > 0 || stdMat.emissiveMap);
      return isLavaName || hasEmissive;
    });
  }, [scene]);

  useFrame((_, delta) => {
    const safeDelta = Math.min(delta, 0.1);
    lavaMaterials.forEach((mat) => {
      const stdMat = mat as THREE.MeshStandardMaterial;
      if (stdMat.map) {
        stdMat.map.wrapS = THREE.RepeatWrapping;
        stdMat.map.wrapT = THREE.RepeatWrapping;
        stdMat.map.offset.y -= safeDelta * 0.05; // Flow downwards slowly
      }
      if (stdMat.emissiveMap) {
        stdMat.emissiveMap.wrapS = THREE.RepeatWrapping;
        stdMat.emissiveMap.wrapT = THREE.RepeatWrapping;
        stdMat.emissiveMap.offset.y -= safeDelta * 0.05;
      }
    });
  });

  return null;
}

// ── Volcano Erupting Particles (Scattered Embers) ───────────────────────
function VolcanoEruptionParticles() {
  const count = 300; // Number of spewing embers
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);

  // A global timer for the eruption bursts
  const eruptionState = useRef({
    timer: 0,
    isErupting: false,
  });

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => {
      return {
        x: (Math.random() - 0.5) * 2,
        y: Math.random() * 5 + 8,
        z: (Math.random() - 0.5) * 2,
        vx: (Math.random() - 0.5) * 18,
        vy: Math.random() * 25 + 15,
        vz: (Math.random() - 0.5) * 18,
        scale: 0, // Start invisible/dead
        life: 0,
      };
    });
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const safeDelta = Math.min(delta, 0.1);

    const state = eruptionState.current;
    state.timer -= safeDelta;

    // Manage eruption burst timing
    if (state.timer <= 0) {
      if (state.isErupting) {
        state.isErupting = false;
        state.timer = Math.random() * 4 + 3; // Wait 3 to 7 seconds between bursts
      } else {
        state.isErupting = true;
        state.timer = Math.random() * 1.5 + 0.5; // Erupt for 0.5 to 2 seconds
      }
    }

    particles.forEach((p, i) => {
      if (p.life > 0) {
        // Active particle physics
        p.vy -= safeDelta * 40; // Gravity
        p.x += p.vx * safeDelta;
        p.y += p.vy * safeDelta;
        p.z += p.vz * safeDelta;

        p.life -= safeDelta;
        p.scale -= safeDelta * 0.02; // Shrink slowly

        if (p.y < -15 || p.life <= 0 || p.scale <= 0) {
          p.life = 0; // kill it
          p.scale = 0;
        }
      } else if (state.isErupting && Math.random() < 0.2) {
        // Respawn randomly during an active eruption burst
        p.x = (Math.random() - 0.5) * 2;
        p.y = Math.random() * 2 + 8;
        p.z = (Math.random() - 0.5) * 2;
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = Math.random() * 30 + 15;
        p.vz = (Math.random() - 0.5) * 20;
        p.scale = Math.random() * 0.05 + 0.01; // EXTREMELY tiny scale
        p.life = Math.random() * 1.5 + 0.5;
      } else {
        p.scale = 0; // ensure invisible when dead
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      position={[0, 0, 0]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ff3300" transparent opacity={0.9} />
    </instancedMesh>
  );
}

// ── Volcano Smoke Particle System ──────────────────────────────────────────
function VolcanoSmoke() {
  const count = 50; // Drastically reduced volume (thickness)
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 2.5, // Tighter radius
      y: Math.random() * 10 - 5,
      z: (Math.random() - 0.5) * 2.5, // Tighter radius
      speed: Math.random() * 0.5 + 0.3,
      scale: Math.random() * 8 + 4, // Smaller individual smoke clouds
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.01,
    }));
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const safeDelta = Math.min(delta, 0.1);

    particles.forEach((p, i) => {
      p.y += p.speed * safeDelta * 8;
      p.rot += p.rotSpeed;
      p.scale += safeDelta * 0.8; // Grow slower
      p.x += (Math.random() - 0.5) * safeDelta * 0.5; // Less horizontal drift
      p.z += (Math.random() - 0.5) * safeDelta * 0.5;

      if (p.y > 25) {
        p.y = Math.random() * 4 - 8;
        p.x = (Math.random() - 0.5) * 2.5; // Reset tightly
        p.z = (Math.random() - 0.5) * 2.5; // Reset tightly
        p.scale = Math.random() * 6 + 4;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, p.rot);
      dummy.scale.set(p.scale, p.scale, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      position={[0, 6, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={0.3} // Lower opacity for thinner smoke
        depthWrite={false}
        color="#030303" // Pitch black smoke
      />
    </instancedMesh>
  );
}

// ── Volcano Ash Smoke (Wider, Gray Smoke) ────────────────────────────────
function VolcanoAshSmoke() {
  const count = 20; // Less volume compared to black smoke
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");

  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(() => {
    return Array.from({ length: count }, () => ({
      x: (Math.random() - 0.5) * 8, // Wider spread right from the crater
      y: Math.random() * 10 - 2,
      z: (Math.random() - 0.5) * 8,
      speed: Math.random() * 0.4 + 0.2, // Slower rise
      scale: Math.random() * 10 + 6,
      rot: Math.random() * Math.PI * 2,
      rotSpeed: (Math.random() - 0.5) * 0.02, // Slightly faster rotation
    }));
  }, [count]);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const safeDelta = Math.min(delta, 0.1);

    particles.forEach((p, i) => {
      p.y += p.speed * safeDelta * 7;
      p.rot += p.rotSpeed;
      p.scale += safeDelta * 1.5; // Grow faster for a spread-out effect
      p.x += (Math.random() - 0.5) * safeDelta * 2.0; // More horizontal drift
      p.z += (Math.random() - 0.5) * safeDelta * 2.0;

      if (p.y > 28) {
        p.y = Math.random() * 4 - 2;
        p.x = (Math.random() - 0.5) * 8;
        p.z = (Math.random() - 0.5) * 8;
        p.scale = Math.random() * 8 + 6;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, p.rot);
      dummy.scale.set(p.scale, p.scale, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, count]}
      position={[0, 6, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent={true}
        opacity={0.25} // Subtly transparent
        depthWrite={false}
        color="#777777" // Gray ash smoke
      />
    </instancedMesh>
  );
}

// ── Volcano Active Effects (Lighting, Sparks, Smoke) ─────────────────────
function VolcanoEffects() {
  return (
    <group position={[0, 0, 0]}>
      {/* Intense magma core lighting */}
      <pointLight
        color="#ff3300"
        intensity={300}
        distance={150}
        decay={1.5}
        position={[0, 10, 0]}
      />
      <pointLight
        color="#ff1100"
        intensity={400}
        distance={50}
        decay={2}
        position={[0, 12, 0]}
      />

      {/* Erupting Embers / Scatter */}
      <VolcanoEruptionParticles />

      {/* Thick black smoke */}
      <VolcanoSmoke />

      {/* Spreading gray ash smoke */}
      <VolcanoAshSmoke />
    </group>
  );
}

export default function Volcano({
  position = [0, 0, 12000] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = 18,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
}) {
  const gl = useThree((state) => state.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let isMounted = true;

    loadVolcanoScene(gl)
      .then((loadedScene) => {
        if (isMounted) setScene(loadedScene);
      })
      .catch((err) => {
        console.error("❌ Error loading volcano model:", err);
      });

    return () => {
      isMounted = false;
    };
  }, [gl]);

  if (!scene) return null;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} />
      <FlowingLavaShader scene={scene} />
      <VolcanoEffects />
    </group>
  );
}
