"use client";

import {
  EffectComposer,
  Bloom,
  Vignette,
  Noise,
} from "@react-three/postprocessing";
import { BlendFunction } from "postprocessing";

export default function Effect() {
  return (
    <EffectComposer enableNormalPass={false}>
      <Bloom
        intensity={0.5}
        luminanceThreshold={0.8}
        luminanceSmoothing={0.1}
        mipmapBlur
      />
      <Noise opacity={0.8} premultiply blendFunction={BlendFunction.ADD} />
      <Vignette
        eskil={false}
        offset={0.2}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
    </EffectComposer>
  );
}
