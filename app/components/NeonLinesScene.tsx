import { useEffect, useRef, useMemo } from "react";
import * as THREE from "three";
import { useFrame } from "@react-three/fiber";

// --- Configuration Constants ---
const LINE_COUNT = 5;
const LINE_GAP = 0.7; // Spacing between lines
const LINE_RADIUS = 0.02; // Thickness of each individual line

export default function NeonLinesScene() {
  const cameraSyncGroupRef = useRef<THREE.Group>(null);
  const linesGroupRef = useRef<THREE.Group>(null);

  const currentMouseX = useRef(0);
  const currentMouseY = useRef(0);
  const targetMouseX = useRef(0);
  const targetMouseY = useRef(0);

  const clickValue = useRef(0);
  const clickVelocity = useRef(0);
  const clickTarget = useRef(0);

  const materialsRef = useRef<THREE.ShaderMaterial[]>([]);

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
  const colorCyan = useMemo(() => new THREE.Color(0x88ffcc), []);

  const sharedUniforms = useMemo(
    () => ({
      time: { value: 0 },
      color: { value: colorCyan },
      clickPulse: { value: 0.0 },
      mouse: { value: new THREE.Vector2(0, 0) },
    }),
    [colorCyan],
  );

  // --- Vertex Shader: Straight, Directed, No "Hair" Wiggling ---
  const vertexShader = `
    uniform float time;
    uniform float lineIndex;
    uniform float clickPulse;
    uniform vec2 mouse;
    varying vec2 vUv;
    
    void main() {
      vUv = uv;
      vec3 pos = position;
      
      // --- 1. Forward Catch-up (Z-axis only) ---
      float lagAmount = sin(time * 2.5 + lineIndex * 1.5) * 15.0; 
      pos.z += lagAmount * vUv.x;

      float angle = lineIndex * (6.28318 / ${LINE_COUNT.toFixed(1)}); 
      float baseRadius = ${LINE_GAP.toFixed(2)} * (0.9 + 0.1 * vUv.x); 
      
      // --- 2. Mouse Bend (NO time-based loop, just static bend) ---
      float bendFactor = pow(vUv.x, 2.0); 
      float mouseReactX = mouse.x * 15.0 * bendFactor;
      float mouseReactY = mouse.y * 15.0 * bendFactor;
      
      // --- 3. Click Soft Move (Springy rightward shift) ---
      float clickShift = clickPulse * (4.0 + lineIndex * 0.5) * pow(vUv.x, 0.5); 
      pos.x += clickShift;
      
      pos.x += cos(angle) * baseRadius + mouseReactX;
      pos.y += sin(angle) * baseRadius + mouseReactY;
      
      gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
    }
  `;

  const fragmentShader = `
    uniform vec3 color;
    uniform float time;
    varying vec2 vUv;
    
    void main() {
      float speed = 3.0;
      float pulse = sin((vUv.x * 30.0) + (time * speed * 5.0)) * 0.5 + 0.5;
      
      float fadeOut = smoothstep(1.0, 0.0, vUv.x);
      float headGlow = smoothstep(0.03, 0.0, vUv.x) * 3.0;
      
      float intensity = (fadeOut * 0.5) + (pulse * fadeOut * 0.8) + headGlow;
      
      gl_FragColor = vec4(color * intensity, fadeOut);
    }
  `;

  useEffect(() => {
    const onMouseMove = (event: PointerEvent) => {
      targetMouseX.current = (event.clientX / window.innerWidth) * 2 - 1;
      targetMouseY.current = -(event.clientY / window.innerHeight) * 2 + 1;
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
    currentMouseX.current +=
      (targetMouseX.current - currentMouseX.current) * 0.08;
    currentMouseY.current +=
      (targetMouseY.current - currentMouseY.current) * 0.08;

    const springStiffness = 12.0;
    const springDamping = 1.5;

    const force = (clickTarget.current - clickValue.current) * springStiffness;
    clickVelocity.current += force * delta;
    clickVelocity.current *= Math.max(0, 1.0 - springDamping * delta);
    clickValue.current += clickVelocity.current * delta;

    // IMPORTANT: ShaderMaterial clones the uniforms on creation.
    // We must update the materials' uniforms directly.
    materialsRef.current.forEach((mat) => {
      if (mat && mat.uniforms) {
        if (mat.uniforms.time) {
          mat.uniforms.time.value = state.clock.getElapsedTime();
        }
        if (mat.uniforms.mouse && mat.uniforms.mouse.value) {
          mat.uniforms.mouse.value.set(
            currentMouseX.current,
            currentMouseY.current,
          );
        }
        if (mat.uniforms.clickPulse) {
          mat.uniforms.clickPulse.value = clickValue.current;
        }
      }
    });

    if (cameraSyncGroupRef.current) {
      cameraSyncGroupRef.current.position.copy(state.camera.position);
      cameraSyncGroupRef.current.quaternion.copy(state.camera.quaternion);
    }

    if (linesGroupRef.current) {
      const baseGroupPosX = -3;
      const baseGroupPosY = -2;
      const targetX = baseGroupPosX + currentMouseX.current * 1.5;
      const targetY = baseGroupPosY + currentMouseY.current * 1.0;

      linesGroupRef.current.position.x +=
        (targetX - linesGroupRef.current.position.x) * 0.04;
      linesGroupRef.current.position.y +=
        (targetY - linesGroupRef.current.position.y) * 0.04;

      linesGroupRef.current.rotation.y +=
        (-currentMouseX.current * 0.15 - linesGroupRef.current.rotation.y) *
        0.05;
      linesGroupRef.current.rotation.x +=
        (currentMouseY.current * 0.1 - linesGroupRef.current.rotation.x) * 0.05;
    }
  });

  return (
    <group ref={cameraSyncGroupRef}>
      <group ref={linesGroupRef} position={[-3, -2, -5]}>
        {Array.from({ length: LINE_COUNT }).map((_, i) => (
          <mesh key={i}>
            <tubeGeometry args={[curve, 250, LINE_RADIUS, 8, false]} />
            <shaderMaterial
              ref={(el) => {
                if (el) materialsRef.current[i] = el;
              }}
              uniforms={{
                ...sharedUniforms,
                lineIndex: { value: i },
              }}
              vertexShader={vertexShader}
              fragmentShader={fragmentShader}
              transparent={true}
              blending={THREE.AdditiveBlending}
              depthWrite={false}
            />
          </mesh>
        ))}
      </group>
    </group>
  );
}
