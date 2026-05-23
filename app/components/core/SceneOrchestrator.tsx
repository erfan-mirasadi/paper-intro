"use client";

/**
 * SceneOrchestrator.tsx  —  "Museum Basement" architecture
 * ──────────────────────────────────────────────────────────────────────────
 * ALL THREE SCENES ARE MOUNTED SIMULTANEOUSLY, FOREVER.
 *
 * WHY THIS ELIMINATES LAG:
 *  WebGL only compiles shaders when an object is RENDERED (not just mounted).
 *  During boot, the HTML black overlay covers the canvas while ALL scenes
 *  render for 3 frames.  Every shader across every scene gets compiled in
 *  those silent frames.  After that, toggling scene visibility is a zero-cost
 *  GPU operation — no recompilation, no CPU stutter, no unmounts.
 *
 * WARM-UP STRATEGY:
 *  1. Boot: HTML overlay is solid black.
 *  2. All 3 scenes are mounted AND visible (warmupVisible = true).
 *  3. WarmupController counts 3 render frames → fires signalSceneReady().
 *  4. Orchestrator: warmupVisible = false (inactive scenes hide), overlay fades out.
 *  5. Transitions from this point forward are instant visibility toggles.
 *
 * GLOBAL-STATE CONFLICTS:
 *  AnimatedFog (scene.fog) and Skybox (Environment) write to scene-wide state.
 *  Each is now guarded by the scene's isActive prop so only the active scene
 *  controls global fog / environment.
 *
 * TRANSITION FLOW:
 *  Tunnel (Cave→Palace, Palace→Ocean):
 *    requestTransition('tunnel', next)
 *    → CloudTunnel fades in → onFullyOpaque → setActiveScene(next)  [instant]
 *    → setTunnelActive(false) [next RAF] → tunnel fades out
 *    → onTunnelHidden → idle + signalIntroComplete()
 *
 *  Black overlay (Ocean→Cave loop):
 *    requestTransition('black', next)
 *    → overlay fades in → onTransitionEnd → setActiveScene(next)  [instant]
 *    → overlay fades out → onTransitionEnd → idle + signalIntroComplete()
 * ──────────────────────────────────────────────────────────────────────────
 */

import { useState, useEffect, useRef, useCallback, Suspense } from "react";
// import type { TransitionEvent } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import { useProgress } from "@react-three/drei";
import MusicPlayer from "../ui/MusicPlayer";
import TheatreSetup from "../TheatreSetup";
import LightBeam from "../environment/LightBeam";
// import CloudTunnel from "../environment/CloudTunnel";
import CaveScene from "../cave/CaveScene";
import PalaceScene from "../palace/PalaceScene";
import OceanScene from "../ocean/OceanScene";
import Effect from "./Effect";
import type { SceneId } from "./useSceneStore";
import {
  onTransitionRequest,
  onSceneReady,
  signalSceneReady,
  signalIntroComplete,
} from "./useSceneStore";
import StoryOverlay from "../ui/StoryOverlay";

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * How long (ms) to wait after WarmupController fires signalSceneReady()
 * before starting the black overlay fade-out.  Gives the GPU a moment to
 * finish any final async pipeline work after the warmup frames.
 */
const POST_WARMUP_BUFFER_MS = 200;

/** Duration of the HTML overlay CSS fade (ms). */
const OVERLAY_FADE_MS = 3000;

/** How long to hold the screen fully black before starting the new scene (ms). */
const BLACK_HOLD_MS = 4000;

// ── Phase ─────────────────────────────────────────────────────────────────
type Phase =
  | "booting" // warmup in progress, overlay solid
  | "idle" // scene playing, no transition
  | "black_fade_in" // overlay 0→1 (ocean→cave loop)
  | "black_hold" // screen is solid black, showing text
  | "black_fade_out" // overlay 1→0
  | "tunnel_in" // CloudTunnel ramping to opaque
  | "tunnel_out"; // CloudTunnel fading out

// ── WarmupController ──────────────────────────────────────────────────────
/**
 * Lives inside the Canvas / Suspense.  Counts render frames so that Three.js
 * has had a chance to compile every shader in every mounted scene.
 * Fires signalSceneReady() after WARMUP_FRAMES frames.
 */
const WARMUP_FRAMES = 3;

function WarmupController() {
  const count = useRef(0);
  const fired = useRef(false);

  useFrame(() => {
    if (fired.current) return;
    count.current++;
    if (count.current >= WARMUP_FRAMES) {
      fired.current = true;
      signalSceneReady();
    }
  });

  return null;
}

// ── WebGLFade ─────────────────────────────────────────────────────────────
/**
 * Renders a full-screen quad attached to the active camera.
 * renderOrder=900 so it covers all scenes, but allows LightBeam (renderOrder=999)
 * to render ON TOP of the fade transition.
 */
function WebGLFade({
  opaque,
  color,
  onFadeInComplete,
  onFadeOutComplete,
}: {
  opaque: boolean;
  color: string;
  onFadeInComplete: () => void;
  onFadeOutComplete: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const firedRef = useRef(false);

  useEffect(() => {
    firedRef.current = false;
  }, [opaque]);

  useFrame((state, delta) => {
    if (!meshRef.current || !materialRef.current) return;

    // Attach to active camera
    if (meshRef.current.parent !== state.camera) {
      state.camera.add(meshRef.current);
    }

    const targetOpacity = opaque ? 1 : 0;
    const currentOpacity = materialRef.current.opacity;

    if (currentOpacity !== targetOpacity) {
      // Transition over OVERLAY_FADE_MS
      const step = delta / (OVERLAY_FADE_MS / 1000);

      let newOpacity = currentOpacity;
      if (targetOpacity === 1) {
        newOpacity = Math.min(1, currentOpacity + step);
        if (newOpacity === 1 && !firedRef.current) {
          firedRef.current = true;
          onFadeInComplete();
        }
      } else {
        newOpacity = Math.max(0, currentOpacity - step);
        if (newOpacity === 0 && !firedRef.current) {
          firedRef.current = true;
          onFadeOutComplete();
        }
      }
      materialRef.current.opacity = newOpacity;
    }
  });

  return (
    <mesh ref={meshRef} position={[0, 0, -0.1]} renderOrder={900}>
      <planeGeometry args={[10, 10]} />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent={true}
        opacity={1} // Start fully opaque for warmup
        depthTest={false}
        depthWrite={false}
        toneMapped={false}
      />
    </mesh>
  );
}

// ── LoadingScreen ─────────────────────────────────────────────────────────
function LoadingScreen({ visible }: { visible: boolean }) {
  const { progress } = useProgress();
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        backgroundColor: "#030507",
        zIndex: 100, // Highest z-index to cover everything including LightBeam
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        opacity: visible ? 1 : 0,
        transition: "opacity 1.5s ease-in-out",
        pointerEvents: visible ? "auto" : "none",
        color: "#ffffff",
        fontFamily: "sans-serif",
      }}
    >
      <div
        style={{
          letterSpacing: "3px",
          textTransform: "uppercase",
          fontSize: "12px",
          marginBottom: "20px",
        }}
      >
        Loading...
      </div>
      <div
        style={{
          width: "200px",
          height: "2px",
          backgroundColor: "rgba(255,255,255,0.1)",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            width: `${progress}%`,
            height: "100%",
            backgroundColor: "#ffffff",
            transition: "width 0.2s",
          }}
        />
      </div>
    </div>
  );
}

// ── SceneOrchestrator ─────────────────────────────────────────────────────

export default function SceneOrchestrator() {
  // Which scene is logically active (controls camera, sequences, audio)
  const [activeScene, setActiveScene] = useState<SceneId>("ocean");

  // Which scene's text should the StoryOverlay be playing?
  // We can advance this BEFORE activeScene to show text on the black screen.
  const [storyScene, setStoryScene] = useState<SceneId>("ocean");

  // During warmup ALL scenes are visible so Three.js compiles their shaders
  const [warmupVisible, setWarmupVisible] = useState(true);

  // Fade overlay state
  const [overlayOpaque, setOverlayOpaque] = useState(true); // opacity 1/0
  const [overlayColor, setOverlayColor] = useState("#000000"); // Color for the fade overlay

  // CloudTunnel state
  // const [tunnelActive, setTunnelActive] = useState(false);

  // Phase lives in a ref so event-bus callbacks always read the current value
  const phaseRef = useRef<Phase>("booting");
  const pendingSceneRef = useRef<SceneId>("cave");

  // ── onSceneReady: fired by WarmupController after WARMUP_FRAMES frames ──
  useEffect(() => {
    return onSceneReady(() => {
      if (phaseRef.current !== "booting") return;

      setTimeout(() => {
        setWarmupVisible(false); // hide inactive scenes — warmup done
        phaseRef.current = "black_fade_out";
        setOverlayOpaque(false); // start the first fade-out
      }, POST_WARMUP_BUFFER_MS);
    });
  }, []); // permanent listener

  // ── onTransitionRequest: fired by active scenes ───────────────────────
  useEffect(() => {
    return onTransitionRequest((type, next) => {
      if (phaseRef.current !== "idle") return; // ignore if already transitioning
      pendingSceneRef.current = next;

      // ── TEMPORARY DEBUG OVERRIDE ──────────────────────────────────────
      // The user requested to bypass CloudTunnel and use simple HTML fades
      // for all transitions to debug lag.
      // Fade is black for all scenes, except white when going to Ocean.
      if (next === "ocean") {
        setOverlayColor("#ffffff");
      } else {
        setOverlayColor("#000000");
      }

      phaseRef.current = "black_fade_in";
      setOverlayOpaque(true); // trigger CSS fade-in

      // Original logic (commented out):
      // if (type === "black") {
      //   phaseRef.current = "black_fade_in";
      //   setOverlayOpaque(true); // trigger CSS fade-in
      // } else {
      //   phaseRef.current = "tunnel_in";
      //   setTunnelActive(true);
      // }
    });
  }, []); // permanent listener

  // ── CloudTunnel: fully opaque → swap scene instantly ─────────────────
  /*
  const handleTunnelOpaque = useCallback(() => {
    if (phaseRef.current !== "tunnel_in") return;

    // Scene swap is a zero-cost visibility toggle — no loading needed
    phaseRef.current = "tunnel_out";
    setActiveScene(pendingSceneRef.current);

    // Give React one render cycle to apply the new activeScene, then
    // start fading the tunnel out so the new scene is revealed cleanly.
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setTunnelActive(false)),
    );
  }, []);

  // ── CloudTunnel: fully hidden → idle ─────────────────────────────────
  const handleTunnelHidden = useCallback(() => {
    if (phaseRef.current !== "tunnel_out") return;
    phaseRef.current = "idle";
    signalIntroComplete();
  }, []);
  */

  // ── WebGL Fade transition end ───────────────────────────────────
  const handleFadeInComplete = useCallback(() => {
    if (phaseRef.current === "black_fade_in") {
      phaseRef.current = "black_hold";

      // Advance the story text immediately so it plays on the black screen
      setStoryScene(pendingSceneRef.current);

      // Wait for BLACK_HOLD_MS before starting the actual 3D scene
      setTimeout(() => {
        setActiveScene(pendingSceneRef.current);
        phaseRef.current = "black_fade_out";
        setOverlayOpaque(false); // start fade-out immediately
      }, BLACK_HOLD_MS);
    }
  }, []);

  const handleFadeOutComplete = useCallback(() => {
    if (phaseRef.current === "black_fade_out") {
      // Overlay has faded out — we're idle and the scene is fully visible
      phaseRef.current = "idle";
      signalIntroComplete();
    }
  }, []);

  // ── Derived: is each scene visible? ──────────────────────────────────
  // During warmup all scenes are visible.  After warmup only the active scene.
  const caveVisible = warmupVisible || activeScene === "cave";
  const palaceVisible = warmupVisible || activeScene === "palace";
  const oceanVisible = warmupVisible || activeScene === "ocean";

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* Elegant HTML Loading Screen to cover shader compilation stutter */}
      <LoadingScreen visible={warmupVisible} />

      {/* ── Three.js Canvas ─────────────────────────────────────────────
          All scenes are ALWAYS mounted here.  The Suspense resolves only
          when every GLTF in every scene has finished loading, at which point
          WarmupController begins counting render frames.
      ─────────────────────────────────────────────────────────────────── */}
      <Canvas
        shadows
        gl={{
          antialias: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          localClippingEnabled: true,
        }}
        dpr={[1, 2]}
        style={{ position: "absolute", inset: 0, zIndex: 10 }}
      >
        <TheatreSetup>
          {/* Permanent root elements — never unmount, always camera-locked */}
          <LightBeam activeScene={activeScene} />
          <WebGLFade
            opaque={overlayOpaque}
            color={overlayColor}
            onFadeInComplete={handleFadeInComplete}
            onFadeOutComplete={handleFadeOutComplete}
          />
          <Effect />
          {/* <CloudTunnel
            isActive={tunnelActive}
            onFullyOpaque={handleTunnelOpaque}
            onFullyHidden={handleTunnelHidden}
          /> */}

          {/* All scenes load in parallel under the single Suspense.
              WarmupController fires only after every scene's Suspense resolves. */}
          <Suspense fallback={null}>
            <WarmupController />

            <CaveScene
              isActive={activeScene === "cave"}
              isVisible={caveVisible}
            />
            <PalaceScene
              isActive={activeScene === "palace"}
              isVisible={palaceVisible}
            />
            <OceanScene
              isActive={activeScene === "ocean"}
              isVisible={oceanVisible}
            />
          </Suspense>
        </TheatreSetup>
      </Canvas>

      {/* UI: above Canvas (z:30), below overlay (z:50) */}
      <div
        style={{
          position: "absolute",
          inset: 0,
          zIndex: 30,
          pointerEvents: "none",
        }}
      >
        <StoryOverlay activeScene={storyScene} />
        <div style={{ pointerEvents: "auto" }}>
          <MusicPlayer />
        </div>
      </div>
    </main>
  );
}
