"use client";

import { useEffect, useState, useRef, useMemo } from "react";
import { useThree, useFrame, useLoader } from "@react-three/fiber";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { getSharedKTX2Loader, getSharedDRACOLoader } from "../SharedLoaders";
import { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";
import * as THREE from "three";

// ─────────────────────────────────────────────────────────────────────────────
// TIMELINE CONFIG  ← All timing lives here. Nothing else needs to change.
// ─────────────────────────────────────────────────────────────────────────────

const TIMELINE = {
  videoDelay: 0.5, // sec: camera shake + video start after sequence begins
  videoDuration: 3.5, // sec: exact length of VFX-volcano.mp4
  preEndOffset: 2.5, // sec: smoke & particles appear this early before video ends
} as const;

/** Absolute timestamps derived once at module load. Read-only. */
const T = {
  cameraShake: TIMELINE.videoDelay,
  videoStart: TIMELINE.videoDelay,
  smokeStart:
    TIMELINE.videoDelay + TIMELINE.videoDuration - TIMELINE.preEndOffset,
  particleStart:
    TIMELINE.videoDelay + TIMELINE.videoDuration - TIMELINE.preEndOffset,
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Model loading (cached across renders / re-mounts)
// ─────────────────────────────────────────────────────────────────────────────

const gltfCache = new Map<string, THREE.Group>();
const VOLCANO_URL = "/assets/ocean/volcano-7.glb";

function loadVolcanoScene(
  gl: THREE.WebGLRenderer,
  url: string = VOLCANO_URL,
): Promise<THREE.Group> {
  if (gltfCache.has(url)) {
    return Promise.resolve(gltfCache.get(url)!);
  }
  return new Promise((resolve, reject) => {
    const loader = new GLTFLoader();
    loader.setDRACOLoader(getSharedDRACOLoader());
    if (MeshoptDecoder) loader.setMeshoptDecoder(MeshoptDecoder);
    loader.setKTX2Loader(getSharedKTX2Loader(gl));
    loader.load(
      url,
      (gltf) => {
        gltfCache.set(url, gltf.scene);
        resolve(gltf.scene);
      },
      undefined,
      reject,
    );
  });
}

export function preloadVolcano(gl: THREE.WebGLRenderer) {
  return loadVolcanoScene(gl);
}

// ─────────────────────────────────────────────────────────────────────────────
// VideoLayer — plays VFX-volcano.mp4 exactly ONCE.
// Mounted/visible only when `visible` is true (after T.videoStart).
// ─────────────────────────────────────────────────────────────────────────────

function VideoLayer({ visible }: { visible: boolean }) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [aspect, setAspect] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/assets/ocean/VFX-volcano.mp4";
    video.crossOrigin = "anonymous";
    video.loop = false; // ← plays exactly ONCE
    video.muted = true;
    video.playsInline = true;
    videoRef.current = video;

    video.addEventListener("loadedmetadata", () => {
      if (video.videoHeight > 0)
        setAspect(video.videoWidth / video.videoHeight);
    });

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    setTexture(tex);

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      tex.dispose();
    };
  }, []);

  // Start playback the moment this layer becomes visible
  useEffect(() => {
    if (visible && videoRef.current) {
      videoRef.current
        .play()
        .catch((e) => console.warn("Volcano video play failed:", e));
    }
  }, [visible]);

  if (!texture) return null;

  const height = 20;
  return (
    <sprite
      visible={visible}
      position={[0, 12, 0]}
      scale={[height * aspect, height, 1]}
    >
      <spriteMaterial
        map={texture}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
        color={new THREE.Color(1.2, 1.2, 1.2)} // Slight boost for vividness, without breaking black levels
      />
    </sprite>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SmokeParticles — instanced billboard smoke.
// `progressRef` (0 → 1) drives both scale and opacity, enabling a smooth
// "rise from below" reveal when the ref value goes from 0 to 1.
// ─────────────────────────────────────────────────────────────────────────────

interface SmokeConfig {
  count: number;
  color: string;
  opacity: number; // max opacity at progress=1
  spread: number; // XZ spawn radius
}

function SmokeParticles({
  config,
  progressRef,
}: {
  config: SmokeConfig;
  progressRef: React.MutableRefObject<number>;
}) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const texture = useLoader(THREE.TextureLoader, "/img/ulap.png");
  const dummy = useMemo(() => new THREE.Object3D(), []);

  const particles = useMemo(
    () =>
      Array.from({ length: config.count }, () => ({
        x: (Math.random() - 0.5) * config.spread,
        y: Math.random() * 10 - 5,
        z: (Math.random() - 0.5) * config.spread,
        speed: Math.random() * 0.5 + 0.3,
        scale: Math.random() * 8 + 4,
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.count, config.spread],
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.1);
    const p = progressRef.current;

    // Calculate ease-out for both scale and position
    const easeOut = 1 - Math.pow(1 - p, 3); // cubic ease-out

    particles.forEach((pt, i) => {
      pt.y += pt.speed * dt * 8;
      pt.rot += pt.rotSpeed;
      pt.scale += dt * 0.8;
      pt.x += (Math.random() - 0.5) * dt * 0.5;
      pt.z += (Math.random() - 0.5) * dt * 0.5;

      if (pt.y > 25) {
        pt.y = Math.random() * 4 - 8;
        pt.x = (Math.random() - 0.5) * config.spread;
        pt.z = (Math.random() - 0.5) * config.spread;
        pt.scale = Math.random() * 6 + 4;
      }

      dummy.position.set(pt.x, pt.y, pt.z);
      dummy.rotation.set(0, 0, pt.rot);
      const s = pt.scale * easeOut; // scale grows smoothly from 0 to full size
      dummy.scale.set(s, s, 1);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;

    // Gentle rise from slightly inside the crater
    meshRef.current.position.y = 2 + easeOut * 4; // rises from Y=2 to Y=6 slowly

    // Fade material opacity quickly in the first 20% of progress to avoid popping
    const mat = meshRef.current.material as THREE.MeshBasicMaterial;
    if (mat) mat.opacity = config.opacity * Math.min(p * 5, 1);
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, config.count]}
      position={[0, 6, 0]}
      frustumCulled={false}
    >
      <planeGeometry args={[1, 1]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={0}
        depthWrite={false}
        color={config.color}
      />
    </instancedMesh>
  );
}

// Smoke preset configs — easy to tune, declared at module level (no re-allocation)
const BLACK_SMOKE: SmokeConfig = {
  count: 50,
  color: "#030303",
  opacity: 0.3,
  spread: 2.5,
};
const ASH_SMOKE: SmokeConfig = {
  count: 20,
  color: "#777777",
  opacity: 0.25,
  spread: 8.0,
};

// ─────────────────────────────────────────────────────────────────────────────
// ParticleLayer — instanced eruption embers with burst cycle.
// CPU cost: zero when `active` is false.
// ─────────────────────────────────────────────────────────────────────────────

const EMBER_COUNT = 300;

function ParticleLayer({ active }: { active: boolean }) {
  const meshRef = useRef<THREE.InstancedMesh>(null!);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  // Burst state stored in a ref (no re-renders needed)
  const burst = useRef({ timer: 0, isErupting: false });

  const embers = useMemo(
    () =>
      Array.from({ length: EMBER_COUNT }, () => ({
        x: 0,
        y: 8,
        z: 0,
        vx: 0,
        vy: 0,
        vz: 0,
        scale: 0,
        life: 0,
      })),
    [],
  );

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    const dt = Math.min(delta, 0.1);
    const b = burst.current;

    // Advance burst timer only while active
    if (activeRef.current) {
      b.timer -= dt;
      if (b.timer <= 0) {
        b.isErupting = !b.isErupting;
        b.timer = b.isErupting
          ? Math.random() * 2.0 + 1.0 // erupt for 1–3 s
          : Math.random() * 0.8 + 0.2; // rest for 0.2–1 s (much shorter wait)
      }
    }

    embers.forEach((p, i) => {
      if (p.life > 0) {
        // Physics integration
        p.vy -= dt * 40;
        p.x += p.vx * dt;
        p.y += p.vy * dt;
        p.z += p.vz * dt;
        p.life -= dt;
        p.scale -= dt * 0.02;
        if (p.y < -15 || p.life <= 0 || p.scale <= 0) p.life = p.scale = 0;
      } else if (activeRef.current && b.isErupting && Math.random() < 0.2) {
        // Spawn a fresh ember during an active burst
        p.x = (Math.random() - 0.5) * 2;
        p.y = Math.random() * 2 + 8;
        p.z = (Math.random() - 0.5) * 2;
        p.vx = (Math.random() - 0.5) * 20;
        p.vy = Math.random() * 30 + 15;
        p.vz = (Math.random() - 0.5) * 20;
        p.scale = Math.random() * 0.05 + 0.01;
        p.life = Math.random() * 1.5 + 0.5;
      } else {
        p.scale = 0;
      }

      dummy.position.set(p.x, p.y, p.z);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(i, dummy.matrix);
    });

    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh
      ref={meshRef}
      args={[undefined, undefined, EMBER_COUNT]}
      position={[0, 0, 0]}
      frustumCulled={false}
    >
      <sphereGeometry args={[1, 4, 4]} />
      <meshBasicMaterial color="#ff3300" transparent opacity={0.9} />
    </instancedMesh>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VolcanoLighting — warm magma glow lights; always on once the model is shown.
// ─────────────────────────────────────────────────────────────────────────────

function VolcanoLighting() {
  return (
    <>
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
        decay={2.0}
        position={[0, 12, 0]}
      />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// VolcanoTimeline — the single source of truth for the eruption sequence.
//
// Phase progression (read T.* for exact times):
//   t=0.5s  → camera shake fires + video starts (simultaneously)
//   t=3.3s  → smoke fades in from below + embers activate
//   t=4.0s  → lava texture begins flowing
//
// Design decisions:
//  • `elapsed` and `fired` are refs → zero re-renders during animation
//  • Phase state updates happen exactly ONCE per phase (guarded by `fired`)
//  • `smokeProgressRef` is passed directly to SmokeParticles (no state needed)
//  • Reset on `active=false` returns everything to ground state cleanly
// ─────────────────────────────────────────────────────────────────────────────

interface TimelinePhases {
  video: boolean;
  particles: boolean;
}

const INITIAL_PHASES: TimelinePhases = {
  video: false,
  particles: false,
};

function VolcanoTimeline({
  scene,
  active,
  onCameraShakeStart,
}: {
  scene: THREE.Group;
  active: boolean;
  onCameraShakeStart?: () => void;
}) {
  const activeRef = useRef(active);
  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  const elapsed = useRef(0);
  const fired = useRef({
    shake: false,
    video: false,
    videoEnd: false,
    particles: false,
  });
  const smokeProgressRef = useRef(0); // 0→1, passed directly to SmokeParticles

  // React state only for mounting/unmounting sub-components (fires once per phase)
  const [phases, setPhases] = useState<TimelinePhases>(INITIAL_PHASES);

  // ── Phase Setup & Reset ───────────────────────────────────────────────────
  useEffect(() => {
    // Run this whenever active state changes or scene mounts
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const raw = (child as THREE.Mesh).material;
        const candidates = Array.isArray(raw) ? raw : [raw];
        candidates.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.emissive) mat.emissive.set(0xffffff); // Ensure emissive base color is white
          if (!active) {
            mat.emissiveIntensity = 0; // Reset emission if inactive
          }
          mat.needsUpdate = true;
        });
      }
    });

    if (!active) {
      elapsed.current = 0;
      smokeProgressRef.current = 0;
      fired.current = {
        shake: false,
        video: false,
        videoEnd: false,
        particles: false,
      };
      setPhases(INITIAL_PHASES);
    }
  }, [active, scene]);

  useFrame((_, delta) => {
    // ── Enforce Emissive Base Color (fixes KTX2 async texture replacement bug) ──
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const raw = (child as THREE.Mesh).material;
        const candidates = Array.isArray(raw) ? raw : [raw];
        candidates.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          if (mat.emissive) mat.emissive.set(0xffffff);
        });
      }
    });

    if (!activeRef.current) return;

    elapsed.current += Math.min(delta, 0.1);
    const t = elapsed.current;
    const f = fired.current;

    // ── Phase: camera shake + video ────────────────────────────────────────
    if (!f.shake && t >= T.cameraShake) {
      f.shake = true;
      onCameraShakeStart?.();
    }
    if (!f.video && t >= T.videoStart) {
      f.video = true;
      setPhases((p) => ({ ...p, video: true }));
    }
    // UNMOUNT video exactly when it ends so the last frame doesn't block the view!
    if (!f.videoEnd && t >= T.videoStart + TIMELINE.videoDuration) {
      f.videoEnd = true;
      setPhases((p) => ({ ...p, video: false }));
    }

    // ── Phase: smoke + particles ───────────────────────────────────────────
    if (t >= T.smokeStart) {
      // Smooth rise over 2.0 s from crater
      smokeProgressRef.current = Math.min((t - T.smokeStart) / 2.0, 1);
    }
    if (!f.particles && t >= T.particleStart) {
      f.particles = true;
      setPhases((p) => ({ ...p, particles: true }));
    }

    // Animate Volcano material emission (glow starts at explosion)
    if (t >= T.videoStart) {
      const emissionProgress = Math.min((t - T.videoStart) / 1.5, 1.0);
      const ease =
        emissionProgress * emissionProgress * (3 - 2 * emissionProgress);

      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const raw = (child as THREE.Mesh).material;
          const candidates = Array.isArray(raw) ? raw : [raw];
          candidates.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = ease * 10.0;
          });
        }
      });
    }
  });

  return (
    <>
      {/* <VolcanoLighting /> */}

      {/* Video — plays once, unmounts when not in sequence */}
      <VideoLayer visible={phases.video} />

      {/* Smoke — fades in from bottom via progressRef */}
      <SmokeParticles config={BLACK_SMOKE} progressRef={smokeProgressRef} />
      <SmokeParticles config={ASH_SMOKE} progressRef={smokeProgressRef} />

      {/* Embers — burst cycle starts when particles phase begins */}
      <ParticleLayer active={phases.particles} />
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Volcano — public API
//
// Props:
//   position / rotation / scale  →  placement in the world
//   startSequence                →  flip to `true` to begin the eruption timeline
//   onCameraShakeStart           →  callback fired at T.cameraShake (0.5 s)
//                                   wire this up to OceanCamera's shake system
// ─────────────────────────────────────────────────────────────────────────────

export default function Volcano({
  position = [0, 0, 12000] as [number, number, number],
  rotation = [0, 0, 0] as [number, number, number],
  scale = 18,
  valleyPosition = [-8, 0, 6] as [number, number, number],
  valleyRotation = [0, 0, 0] as [number, number, number],
  valleyScale = 0.08,
  startSequence = false,
  onCameraShakeStart,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number;
  valleyPosition?: [number, number, number];
  valleyRotation?: [number, number, number];
  valleyScale?: number;
  startSequence?: boolean;
  onCameraShakeStart?: () => void;
}) {
  const gl = useThree((s) => s.gl);
  const [scene, setScene] = useState<THREE.Group | null>(null);
  const [valleyScene, setValleyScene] = useState<THREE.Group | null>(null);

  useEffect(() => {
    let live = true;
    loadVolcanoScene(gl, VOLCANO_URL)
      .then((s) => {
        if (live) setScene(s);
      })
      .catch((err) => console.error("❌ Volcano load error:", err));

    loadVolcanoScene(gl, "/assets/ocean/mountainous_valley-opt.glb")
      .then((s) => {
        if (live) setValleyScene(s);
      })
      .catch((err) => console.error("❌ Valley load error:", err));

    return () => {
      live = false;
    };
  }, [gl]);

  if (!scene) return null;

  return (
    <group position={position} rotation={rotation} scale={scale}>
      <primitive object={scene} scale={25} rotation={[0, Math.PI, 0]} />
      {valleyScene && (
        <primitive
          object={valleyScene}
          position={valleyPosition}
          rotation={valleyRotation}
          scale={valleyScale}
        />
      )}
      <VolcanoTimeline
        scene={scene}
        active={startSequence}
        onCameraShakeStart={onCameraShakeStart}
      />
    </group>
  );
}
