import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

const LINE_COUNT = 5;
const LINE_GAP = 0.7;
const LINE_RADIUS = 0.02;
const GLOW_RADIUS = 0.14;

export const BEAM_COLOR = 0xaae8ff;

export default function LightBeam() {
  // Main group that will forcefully attach itself to the active camera
  const mainGroupRef = useRef<THREE.Group>(null);
  const linesGroupRef = useRef<THREE.Group>(null);

  const currentMouseX = useRef(0);
  const currentMouseY = useRef(0);
  const targetMouseX = useRef(0);
  const targetMouseY = useRef(0);

  const clickValue = useRef(0);
  const clickVelocity = useRef(0);
  const clickTarget = useRef(0);

  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);
  const glowMaterialsRef = useRef<THREE.ShaderMaterial[]>([]);

  const headLightRef = useRef<THREE.PointLight>(null);
  const fillLightRef = useRef<THREE.PointLight>(null);
  const spotLightRef = useRef<THREE.SpotLight>(null);

  // Dedicated Object3D to act as the SpotLight's target
  const spotLightTarget = useMemo(() => new THREE.Object3D(), []);

  const beamColor = useMemo(() => new THREE.Color(BEAM_COLOR), []);

  const basePoints = useMemo(
    () => [
      new THREE.Vector3(0, 0, 3),
      new THREE.Vector3(0, 0, -10),
      new THREE.Vector3(0, 0, -30),
      new THREE.Vector3(0, 0, -60),
      new THREE.Vector3(0, 0, -100),
    ],
    [],
  );

  const curve = useMemo(
    () => new THREE.CatmullRomCurve3(basePoints),
    [basePoints],
  );

  const sharedUniforms = useMemo(
    () => ({
      time: { value: 0 },
      color: { value: beamColor },
      clickPulse: { value: 0.0 },
      mouse: { value: new THREE.Vector2(0, 0) },
    }),
    [beamColor],
  );

  const glowUniforms = useMemo(
    () => ({
      time: { value: 0 },
      color: { value: beamColor },
      clickPulse: { value: 0.0 },
      mouse: { value: new THREE.Vector2(0, 0) },
    }),
    [beamColor],
  );

  const vertexShader = `
    uniform float time;
    uniform float lineIndex;
    uniform float clickPulse;
    uniform vec2 mouse;
    varying vec2 vUv;

    void main() {
      vUv = uv;
      vec3 pos = position;

      float lagAmount = sin(time * 2.5 + lineIndex * 1.5) * 15.0;
      pos.z += lagAmount * vUv.x;

      float angle      = lineIndex * (6.28318 / ${LINE_COUNT.toFixed(1)});
      float baseRadius = ${LINE_GAP.toFixed(2)} * (0.9 + 0.1 * vUv.x);

      float bendFactor  = pow(vUv.x, 2.0);
      float mouseReactX = mouse.x * 15.0 * bendFactor;
      float mouseReactY = mouse.y * 15.0 * bendFactor;

      float clickShift = clickPulse * (4.0 + lineIndex * 0.5) * pow(vUv.x, 0.5);
      pos.x += clickShift;

      pos.x += cos(angle) * baseRadius + mouseReactX;
      pos.y += sin(angle) * baseRadius + mouseReactY;

      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3  color;
    uniform float time;
    varying vec2  vUv;

    void main() {
      float pulse    = sin((vUv.x * 30.0) + time * 15.0) * 0.5 + 0.5;
      float fadeOut  = smoothstep(1.0, 0.0, vUv.x);
      float headGlow = smoothstep(0.03, 0.0, vUv.x) * 3.0;
      float intensity = fadeOut * 0.5 + pulse * fadeOut * 0.8 + headGlow;
      gl_FragColor = vec4(color * intensity, fadeOut);
    }
  `;

  const glowFragmentShader = `
    uniform vec3  color;
    uniform float time;
    varying vec2  vUv;

    void main() {
      float fadeOut = smoothstep(1.0, 0.0, vUv.x);
      float breathe = sin(time * 1.8) * 0.12 + 0.28;
      float intensity = fadeOut * breathe;
      gl_FragColor = vec4(color * intensity, intensity * 0.55);
    }
  `;

  useEffect(() => {
    const onMouseMove = (e: PointerEvent) => {
      targetMouseX.current = (e.clientX / window.innerWidth) * 2 - 1;
      targetMouseY.current = -(e.clientY / window.innerHeight) * 2 + 1;
    };
    const onPointerDown = () => {
      clickVelocity.current += 2.5;
    };

    window.addEventListener("pointermove", onMouseMove as EventListener);
    window.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("pointermove", onMouseMove as EventListener);
      window.removeEventListener("pointerdown", onPointerDown);
    };
  }, []);

  useFrame((state, delta) => {
    // 1. Ensure the current active camera is added to the scene
    if (state.camera.parent !== state.scene) {
      state.scene.add(state.camera);
    }

    // 2. Imperatively attach our main group to the active camera
    // This solves the issue of disappearing lights when scenes change!
    if (mainGroupRef.current && mainGroupRef.current.parent !== state.camera) {
      state.camera.add(mainGroupRef.current);
    }

    currentMouseX.current +=
      (targetMouseX.current - currentMouseX.current) * 0.08;
    currentMouseY.current +=
      (targetMouseY.current - currentMouseY.current) * 0.08;

    const force = (clickTarget.current - clickValue.current) * 12.0;
    clickVelocity.current += force * delta;
    clickVelocity.current *= Math.max(0, 1.0 - 1.5 * delta);
    clickValue.current += clickVelocity.current * delta;

    const t = state.clock.getElapsedTime();

    const updateMat = (mat: THREE.ShaderMaterial) => {
      if (!mat?.uniforms) return;
      if (mat.uniforms.time) mat.uniforms.time.value = t;
      if (mat.uniforms.mouse?.value)
        mat.uniforms.mouse.value.set(
          currentMouseX.current,
          currentMouseY.current,
        );
      if (mat.uniforms.clickPulse)
        mat.uniforms.clickPulse.value = clickValue.current;
    };
    materialsRef.current.forEach(updateMat);
    glowMaterialsRef.current.forEach(updateMat);

    if (linesGroupRef.current) {
      const baseX = -3,
        baseY = -2;

      linesGroupRef.current.position.x +=
        (baseX +
          currentMouseX.current * 1.5 -
          linesGroupRef.current.position.x) *
        0.04;
      linesGroupRef.current.position.y +=
        (baseY +
          currentMouseY.current * 1.0 -
          linesGroupRef.current.position.y) *
        0.04;
      linesGroupRef.current.rotation.y +=
        (-currentMouseX.current * 0.15 - linesGroupRef.current.rotation.y) *
        0.05;
      linesGroupRef.current.rotation.x +=
        (currentMouseY.current * 0.1 - linesGroupRef.current.rotation.x) * 0.05;

      const breath = 0.7 + 0.3 * Math.sin(t * 2.5);
      const flicker =
        1.0 + 0.07 * Math.sin(t * 7.7) + 0.03 * Math.sin(t * 13.3);
      const pulse = breath * flicker + clickValue.current * 0.5;

      const gp = linesGroupRef.current.position;

      // Update lights locally
      if (headLightRef.current) {
        headLightRef.current.position.set(gp.x, gp.y, gp.z);
        headLightRef.current.intensity = 4.0 * pulse;
      }

      if (fillLightRef.current) {
        fillLightRef.current.position.set(gp.x, gp.y, gp.z - 15);
        fillLightRef.current.intensity = 2.0 * pulse;
      }

      if (spotLightRef.current) {
        spotLightRef.current.position.set(gp.x, gp.y, gp.z + 2);
        spotLightTarget.position.set(gp.x, gp.y, gp.z - 80);
        spotLightRef.current.intensity = 7.0 * pulse;
      }
    }
  });

  return (
    <group ref={mainGroupRef}>
      {/* Target object added naturally to the scene graph */}
      <primitive object={spotLightTarget} />

      <pointLight
        ref={headLightRef}
        color={BEAM_COLOR}
        intensity={4}
        distance={30}
        decay={0.8}
        position={[-3, -2, -5]}
      />
      <pointLight
        ref={fillLightRef}
        color={BEAM_COLOR}
        intensity={2}
        distance={75}
        decay={0.5}
        position={[-3, -2, -20]}
      />
      <spotLight
        ref={spotLightRef}
        color={BEAM_COLOR}
        intensity={7}
        angle={Math.PI / 3}
        penumbra={0.85}
        distance={100}
        decay={1}
        castShadow={false}
        position={[-3, -2, -3]}
        target={spotLightTarget}
      />

      <group ref={linesGroupRef} position={[-3, -2, -5]}>
        {Array.from({ length: LINE_COUNT }).map((_, i) => (
          <mesh key={`glow-${i}`} renderOrder={997}>
            <tubeGeometry args={[curve, 32, GLOW_RADIUS, 8, false]} />
            <shaderMaterial
              ref={(el) => {
                if (el) glowMaterialsRef.current[i] = el;
              }}
              uniforms={{ ...glowUniforms, lineIndex: { value: i } }}
              vertexShader={vertexShader}
              fragmentShader={glowFragmentShader}
              transparent={true}
              blending={THREE.NormalBlending}
              depthWrite={false}
              depthTest={false}
              side={THREE.FrontSide}
            />
          </mesh>
        ))}

        {Array.from({ length: LINE_COUNT }).map((_, i) => (
          <mesh key={i} renderOrder={999}>
            <tubeGeometry args={[curve, 64, LINE_RADIUS, 8, false]} />
            <shaderMaterial
              ref={(el) => {
                if (el) materialsRef.current[i] = el;
              }}
              uniforms={{ ...sharedUniforms, lineIndex: { value: i } }}
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              transparent={true}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
              depthTest={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
