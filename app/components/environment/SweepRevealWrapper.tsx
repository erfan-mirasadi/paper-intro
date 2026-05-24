import { useRef, useEffect, useCallback } from "react";
import * as THREE from "three";
import { useFrame, useThree } from "@react-three/fiber";
import { BEAM_COLOR } from "./LightBeam";
import { signalSweepStart, signalSweepSecondaryClick } from "../core/useSceneStore";

interface SweepRevealWrapperProps {
  children: React.ReactNode;
  epicenter?: [number, number, number]; // Where the shockwave originates
  dynamicEpicenter?: boolean; // If true, updates epicenter to camera XZ on reveal start
  maxRadius?: number; // How far the wave travels before stopping
  speed?: number; // How fast the wave expands per second
  beamColor?: number; // The color of the sweeping glow
  mode?: "reveal" | "overlay"; // Choose how the effect interacts with the scene
  darkness?: number; // 0.0 is pitch black, 1.0 is full original color
  trailLength?: number; // How long the glow trail is
  autoTriggerDelay?: number; // Optional delay (in ms) to auto-trigger the sweep on mount
  onRevealStart?: () => void;
}

export default function SweepRevealWrapper({
  children,
  epicenter = [0, 0, -50],
  dynamicEpicenter = true,
  maxRadius = 3000,
  speed = 250,
  beamColor = BEAM_COLOR,
  mode = "reveal", // Default mode is the dark-to-light reveal
  darkness = 0.01, // Default darkness level
  trailLength = 120.0, // Default trail length
  autoTriggerDelay,
  onRevealStart,
  isActive = true, // To handle resets during loops
}: SweepRevealWrapperProps & { isActive?: boolean }) {
  const groupRef = useRef<THREE.Group>(null);
  const { camera } = useThree();

  // Keep track of the active shaders so we can update their uniforms in useFrame
  const shadersRef = useRef<any[]>([]);
  // Track whether we have already done the lazy traverse
  const traversedRef = useRef(false);

  // Animation state
  const isSweeping = useRef(false);
  const currentRadius = useRef(0);
  const epicenterUpdateFrames = useRef(0);

  // Props refs so traverse closure always has latest values
  const modeRef = useRef(mode);
  const darknessRef = useRef(darkness);
  const trailLengthRef = useRef(trailLength);
  const beamColorRef = useRef(beamColor);
  const epicenterRef = useRef(epicenter);
  useEffect(() => { modeRef.current = mode; }, [mode]);
  useEffect(() => { darknessRef.current = darkness; }, [darkness]);
  useEffect(() => { trailLengthRef.current = trailLength; }, [trailLength]);
  useEffect(() => { beamColorRef.current = beamColor; }, [beamColor]);
  useEffect(() => { epicenterRef.current = epicenter; }, [epicenter]);

  // ── Lazy Traverse ──────────────────────────────────────────────────────────
  // We do NOT traverse on mount (children may not be in VRAM yet).
  // Instead, we traverse lazily the FIRST time a sweep is triggered.
  const doTraverse = useCallback(() => {
    if (!groupRef.current || traversedRef.current) return;
    traversedRef.current = true;

    shadersRef.current = [];

    groupRef.current.traverse((child) => {
      // Handle both regular Mesh and InstancedMesh
      const mesh = child as THREE.Mesh;
      if (!mesh.isMesh) return;

      // Skip meshes that don't have a material we can patch
      if (!mesh.material) return;

      // ── Skip materials with complex pre-existing shaders ──────────────────
      // ── Complex shaders (e.g. MeshReflectorMaterial) ───────────────────────
      // These have an existing onBeforeCompile that reads internal render-target
      // matrices. We must NOT clone them (clone loses those targets → null crash).
      // Instead, patch the ORIGINAL material in-place: wrap its onBeforeCompile.
      // For simple materials (no pre-existing onBeforeCompile) we clone first to
      // avoid contaminating shared material instances.
      const rawMaterials = Array.isArray(mesh.material)
        ? (mesh.material as THREE.Material[])
        : [mesh.material as THREE.Material];

      const hasComplexShader = rawMaterials.some(
        (m: THREE.Material) =>
          typeof (m as any).onBeforeCompile === "function" &&
          (m as any).onBeforeCompile.length > 0,
      );

      let materials: THREE.Material[];
      if (hasComplexShader) {
        // Patch in-place — do NOT reassign mesh.material
        materials = rawMaterials;
      } else {
        // Safe to clone for simple materials
        materials = Array.isArray(mesh.material)
          ? (mesh.material as THREE.Material[]).map((m) => m.clone())
          : [(mesh.material as THREE.Material).clone()];
        if (Array.isArray(mesh.material)) {
          mesh.material = materials;
        } else {
          mesh.material = materials[0];
        }
      }

      materials.forEach((mat: THREE.Material) => {
        // Guard: don't double-patch if we've already been here
        if ((mat as any).__sweepPatched) return;
        (mat as any).__sweepPatched = true;

        const originalOnBeforeCompile = (mat as any).onBeforeCompile;

        (mat as any).onBeforeCompile = (shader: any, renderer: any) => {
          if (originalOnBeforeCompile) {
            originalOnBeforeCompile.call(mat, shader, renderer);
          }

          const isOverlayFloat = modeRef.current === "overlay" ? 1.0 : 0.0;

          shader.uniforms.uTime = { value: 0 };
          shader.uniforms.uEpicenter = {
            value: new THREE.Vector3(...epicenterRef.current),
          };
          shader.uniforms.uRadius = { value: currentRadius.current };
          shader.uniforms.uTrailLength = { value: trailLengthRef.current };
          shader.uniforms.uGlowColor = { value: new THREE.Color(beamColorRef.current) };
          shader.uniforms.uDarkness = { value: darknessRef.current };
          shader.uniforms.uIsOverlay = { value: isOverlayFloat };

          shader.vertexShader = shader.vertexShader.replace(
            "#include <common>",
            `
              #include <common>
              varying vec3 vWorldPositionCustom;
              `,
          );

          shader.vertexShader = shader.vertexShader.replace(
            "#include <worldpos_vertex>",
            `
              #include <worldpos_vertex>
              vWorldPositionCustom = (modelMatrix * vec4(position, 1.0)).xyz;
              `,
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <common>",
            `
              #include <common>
              uniform float uTime;
              uniform vec3 uEpicenter;
              uniform float uRadius;
              uniform float uTrailLength;
              uniform vec3 uGlowColor;
              uniform float uDarkness;
              uniform float uIsOverlay;
              varying vec3 vWorldPositionCustom;

              // --- Procedural Worley/Voronoi Noise for Plasma Texture ---
              vec2 hash2(vec2 p) {
                  p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3)));
                  return fract(sin(p) * 43758.5453) * 2.0 - 1.0;
              }

              float worley(vec2 p) {
                  vec2 n = floor(p);
                  vec2 f = fract(p);
                  float d = 1.0e10;
                  for (int j = -1; j <= 1; j++) {
                      for (int i = -1; i <= 1; i++) {
                          vec2 g = vec2(float(i), float(j));
                          vec2 o = hash2(n + g);
                          vec2 r = g - f + (0.5 + 0.5 * sin(uTime + 6.2831 * o)); 
                          float l = dot(r, r);
                          d = min(d, l);
                      }
                  }
                  return 1.0 - saturate(sqrt(d)); 
              }
              `,
          );

          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <dithering_fragment>",
            `
              #include <dithering_fragment>
              
              // 1. Calculate radial distance and factors
              float dist = distance(vWorldPositionCustom, uEpicenter);
              float diff = uRadius - dist;
              float isRevealed = step(0.0, diff);
              
              vec3 baseColor = gl_FragColor.rgb;
              vec3 darkColor = baseColor * uDarkness;
              
              // 2. Complex Trail Masks
              // trailFactor goes from 0.0 (front of the wave) to 1.0 (end of the tail)
              float trailFactor = clamp(diff / uTrailLength, 0.0, 1.0);
              
              // BUG FIXED: We want the model to be FULLY visible (1.0) when trailFactor approaches 1.0.
              float modelVisibility = smoothstep(0.1, 0.9, trailFactor);
              
              float leadingEdgeMask = 1.0 - smoothstep(0.0, 2.0, abs(diff));
              
              // overallMask makes the glow strong at the front (trailFactor 0) and fade out at the end (trailFactor 1)
              float overallMask = smoothstep(1.0, 0.0, trailFactor) * isRevealed;

              // --- 3. Monochromatic Tonal Glow Composition ---
              float plasmaPattern = worley(vWorldPositionCustom.xy * 0.02 + vec2(uTime * 0.1, dist * -0.01));
              
              // Create a gradient based purely on the base beam color
              vec3 whiteHot = vec3(1.0, 0.98, 0.95); // Super bright hot core
              vec3 midTone = uGlowColor;             // The pure chosen color
              vec3 darkTone = uGlowColor * 0.1;      // Darker faded tail
              
              // Shift smoothly between tones based on position in the trail
              vec3 gradientGlow = mix(darkTone, midTone, smoothstep(0.0, 0.5, trailFactor));
              gradientGlow = mix(gradientGlow, whiteHot, smoothstep(0.8, 1.0, trailFactor));
              
              // Apply the noise texture to the gradient
              float plasmaFactor = overallMask * (0.5 + 0.5 * plasmaPattern);
              vec3 plasmaBody = gradientGlow * plasmaFactor;
              
              // Intensity logic
              float coreBrightness = overallMask * leadingEdgeMask * 2.0; 
              float bodyThickness = pow(overallMask, 2.0); 
              float heatPulsate = 0.95 + 0.05 * sin(uTime * 15.0); 

              // Combine into the final glow effect
              vec3 finalGlow = heatPulsate * ((whiteHot * coreBrightness * 5.0) + (plasmaBody * 4.0 * bodyThickness));
              
              // --- 4. Final Color Blend & Modes ---
              // If uIsOverlay is 1.0, beforeWaveColor is just normal baseColor.
              // If uIsOverlay is 0.0, beforeWaveColor is darkColor.
              vec3 beforeWaveColor = mix(darkColor, baseColor, uIsOverlay);
              
              // If overlay mode, we don't suppress the base model color inside the glow as much
              float currentModelVisibility = mix(modelVisibility, 1.0, uIsOverlay);
              vec3 afterWaveColor = (baseColor * currentModelVisibility) + finalGlow;
              
              // Final mix based on whether the wave has reached the pixel
              vec3 finalColor = mix(beforeWaveColor, afterWaveColor, isRevealed);
              
              gl_FragColor = vec4(finalColor, gl_FragColor.a);
              `,
          );

          shadersRef.current.push(shader);
        };

        // Mark material for recompile
        (mat as any).needsUpdate = true;
        // Set a unique cache key so Three.js treats the patched version as different
        (mat as any).customProgramCacheKey = () => `sweep_reveal_${modeRef.current}`;
      });
    });
  }, []); // No dependencies — reads from refs

  // Trigger the effect
  const triggerSweep = useCallback(() => {
    if (isSweeping.current) {
      signalSweepSecondaryClick();
      return;
    }

    // Lazy traverse: patch materials NOW (children are guaranteed ready after warmup)
    doTraverse();

    isSweeping.current = true;
    currentRadius.current = 0;
    signalSweepStart();

    if (dynamicEpicenter) {
      // Wait 3 frames before grabbing camera position to ensure Theatre.js has updated it
      epicenterUpdateFrames.current = 3;
    }

    if (onRevealStart) onRevealStart();
  }, [onRevealStart, dynamicEpicenter, doTraverse]);

  // Click listener — only fires when this scene is active
  useEffect(() => {
    const handleClick = () => {
      if (!isActive) return;
      triggerSweep();
    };
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [triggerSweep, isActive]);

  // Reset when scene becomes inactive; re-traverse on next activation
  useEffect(() => {
    if (!isActive) {
      isSweeping.current = false;
      currentRadius.current = 0;
      traversedRef.current = false; // Allow re-traversal when scene re-activates
      shadersRef.current.forEach((shader) => {
        if (shader.uniforms?.uRadius) {
          shader.uniforms.uRadius.value = 0;
        }
      });
      shadersRef.current = [];

      // Clear __sweepPatched on all in-place-patched materials so they can
      // be re-patched correctly when the scene activates again
      if (groupRef.current) {
        groupRef.current.traverse((child) => {
          const mesh = child as THREE.Mesh;
          if (!mesh.isMesh || !mesh.material) return;
          const mats = Array.isArray(mesh.material)
            ? (mesh.material as THREE.Material[])
            : [mesh.material as THREE.Material];
          mats.forEach((m) => {
            (m as any).__sweepPatched = false;
          });
        });
      }
      return;
    }

    if (isActive && autoTriggerDelay !== undefined) {
      const timer = setTimeout(() => {
        triggerSweep();
      }, autoTriggerDelay);
      return () => clearTimeout(timer);
    }
  }, [isActive, autoTriggerDelay, triggerSweep]);

  useFrame((state, delta) => {
    if (epicenterUpdateFrames.current > 0) {
      epicenterUpdateFrames.current--;
      if (epicenterUpdateFrames.current === 0) {
        const startPos = new THREE.Vector3(state.camera.position.x, epicenterRef.current[1], state.camera.position.z);
        shadersRef.current.forEach((shader) => {
          if (shader.uniforms?.uEpicenter) {
            shader.uniforms.uEpicenter.value.copy(startPos);
          }
        });
      }
    }

    if (!isSweeping.current) return;

    const moveAmount = speed * delta;
    currentRadius.current += moveAmount;

    if (currentRadius.current >= maxRadius) {
      isSweeping.current = false;
    }

    shadersRef.current.forEach((shader) => {
      if (shader.uniforms) {
        if (shader.uniforms.uRadius)
          shader.uniforms.uRadius.value = currentRadius.current;
        if (shader.uniforms.uTime)
          shader.uniforms.uTime.value = state.clock.elapsedTime;
      }
    });
  });

  return <group ref={groupRef}>{children}</group>;
}
