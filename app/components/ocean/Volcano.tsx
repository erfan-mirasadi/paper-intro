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

function VideoLayer({
  play,
  opacityRef,
}: {
  play: boolean;
  opacityRef: React.MutableRefObject<number>;
}) {
  const [texture, setTexture] = useState<THREE.VideoTexture | null>(null);
  const [aspect, setAspect] = useState(1);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const materialRef = useRef<THREE.SpriteMaterial>(null!);

  useEffect(() => {
    const video = document.createElement("video");
    video.src = "/assets/ocean/VFX-volcano.mov";
    video.crossOrigin = "anonymous";
    video.loop = false; // ← plays exactly ONCE
    video.muted = true;
    video.playsInline = true;
    video.preload = "auto"; // Preload video to avoid lag spike on play
    videoRef.current = video;

    video.addEventListener("loadedmetadata", () => {
      if (video.videoHeight > 0)
        setAspect(video.videoWidth / video.videoHeight);
    });

    const tex = new THREE.VideoTexture(video);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.minFilter = THREE.LinearFilter;
    tex.magFilter = THREE.LinearFilter;
    tex.generateMipmaps = false;
    setTexture(tex);

    return () => {
      video.pause();
      video.removeAttribute("src");
      video.load();
      tex.dispose();
    };
  }, []);

  // Start playback when 'play' becomes true
  useEffect(() => {
    if (play && videoRef.current) {
      videoRef.current.currentTime = 0;
      videoRef.current
        .play()
        .catch((e) => console.warn("Volcano video play failed:", e));
    }
  }, [play]);

  useFrame(() => {
    if (materialRef.current) {
      materialRef.current.opacity = opacityRef.current;
    }
  });

  if (!texture) return null;

  const height = 20;
  return (
    <sprite position={[0, 12, 0]} scale={[height * aspect, height, 1]}>
      <spriteMaterial
        ref={materialRef}
        map={texture}
        blending={THREE.AdditiveBlending}
        transparent
        depthWrite={false}
        toneMapped={false}
        fog={false}
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
  scaleMultiplier?: number; // Optional scale override
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
        scale: (Math.random() * 8 + 4) * (config.scaleMultiplier || 1.0),
        rot: Math.random() * Math.PI * 2,
        rotSpeed: (Math.random() - 0.5) * 0.015,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [config.count, config.spread, config.scaleMultiplier],
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
        pt.scale = (Math.random() * 6 + 4) * (config.scaleMultiplier || 1.0);
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
  opacity: 0.12,
  spread: 3.5,
  scaleMultiplier: 0.25,
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
// VolcanoTimeline — the single source of truth for the eruption sequence.
// ─────────────────────────────────────────────────────────────────────────────

interface TimelinePhases {
  video: boolean;
  particles: boolean;
}

const INITIAL_PHASES: TimelinePhases = {
  video: false,
  particles: false,
};

function setupLavaMaterial(
  mesh: THREE.Mesh,
  mat: THREE.MeshStandardMaterial,
  active: boolean,
) {
  if (mat.emissive) mat.emissive.setHex(0xffffff);

  if (!mat.userData.customCompiled) {
    mat.userData.customCompiled = true;
    mat.userData.uPourProgress = { value: 0.0 };

    if (!mesh.geometry.boundingBox) mesh.geometry.computeBoundingBox();
    const box = mesh.geometry.boundingBox;
    const minY = box ? box.min.y : 0;
    const maxY = box ? box.max.y : 10;
    const height = maxY - minY;
    const buffer = height * 0.05;

    mat.userData.uMinY = { value: minY - buffer };
    mat.userData.uMaxY = { value: maxY + buffer };

    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uPourProgress = mat.userData.uPourProgress;
      shader.uniforms.uMinY = mat.userData.uMinY;
      shader.uniforms.uMaxY = mat.userData.uMaxY;

      shader.vertexShader = shader.vertexShader.replace(
        "#include <common>",
        `#include <common>
         varying vec3 vLocalPos;`,
      );
      shader.vertexShader = shader.vertexShader.replace(
        "#include <begin_vertex>",
        `#include <begin_vertex>
         vLocalPos = position.xyz;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <common>",
        `#include <common>
         varying vec3 vLocalPos;
         uniform float uPourProgress;
         uniform float uMinY;
         uniform float uMaxY;`,
      );

      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        `#include <emissivemap_fragment>
         float currentY = mix(uMaxY, uMinY, uPourProgress);
         float edgeWidth = max(0.1, (uMaxY - uMinY) * 0.1);
         float pourMask = smoothstep(currentY - edgeWidth, currentY + edgeWidth, vLocalPos.y);
         totalEmissiveRadiance *= pourMask;
        `,
      );
    };
    mat.needsUpdate = true;
  }
}

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
  const videoOpacityRef = useRef(0);

  // React state only for mounting/unmounting sub-components (fires once per phase)
  const [phases, setPhases] = useState<TimelinePhases>(INITIAL_PHASES);

  // ── Phase Setup & Reset ───────────────────────────────────────────────────
  useEffect(() => {
    // Run this whenever active state changes or scene mounts
    scene.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        const raw = mesh.material;
        const candidates = Array.isArray(raw) ? raw : [raw];
        candidates.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          setupLavaMaterial(mesh, mat, active);
          if (!active) {
            mat.emissiveIntensity = 0; // Reset emission if inactive
            if (mat.userData.uPourProgress)
              mat.userData.uPourProgress.value = 0;
          }
        });
      }
    });

    if (!active) {
      elapsed.current = 0;
      smokeProgressRef.current = 0;
      videoOpacityRef.current = 0;
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
        const mesh = child as THREE.Mesh;
        const raw = mesh.material;
        const candidates = Array.isArray(raw) ? raw : [raw];
        candidates.forEach((m) => {
          const mat = m as THREE.MeshStandardMaterial;
          setupLavaMaterial(mesh, mat, activeRef.current);
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
    if (!f.videoEnd && t >= T.videoStart + TIMELINE.videoDuration) {
      f.videoEnd = true;
      setPhases((p) => ({ ...p, video: false }));
    }

    // ── Video Opacity Fade Out ─────────────────────────────────────────────
    if (f.video && !f.videoEnd) {
      const timeInVideo = t - T.videoStart;
      const FADE_OUT_DUR = 0.5; // seconds to fade out at the end

      if (timeInVideo > TIMELINE.videoDuration - FADE_OUT_DUR) {
        // Fade out
        videoOpacityRef.current = Math.max(
          0,
          (TIMELINE.videoDuration - timeInVideo) / FADE_OUT_DUR,
        );
      } else {
        videoOpacityRef.current = 1;
      }
    } else {
      videoOpacityRef.current = 0;
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
      const emissionProgress = Math.min((t - T.videoStart) / 4.5, 1.0);
      const ease =
        emissionProgress * emissionProgress * (3 - 2 * emissionProgress);

      scene.traverse((child) => {
        if ((child as THREE.Mesh).isMesh) {
          const raw = (child as THREE.Mesh).material;
          const candidates = Array.isArray(raw) ? raw : [raw];
          candidates.forEach((m) => {
            const mat = m as THREE.MeshStandardMaterial;
            mat.emissiveIntensity = ease * 10.0;
            if (mat.userData.uPourProgress) {
              mat.userData.uPourProgress.value = ease;
            }
          });
        }
      });
    }
  });

  return (
    <>
      {/* Video — plays once, fades out smoothly via opacityRef */}
      <VideoLayer play={phases.video} opacityRef={videoOpacityRef} />

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
  scale = [18, 18, 18] as [number, number, number] | number,
  valleyPosition = [-6, 0, 6] as [number, number, number],
  valleyRotation = [0, 0, 0] as [number, number, number],
  valleyScale = [0.09, 0.07, 0.09] as [number, number, number] | number,
  startSequence = false,
  onCameraShakeStart,
}: {
  position?: [number, number, number];
  rotation?: [number, number, number];
  scale?: number | [number, number, number];
  valleyPosition?: [number, number, number];
  valleyRotation?: [number, number, number];
  valleyScale?: number | [number, number, number];
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
        if (live) {
          s.traverse((child) => {
            if ((child as THREE.Mesh).isMesh) {
              const mesh = child as THREE.Mesh;
              const raw = mesh.material;
              const candidates = Array.isArray(raw) ? raw : [raw];
              candidates.forEach((m) => {
                const mat = m as THREE.MeshStandardMaterial;
                if (mat.color) mat.color.setHex(0x525252);
                mat.needsUpdate = true;
              });
            }
          });
          setValleyScene(s);
        }
      })
      .catch((err) => console.error("❌ Valley load error:", err));

    return () => {
      live = false;
    };
  }, [gl]);

  if (!scene) return null;

  const scaleArr: [number, number, number] = Array.isArray(scale)
    ? scale
    : [scale, scale, scale];

  const vScaleArr: [number, number, number] = Array.isArray(valleyScale)
    ? valleyScale
    : [valleyScale, valleyScale, valleyScale];

  // We use the X scale as the uniform size for VFX so it matches the crater width without stretching.
  const vfxUniformScale = scaleArr[0];
  // The crater is roughly at Y=8. We shift the VFX up to match the non-uniform Y scaling of the volcano.
  const vfxYOffset = 8 * (scaleArr[1] - scaleArr[0]);

  return (
    <group position={position} rotation={rotation}>
      <primitive
        object={scene}
        scale={[scaleArr[0] * 25, scaleArr[1] * 25, scaleArr[2] * 25]}
        rotation={[0, Math.PI, 0]}
      />
      {valleyScene && (
        <primitive
          object={valleyScene}
          position={[
            valleyPosition[0] * scaleArr[0],
            valleyPosition[1] * scaleArr[1],
            valleyPosition[2] * scaleArr[2],
          ]}
          rotation={valleyRotation}
          scale={[
            vScaleArr[0] * scaleArr[0],
            vScaleArr[1] * scaleArr[1],
            vScaleArr[2] * scaleArr[2],
          ]}
        />
      )}

      <group scale={vfxUniformScale} position={[0, vfxYOffset, 0]}>
        <VolcanoTimeline
          scene={scene}
          active={startSequence}
          onCameraShakeStart={onCameraShakeStart}
        />
      </group>
    </group>
  );
}
