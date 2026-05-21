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
import type { TransitionEvent } from "react";
import * as THREE from "three";
import { Canvas } from "@react-three/fiber";
import { useFrame } from "@react-three/fiber";
import MusicPlayer from "../ui/MusicPlayer";
import TheatreSetup from "../TheatreSetup";
import LightBeam from "../environment/LightBeam";
import CloudTunnel from "../environment/CloudTunnel";
// import CaveScene from "../cave/CaveScene";
import PalaceScene from "../palace/PalaceScene";
// import OceanScene from "../ocean/OceanScene";
import type { SceneId } from "./useSceneStore";
import {
  onTransitionRequest,
  onSceneReady,
  signalSceneReady,
  signalIntroComplete,
} from "./useSceneStore";

// ── Constants ─────────────────────────────────────────────────────────────

/**
 * How long (ms) to wait after WarmupController fires signalSceneReady()
 * before starting the black overlay fade-out.  Gives the GPU a moment to
 * finish any final async pipeline work after the warmup frames.
 */
const POST_WARMUP_BUFFER_MS = 200;

/** Duration of the HTML overlay CSS fade (ms). */
const OVERLAY_FADE_MS = 1000;

// ── Phase ─────────────────────────────────────────────────────────────────
type Phase =
  | "booting" // warmup in progress, overlay solid
  | "idle" // scene playing, no transition
  | "black_fade_in" // overlay 0→1 (ocean→cave loop)
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

// ── SceneOrchestrator ─────────────────────────────────────────────────────

export default function SceneOrchestrator() {
  // Which scene is logically active (controls camera, sequences, audio)
  // const [activeScene, setActiveScene] = useState<SceneId>("cave");
  const [activeScene, setActiveScene] = useState<SceneId>("palace");

  // During warmup ALL scenes are visible so Three.js compiles their shaders
  const [warmupVisible, setWarmupVisible] = useState(true);

  // HTML overlay state
  const [overlayOpaque, setOverlayOpaque] = useState(true); // opacity 1/0
  const [overlayAnimated, setOverlayAnimated] = useState(false); // CSS transition on/off

  // CloudTunnel state
  const [tunnelActive, setTunnelActive] = useState(false);

  // Phase lives in a ref so event-bus callbacks always read the current value
  const phaseRef = useRef<Phase>("booting");
  // const pendingSceneRef = useRef<SceneId>("cave");
  const pendingSceneRef = useRef<SceneId>("palace");

  // ── onSceneReady: fired by WarmupController after WARMUP_FRAMES frames ──
  useEffect(() => {
    return onSceneReady(() => {
      if (phaseRef.current !== "booting") return;

      setTimeout(() => {
        setWarmupVisible(false); // hide inactive scenes — warmup done
        setOverlayAnimated(true); // enable CSS transition
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

      if (type === "black") {
        phaseRef.current = "black_fade_in";
        setOverlayOpaque(true); // trigger CSS fade-in
      } else {
        phaseRef.current = "tunnel_in";
        setTunnelActive(true);
      }
    });
  }, []); // permanent listener

  // ── CloudTunnel: fully opaque → swap scene instantly ─────────────────
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

  // ── HTML overlay CSS transition end ───────────────────────────────────
  const handleOverlayTransitionEnd = useCallback(
    (e: TransitionEvent<HTMLDivElement>) => {
      if (e.propertyName !== "opacity") return;

      if (phaseRef.current === "black_fade_out") {
        // Overlay has faded out — we're idle and the scene is fully visible
        phaseRef.current = "idle";
        signalIntroComplete();
      } else if (phaseRef.current === "black_fade_in") {
        // Overlay is now solid black — swap scene instantly then fade out
        // Scene swap = zero-cost visibility toggle (already compiled & in VRAM)
        setActiveScene(pendingSceneRef.current);
        phaseRef.current = "black_fade_out";
        setOverlayOpaque(false); // start fade-out immediately
      }
    },
    [],
  );

  // ── Derived: is each scene visible? ──────────────────────────────────
  // During warmup all scenes are visible.  After warmup only the active scene.
  // const caveVisible    = warmupVisible || activeScene === "cave";
  const palaceVisible = warmupVisible || activeScene === "palace";
  // const oceanVisible   = warmupVisible || activeScene === "ocean";

  return (
    <main
      style={{
        position: "relative",
        width: "100vw",
        height: "100vh",
        overflow: "hidden",
      }}
    >
      {/* ── HTML Black Overlay ──────────────────────────────────────────
          Starts solid (opacity:1, no transition) to hide shader warmup.
          overlayAnimated becomes true right before the first fade, so the
          initial state is always an instant cut-to-black, never a flash.
      ─────────────────────────────────────────────────────────────────── */}
      <div
        onTransitionEnd={handleOverlayTransitionEnd}
        style={{
          position: "absolute",
          inset: 0,
          background: "#000000",
          zIndex: 50,
          opacity: overlayOpaque ? 1 : 0,
          transition: overlayAnimated
            ? `opacity ${OVERLAY_FADE_MS}ms ease-in-out`
            : "none",
          pointerEvents: overlayOpaque ? "auto" : "none",
        }}
      />

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
          <LightBeam />
          <CloudTunnel
            isActive={tunnelActive}
            onFullyOpaque={handleTunnelOpaque}
            onFullyHidden={handleTunnelHidden}
          />

          {/* All scenes load in parallel under the single Suspense.
              WarmupController fires only after every scene's Suspense resolves. */}
          <Suspense fallback={null}>
            <WarmupController />

            {/* <CaveScene
              isActive={activeScene === "cave"}
              isVisible={caveVisible}
            /> */}
            <PalaceScene
              isActive={activeScene === "palace"}
              isVisible={palaceVisible}
            />
            {/* <OceanScene
              isActive={activeScene === "ocean"}
              isVisible={oceanVisible}
            /> */}
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
        <div style={{ pointerEvents: "auto" }}>
          <MusicPlayer />
        </div>
      </div>
    </main>
  );
}
